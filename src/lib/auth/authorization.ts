import { db } from "@/lib/db";
import { users, teams, employees, managerAssignments, teamMemberships } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

export interface ManagerContext {
  userId: string;
  organizationId: string;
  assignedTeamIds: string[];
  assignedEmployeeIds: string[];
}

export async function getManagerContext(email: string): Promise<ManagerContext | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, "active")))
    .limit(1);

  if (!user) return null;

  const assignments = await db
    .select()
    .from(managerAssignments)
    .where(
      and(eq(managerAssignments.managerUserId, user.id), isNull(managerAssignments.effectiveTo))
    );

  const teamIds = assignments.filter((a) => a.teamId !== null).map((a) => a.teamId!);

  let teamEmployeeIds: string[] = [];
  if (teamIds.length > 0) {
    const memberships = await db
      .select({ employeeId: teamMemberships.employeeId })
      .from(teamMemberships)
      .where(and(inArray(teamMemberships.teamId, teamIds), isNull(teamMemberships.effectiveTo)));
    teamEmployeeIds = memberships.map((m) => m.employeeId);
  }

  const directEmployeeIds = assignments
    .filter((a) => a.employeeId !== null)
    .map((a) => a.employeeId!);

  const allEmployeeIds = [...new Set([...teamEmployeeIds, ...directEmployeeIds])];

  return {
    userId: user.id,
    organizationId: user.organizationId,
    assignedTeamIds: teamIds,
    assignedEmployeeIds: allEmployeeIds,
  };
}

export async function getAssignedTeams(ctx: ManagerContext) {
  if (ctx.assignedTeamIds.length === 0) return [];
  return db.select().from(teams).where(inArray(teams.id, ctx.assignedTeamIds));
}

export async function getAssignedEmployees(ctx: ManagerContext) {
  if (ctx.assignedEmployeeIds.length === 0) return [];
  return db.select().from(employees).where(inArray(employees.id, ctx.assignedEmployeeIds));
}

export function assertCanAccessEmployee(ctx: ManagerContext, employeeId: string): void {
  if (!ctx.assignedEmployeeIds.includes(employeeId)) {
    throw new Error("Unauthorized: employee not in manager's scope");
  }
}

export function assertCanAccessTeam(ctx: ManagerContext, teamId: string): void {
  if (!ctx.assignedTeamIds.includes(teamId)) {
    throw new Error("Unauthorized: team not in manager's scope");
  }
}
