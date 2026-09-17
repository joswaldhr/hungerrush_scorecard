"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin, getUserIdByEmail } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { metricVisibilityOverrides, teamMemberships, managerAssignments } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email || !(await isPlatformAdmin(session.user.email))) {
    redirect("/");
  }
  return session!.user!.email!;
}

export interface SetVisibilityInput {
  scope: "global_default" | "manager_override" | "scorecard_override";
  managerUserId: string | null;
  targetEmployeeId: string | null;
  metricDefinitionId: string;
  teamId: string | null;
  line: string | null;
  hidden: boolean;
}

export async function setVisibilityOverride(input: SetVisibilityInput): Promise<void> {
  const email = await requireAdmin();
  const hiddenBy = await getUserIdByEmail(email);
  if (!hiddenBy) redirect("/");

  const existing = await db
    .select({ id: metricVisibilityOverrides.id })
    .from(metricVisibilityOverrides)
    .where(
      and(
        eq(metricVisibilityOverrides.scope, input.scope),
        input.managerUserId
          ? eq(metricVisibilityOverrides.managerUserId, input.managerUserId)
          : isNull(metricVisibilityOverrides.managerUserId),
        input.targetEmployeeId
          ? eq(metricVisibilityOverrides.targetEmployeeId, input.targetEmployeeId)
          : isNull(metricVisibilityOverrides.targetEmployeeId),
        eq(metricVisibilityOverrides.metricDefinitionId, input.metricDefinitionId),
        input.teamId
          ? eq(metricVisibilityOverrides.teamId, input.teamId)
          : isNull(metricVisibilityOverrides.teamId),
        input.line
          ? eq(metricVisibilityOverrides.line, input.line)
          : isNull(metricVisibilityOverrides.line)
      )
    );

  if (existing[0]) {
    await db
      .update(metricVisibilityOverrides)
      .set({ hidden: input.hidden, hiddenBy, hiddenAt: new Date() })
      .where(eq(metricVisibilityOverrides.id, existing[0].id));
  } else {
    await db.insert(metricVisibilityOverrides).values({
      scope: input.scope,
      managerUserId: input.managerUserId,
      targetEmployeeId: input.targetEmployeeId,
      metricDefinitionId: input.metricDefinitionId,
      teamId: input.teamId,
      line: input.line,
      hidden: input.hidden,
      hiddenBy,
      hiddenAt: new Date(),
    });
  }

  revalidatePath("/admin/metric-visibility");
  revalidatePath("/team");
  revalidatePath("/one-on-ones");
}

export async function removeVisibilityOverride(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;

  await db.delete(metricVisibilityOverrides).where(eq(metricVisibilityOverrides.id, id));

  revalidatePath("/admin/metric-visibility");
  revalidatePath("/team");
  revalidatePath("/one-on-ones");
}

/**
 * Count of scorecards (active team members) affected if a metric were hidden
 * for every employee this manager has assigned to them -- shown in the
 * confirmation dialog before a manager-wide bulk hide commits.
 */
export async function getManagerScorecardCount(managerUserId: string): Promise<number> {
  await requireAdmin();

  const assignments = await db
    .select()
    .from(managerAssignments)
    .where(
      and(eq(managerAssignments.managerUserId, managerUserId), isNull(managerAssignments.effectiveTo))
    );

  const teamIds = assignments.filter((a) => a.teamId !== null).map((a) => a.teamId!);
  const directEmployeeIds = assignments.filter((a) => a.employeeId !== null).map((a) => a.employeeId!);

  let teamEmployeeIds: string[] = [];
  if (teamIds.length > 0) {
    const memberships = await db
      .select({ employeeId: teamMemberships.employeeId })
      .from(teamMemberships)
      .where(and(inArray(teamMemberships.teamId, teamIds), isNull(teamMemberships.effectiveTo)));
    teamEmployeeIds = memberships.map((m) => m.employeeId);
  }

  return new Set([...teamEmployeeIds, ...directEmployeeIds]).size;
}
