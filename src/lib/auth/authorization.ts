import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, teams, employees, managerAssignments, teamMemberships } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

export const VIEW_AS_COOKIE = "cadence_view_as";

export interface ManagerContext {
  userId: string;
  organizationId: string;
  assignedTeamIds: string[];
  assignedEmployeeIds: string[];
}

type UserRow = typeof users.$inferSelect;

async function getActiveUserByEmail(email: string): Promise<UserRow | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, "active")))
    .limit(1);
  return user ?? null;
}

async function buildManagerContext(user: UserRow): Promise<ManagerContext | null> {
  const assignments = await db
    .select()
    .from(managerAssignments)
    .where(
      and(eq(managerAssignments.managerUserId, user.id), isNull(managerAssignments.effectiveTo))
    );

  if (assignments.length === 0) return null;

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

export async function getManagerContext(email: string): Promise<ManagerContext | null> {
  const user = await getActiveUserByEmail(email);
  if (!user) return null;
  return buildManagerContext(user);
}

export async function isPlatformAdmin(email: string): Promise<boolean> {
  const user = await getActiveUserByEmail(email);
  return user?.isPlatformAdmin ?? false;
}

export interface EffectiveManagerContext {
  ctx: ManagerContext | null;
  isPlatformAdmin: boolean;
  viewingAs: { userId: string; displayName: string } | null;
}

/**
 * A manager's own assignments always win. A platform admin with no
 * assignments of their own falls back to whichever manager they've chosen
 * to view as (via the cadence_view_as cookie) — set only through the /admin
 * "View as" flow, which itself re-checks isPlatformAdmin server-side.
 */
export async function getEffectiveManagerContext(email: string): Promise<EffectiveManagerContext> {
  const user = await getActiveUserByEmail(email);
  if (!user) return { ctx: null, isPlatformAdmin: false, viewingAs: null };

  const ownCtx = await buildManagerContext(user);
  if (ownCtx) return { ctx: ownCtx, isPlatformAdmin: user.isPlatformAdmin, viewingAs: null };

  if (!user.isPlatformAdmin) return { ctx: null, isPlatformAdmin: false, viewingAs: null };

  const cookieStore = await cookies();
  const viewAsUserId = cookieStore.get(VIEW_AS_COOKIE)?.value;
  if (!viewAsUserId) return { ctx: null, isPlatformAdmin: true, viewingAs: null };

  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, viewAsUserId), eq(users.status, "active")))
    .limit(1);
  if (!targetUser) return { ctx: null, isPlatformAdmin: true, viewingAs: null };

  const targetCtx = await buildManagerContext(targetUser);
  if (!targetCtx) return { ctx: null, isPlatformAdmin: true, viewingAs: null };

  return {
    ctx: targetCtx,
    isPlatformAdmin: true,
    viewingAs: { userId: targetUser.id, displayName: targetUser.displayName },
  };
}

export interface ManagerOption {
  userId: string;
  displayName: string;
  email: string;
  teamNames: string[];
}

export async function listManagersForViewAs(): Promise<ManagerOption[]> {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      teamName: teams.name,
    })
    .from(managerAssignments)
    .innerJoin(users, eq(managerAssignments.managerUserId, users.id))
    .leftJoin(teams, eq(managerAssignments.teamId, teams.id))
    .where(and(isNull(managerAssignments.effectiveTo), eq(users.status, "active")));

  const byUser = new Map<string, ManagerOption>();
  for (const row of rows) {
    const existing = byUser.get(row.userId);
    if (existing) {
      if (row.teamName) existing.teamNames.push(row.teamName);
    } else {
      byUser.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        teamNames: row.teamName ? [row.teamName] : [],
      });
    }
  }
  return [...byUser.values()];
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
