"use server";

import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics, type EmployeeMetricRow } from "@/lib/domain/metrics/queries";

// Re-runs just the metrics fetch for one employee/week -- called from the
// client when the manager navigates to a week that isn't cached yet. Skips
// the team/manager display-name lookups the initial page load does, since
// those don't change per week. teamId is re-derived from the employee's own
// record rather than trusted from the caller, so a client can't point this
// at metric assignments for a team the employee isn't actually on.
export async function getWeekMetrics(
  employeeId: string,
  periodStart: string,
  previousPeriodStart: string
): Promise<EmployeeMetricRow[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) throw new Error("Not authorized");

  const employees = await getAssignedEmployees(ctx);
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee?.primaryTeamId) throw new Error("Employee not found or has no team");

  return getEmployeeMetrics(
    ctx,
    employeeId,
    employee.primaryTeamId,
    periodStart,
    previousPeriodStart
  );
}
