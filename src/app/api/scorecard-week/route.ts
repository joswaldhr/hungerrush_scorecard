import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics } from "@/lib/domain/metrics/queries";
import { resolveReportingWeek, shiftWeekStart } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

/** One authorized employee and one week; no source ingestion or shared response cache. */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return reply({ error: "Not authenticated" }, 401);
    const { ctx } = await getEffectiveManagerContext(session.user.email);
    if (!ctx) return reply({ error: "Not authorized" }, 403);
    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return reply({ error: "Invalid employee" }, 400);
    }
    const employee = (await getAssignedEmployees(ctx)).find((e) => e.id === employeeId);
    if (!employee?.primaryTeamId) return reply({ error: "Employee not found" }, 404);
    // Never accept a client team ID; derive it from the authorized employee again.
    const periodStart = resolveReportingWeek(params.get("week"));
    const rows = await getEmployeeMetrics(
      ctx,
      employeeId,
      employee.primaryTeamId,
      periodStart,
      shiftWeekStart(periodStart, -1)
    );
    return reply({ periodStart, rows });
  } catch {
    // Do not expose SQL, employee payloads or driver causes in a JSON error.
    return reply({ error: "Unable to load this week. Please try again." }, 500);
  }
}
