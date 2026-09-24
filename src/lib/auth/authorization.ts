import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, teams, employees, managerAssignments, teamMemberships } from "@/lib/db/schema";
import { eq, and, isNull, inArray, or, lte, gt } from "drizzle-orm";

export const VIEW_AS_COOKIE = "cadence_view_as";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ManagerContext {
  userId: string;
  organizationId: string;
  assignedTeamIds: string[];
  assignedEmployeeIds: string[];
}

type UserRow = typeof users.$inferSelect;

const getActiveUserByEmail = cache(async function getActiveUserByEmail(
  email: string
): Promise<UserRow | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.status, "active")))
    .limit(1);
  return user ?? null;
});

async function buildManagerContext(user: UserRow): Promise<ManagerContext | null> {
  const today = new Date().toISOString().slice(0, 10);
  const assignments = await db
    .select()
    .from(managerAssignments)
    .where(
      and(
        eq(managerAssignments.managerUserId, user.id),
        lte(managerAssignments.effectiveFrom, today),
        or(isNull(managerAssignments.effectiveTo), gt(managerAssignments.effectiveTo, today))
      )
    );

  if (assignments.length === 0) return null;

  const assignedTeamIds = assignments.filter((a) => a.teamId !== null).map((a) => a.teamId!);
  const scopedTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organizationId, user.organizationId), inArray(teams.id, assignedTeamIds)));
  const teamIds = scopedTeams.map((t) => t.id);

  let teamEmployeeIds: string[] = [];
  if (teamIds.length > 0) {
    const memberships = await db
      .select({ employeeId: teamMemberships.employeeId })
      .from(teamMemberships)
      .where(
        and(
          inArray(teamMemberships.teamId, teamIds),
          lte(teamMemberships.effectiveFrom, today),
          or(isNull(teamMemberships.effectiveTo), gt(teamMemberships.effectiveTo, today))
        )
      );
    teamEmployeeIds = memberships.map((m) => m.employeeId);
  }

  const directEmployeeIds = assignments
    .filter((a) => a.employeeId !== null)
    .map((a) => a.employeeId!);

  const scopedEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, user.organizationId),
        inArray(employees.id, [...new Set([...teamEmployeeIds, ...directEmployeeIds])])
      )
    );
  const allEmployeeIds = scopedEmployees.map((e) => e.id);

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

export const isPlatformAdmin = cache(async function isPlatformAdmin(
  email: string
): Promise<boolean> {
  const user = await getActiveUserByEmail(email);
  return user?.isPlatformAdmin ?? false;
});

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
export const getEffectiveManagerContext = cache(async function getEffectiveManagerContext(
  email: string
): Promise<EffectiveManagerContext> {
  const user = await getActiveUserByEmail(email);
  if (!user) return { ctx: null, isPlatformAdmin: false, viewingAs: null };

  const ownCtx = await buildManagerContext(user);
  if (ownCtx) return { ctx: ownCtx, isPlatformAdmin: user.isPlatformAdmin, viewingAs: null };

  if (!user.isPlatformAdmin) return { ctx: null, isPlatformAdmin: false, viewingAs: null };

  const cookieStore = await cookies();
  const viewAsUserId = cookieStore.get(VIEW_AS_COOKIE)?.value;
  if (!viewAsUserId || !UUID_RE.test(viewAsUserId)) {
    return { ctx: null, isPlatformAdmin: true, viewingAs: null };
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, viewAsUserId), eq(users.status, "active")))
    .limit(1);
  // A platform admin can only view as a manager within their own
  // organization -- being an admin doesn't mean being a super-admin across
  // every organization once more than one exists.
  if (!targetUser || targetUser.organizationId !== user.organizationId) {
    return { ctx: null, isPlatformAdmin: true, viewingAs: null };
  }

  const targetCtx = await buildManagerContext(targetUser);
  if (!targetCtx) return { ctx: null, isPlatformAdmin: true, viewingAs: null };

  return {
    ctx: targetCtx,
    isPlatformAdmin: true,
    viewingAs: { userId: targetUser.id, displayName: targetUser.displayName },
  };
});

export interface ManagerOption {
  userId: string;
  displayName: string;
  email: string;
  teamNames: string[];
}

export async function listManagersForViewAs(organizationId: string): Promise<ManagerOption[]> {
  const today = new Date().toISOString().slice(0, 10);
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
    .where(
      and(
        lte(managerAssignments.effectiveFrom, today),
        or(isNull(managerAssignments.effectiveTo), gt(managerAssignments.effectiveTo, today)),
        eq(users.status, "active"),
        eq(users.organizationId, organizationId)
      )
    );

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

export const getAssignedTeams = cache(async function getAssignedTeams(ctx: ManagerContext) {
  if (ctx.assignedTeamIds.length === 0) return [];
  return db
    .select()
    .from(teams)
    .where(
      and(inArray(teams.id, ctx.assignedTeamIds), eq(teams.organizationId, ctx.organizationId))
    );
});

/**
 * Teams to actually render for a manager, including ones they only have
 * access to via individual employee assignments (a sub-manager who owns a
 * slice of one team, not the whole team) -- ctx.assignedTeamIds alone misses
 * these, since a manager can have employees on a team without being assigned
 * that team wholesale.
 */
export async function getVisibleTeamsForManager(
  ctx: ManagerContext,
  assignedEmployees: { primaryTeamId: string | null }[]
) {
  const employeeTeamIds = assignedEmployees
    .map((e) => e.primaryTeamId)
    .filter((id): id is string => id !== null);
  const allIds = [...new Set([...ctx.assignedTeamIds, ...employeeTeamIds])];
  if (allIds.length === 0) return [];
  return db
    .select()
    .from(teams)
    .where(and(inArray(teams.id, allIds), eq(teams.organizationId, ctx.organizationId)));
}

export const getAssignedEmployees = cache(async function getAssignedEmployees(ctx: ManagerContext) {
  if (ctx.assignedEmployeeIds.length === 0) return [];
  return db
    .select()
    .from(employees)
    .where(
      and(
        inArray(employees.id, ctx.assignedEmployeeIds),
        eq(employees.employmentStatus, "active"),
        eq(employees.organizationId, ctx.organizationId)
      )
    );
});

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const user = await getActiveUserByEmail(email);
  return user?.id ?? null;
}

export interface AdminIdentity {
  userId: string;
  email: string;
  organizationId: string;
}

/**
 * Redirects to "/" unless the session belongs to an active platform admin.
 * Returns the admin's own identity (including organizationId) so callers can
 * scope their own queries/writes to it rather than reading/writing across
 * every organization.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const session = await auth();
  const email = session?.user?.email;
  const user = email ? await getActiveUserByEmail(email) : null;
  if (!user?.isPlatformAdmin) redirect("/");
  return { userId: user.id, email: user.email, organizationId: user.organizationId };
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
