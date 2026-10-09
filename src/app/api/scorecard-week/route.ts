import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics } from "@/lib/domain/metrics/queries";
import { resolveReportingWeek, shiftWeekStart } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** One authorized employee and one week; no source ingestion or shared response cache. */
export async function GET(request: Request) {
  type Phase = "auth" | "context" | "employee" | "metrics";
  const timings: Partial<Record<Phase, number>> = {};
  let authenticated = false;
  const phase = async <T>(name: Phase, read: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try {
      return await read();
    } finally {
      const elapsed = performance.now() - started;
      timings[name] = Number(
        Math.min(30_000, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)).toFixed(1)
      );
    }
  };
  const reply = (body: unknown, status = 200) => {
    if (
      authenticated &&
      Object.values(timings).reduce((total, duration) => total + duration, 0) >= 1_000
    ) {
      logger.info("Slow scorecard week read", { timings, status });
    }
    return Response.json(body, {
      status,
      headers: {
        ...headers,
        ...(authenticated
          ? {
              "Server-Timing": Object.entries(timings)
                .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
                .join(", "),
            }
          : {}),
      },
    });
  };
  try {
    const session = await phase("auth", () => auth());
    if (!session?.user?.email) return reply({ error: "Not authenticated" }, 401);
    authenticated = true;
    const email = session.user.email;
    const { ctx } = await phase("context", () => getEffectiveManagerContext(email));
    if (!ctx) return reply({ error: "Not authorized" }, 403);
    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return reply({ error: "Invalid employee" }, 400);
    }
    const employee = (await phase("employee", () => getAssignedEmployees(ctx))).find(
      (e) => e.id === employeeId
    );
    if (!employee?.primaryTeamId) return reply({ error: "Employee not found" }, 404);
    const teamId = employee.primaryTeamId;
    // Never accept a client team ID; derive it from the authorized employee again.
    const periodStart = resolveReportingWeek(params.get("week"));
    const rows = await phase("metrics", () =>
      getEmployeeMetrics(ctx, employeeId, teamId, periodStart, shiftWeekStart(periodStart, -1))
    );
    return reply({ periodStart, rows });
  } catch {
    // Do not expose SQL, employee payloads or driver causes in a JSON error.
    return reply({ error: "Unable to load this week. Please try again." }, 500);
  }
}
