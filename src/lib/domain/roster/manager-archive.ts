import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  employees,
  managerAssignments,
  managerRosterArchives,
  teamMemberships,
  teams,
  users,
} from "@/lib/db/schema";
import type { ManagerContext } from "@/lib/auth/authorization";

const decisionSchema = z.object({
  organizationId: z.uuid(),
  actorId: z.uuid(),
  managerId: z.uuid(),
  employeeId: z.uuid(),
  action: z.enum(["archive", "restore"]),
  reason: z.string().trim().min(5).max(500),
  // Compare-and-set prevents an old tab from restoring a newer archive decision.
  archiveId: z.uuid().optional(),
});

/** Called only with server-authenticated actor/manager identities. Rechecks scope under lock. */
export async function changeManagerArchive(input: z.input<typeof decisionSchema>) {
  const decision = decisionSchema.parse(input);
  const { organizationId, actorId, managerId, employeeId, reason } = decision;
  return db.transaction(async (tx) => {
    const people = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          inArray(users.id, [...new Set([actorId, managerId])]),
          eq(users.status, "active")
        )
      )
      .orderBy(users.id)
      .for("update");
    const actor = people.find((u) => u.id === actorId);
    if (
      !actor ||
      !people.some((u) => u.id === managerId) ||
      (actorId !== managerId && !actor.isPlatformAdmin)
    )
      throw new Error("Roster change not permitted");
    const [employee] = await tx
      .select()
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
      .for("update");
    if (!employee) throw new Error("Roster change not permitted");
    const today = new Date().toISOString().slice(0, 10);
    const assignments = await tx
      .select()
      .from(managerAssignments)
      .where(
        and(
          eq(managerAssignments.managerUserId, managerId),
          lte(managerAssignments.effectiveFrom, today),
          or(isNull(managerAssignments.effectiveTo), gt(managerAssignments.effectiveTo, today))
        )
      )
      .for("share");
    const memberships = await tx
      .select({ teamId: teamMemberships.teamId })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(
        and(
          eq(teamMemberships.employeeId, employeeId),
          eq(teams.organizationId, organizationId),
          lte(teamMemberships.effectiveFrom, today),
          or(isNull(teamMemberships.effectiveTo), gt(teamMemberships.effectiveTo, today))
        )
      )
      .for("share");
    if (
      !assignments.some(
        (a) => a.employeeId === employeeId || memberships.some((m) => a.teamId === m.teamId)
      )
    )
      throw new Error("Roster change not permitted");
    const scope = and(
      eq(managerRosterArchives.organizationId, organizationId),
      eq(managerRosterArchives.managerUserId, managerId),
      eq(managerRosterArchives.employeeId, employeeId),
      isNull(managerRosterArchives.restoredAt)
    );
    const [existing] = await tx.select().from(managerRosterArchives).where(scope).for("update");
    if (decision.action === "archive") {
      if (existing) return { status: "already_archived" as const, id: existing.id };
      if (employee.employmentStatus !== "active") throw new Error("Employee is not active");
      const [created] = await tx
        .insert(managerRosterArchives)
        .values({
          organizationId,
          managerUserId: managerId,
          employeeId,
          effectiveFrom: today,
          reason,
          archivedBy: actorId,
        })
        .returning({ id: managerRosterArchives.id });
      return { status: "archived" as const, id: created!.id };
    }
    if (!existing || existing.id !== decision.archiveId)
      throw new Error("Archive changed; refresh before restoring");
    if (employee.employmentStatus !== "active") throw new Error("Employee is not active");
    await tx
      .update(managerRosterArchives)
      .set({ restoredAt: new Date(), restoredBy: actorId, restoreReason: reason })
      .where(scope);
    return { status: "restored" as const, id: existing.id };
  });
}

/** Archives do not grant access: intersect with the caller's current authorization scope. */
export async function getManagerArchives(ctx: ManagerContext) {
  if (!ctx.assignedEmployeeIds.length) return [];
  return db
    .select({
      id: managerRosterArchives.id,
      employeeId: managerRosterArchives.employeeId,
      effectiveFrom: managerRosterArchives.effectiveFrom,
      reason: managerRosterArchives.reason,
    })
    .from(managerRosterArchives)
    .innerJoin(employees, eq(employees.id, managerRosterArchives.employeeId))
    .where(
      and(
        eq(managerRosterArchives.organizationId, ctx.organizationId),
        eq(employees.organizationId, ctx.organizationId),
        eq(managerRosterArchives.managerUserId, ctx.userId),
        inArray(managerRosterArchives.employeeId, ctx.assignedEmployeeIds),
        isNull(managerRosterArchives.restoredAt),
        lte(managerRosterArchives.effectiveFrom, new Date().toISOString().slice(0, 10))
      )
    );
}
