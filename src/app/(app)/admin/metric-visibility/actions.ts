"use server";

import { requireAdmin } from "@/lib/auth/authorization";
import { assertOrganizationResource, organizationMetricIds } from "@/lib/auth/organization-scope";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  metricVisibilityOverrides,
  teamMemberships,
  managerAssignments,
  employees,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  const { userId: hiddenBy, organizationId } = await requireAdmin();
  input = z
    .object({
      scope: z.enum(["global_default", "manager_override", "scorecard_override"]),
      managerUserId: z.uuid().nullable(),
      targetEmployeeId: z.uuid().nullable(),
      metricDefinitionId: z.uuid(),
      teamId: z.uuid().nullable(),
      line: z.string().max(100).nullable(),
      hidden: z.boolean(),
    })
    .parse(input);
  if (
    (input.scope === "global_default" && (input.managerUserId || input.targetEmployeeId)) ||
    (input.scope === "manager_override" && (!input.managerUserId || input.targetEmployeeId)) ||
    (input.scope === "scorecard_override" && (!input.targetEmployeeId || input.managerUserId))
  )
    throw new Error("Invalid visibility scope");
  await assertOrganizationResource(organizationId, "metric", input.metricDefinitionId);
  if (input.managerUserId)
    await assertOrganizationResource(organizationId, "user", input.managerUserId);
  if (input.targetEmployeeId)
    await assertOrganizationResource(organizationId, "employee", input.targetEmployeeId);
  if (input.teamId) await assertOrganizationResource(organizationId, "team", input.teamId);

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
      .where(
        and(
          eq(metricVisibilityOverrides.id, existing[0].id),
          inArray(
            metricVisibilityOverrides.metricDefinitionId,
            organizationMetricIds(organizationId)
          )
        )
      );
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
  revalidatePath("/one-on-ones");
}

export async function removeVisibilityOverride(formData: FormData): Promise<void> {
  const { organizationId } = await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;

  await db
    .delete(metricVisibilityOverrides)
    .where(
      and(
        eq(metricVisibilityOverrides.id, id),
        inArray(metricVisibilityOverrides.metricDefinitionId, organizationMetricIds(organizationId))
      )
    );

  revalidatePath("/admin/metric-visibility");
  revalidatePath("/one-on-ones");
}

/**
 * Count of scorecards (active team members) affected if a metric were hidden
 * for every employee this manager has assigned to them -- shown in the
 * confirmation dialog before a manager-wide bulk hide commits.
 */
export async function getManagerScorecardCount(managerUserId: string): Promise<number> {
  const { organizationId } = await requireAdmin();
  await assertOrganizationResource(organizationId, "user", managerUserId);

  const assignments = await db
    .select()
    .from(managerAssignments)
    .where(
      and(
        eq(managerAssignments.managerUserId, managerUserId),
        isNull(managerAssignments.effectiveTo)
      )
    );

  const teamIds = assignments.filter((a) => a.teamId !== null).map((a) => a.teamId!);
  const directEmployeeIds = assignments
    .filter((a) => a.employeeId !== null)
    .map((a) => a.employeeId!);

  let teamEmployeeIds: string[] = [];
  if (teamIds.length > 0) {
    const memberships = await db
      .select({ employeeId: teamMemberships.employeeId })
      .from(teamMemberships)
      .where(and(inArray(teamMemberships.teamId, teamIds), isNull(teamMemberships.effectiveTo)));
    teamEmployeeIds = memberships.map((m) => m.employeeId);
  }

  const allEmployeeIds = [...new Set([...teamEmployeeIds, ...directEmployeeIds])];
  if (allEmployeeIds.length === 0) return 0;

  // Match getAssignedEmployees' convention -- don't count a since-deactivated
  // employee toward "scorecards affected", or the confirmation dialog
  // overstates the real impact of a bulk hide.
  const activeEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        inArray(employees.id, allEmployeeIds),
        eq(employees.employmentStatus, "active"),
        eq(employees.organizationId, organizationId)
      )
    );

  return activeEmployees.length;
}
