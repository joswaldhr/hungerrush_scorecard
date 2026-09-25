import { db } from "@/lib/db";
import { employees, teams, teamMemberships, managerAssignments, users } from "@/lib/db/schema";
import { eq, and, isNull, lte, gt, or } from "drizzle-orm";

/** Organization comes from requireAdmin, never a route/form-supplied owner. */
export async function getAdminEmployeeDetail(organizationId: string, employeeId: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)));
  if (!employee) return null;
  const today = new Date().toISOString().slice(0, 10);
  const allTeams = await db.select().from(teams).where(eq(teams.organizationId, organizationId));
  const teamId = allTeams.find((team) => team.id === employee.primaryTeamId)?.id;
  const [currentMembership, currentManager] = teamId
    ? await Promise.all([
        db
          .select()
          .from(teamMemberships)
          .where(
            and(
              eq(teamMemberships.employeeId, employeeId),
              eq(teamMemberships.teamId, teamId),
              lte(teamMemberships.effectiveFrom, today),
              or(isNull(teamMemberships.effectiveTo), gt(teamMemberships.effectiveTo, today))
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({ displayName: users.displayName })
          .from(managerAssignments)
          .innerJoin(users, eq(managerAssignments.managerUserId, users.id))
          .where(
            and(
              eq(managerAssignments.teamId, teamId),
              eq(users.organizationId, organizationId),
              eq(users.status, "active"),
              lte(managerAssignments.effectiveFrom, today),
              or(isNull(managerAssignments.effectiveTo), gt(managerAssignments.effectiveTo, today))
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ])
    : [null, null];
  return { employee, allTeams, currentMembership, currentManager };
}
