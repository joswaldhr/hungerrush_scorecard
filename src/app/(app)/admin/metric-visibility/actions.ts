"use server";

import { requireAdmin, getManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { assertOrganizationResource, organizationMetricIds } from "@/lib/auth/organization-scope";
import { z } from "zod";
import { db } from "@/lib/db";
import { metricVisibilityOverrides, metricDefinitions, users } from "@/lib/db/schema";
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

  await db.transaction(async (tx) => {
    // Nullable scope columns do not enforce uniqueness in the legacy index.
    // Lock the parent metric so concurrent application writers share one decision.
    const [metric] = await tx
      .select({ id: metricDefinitions.id })
      .from(metricDefinitions)
      .where(
        and(
          eq(metricDefinitions.id, input.metricDefinitionId),
          eq(metricDefinitions.organizationId, organizationId)
        )
      )
      .for("update");
    if (!metric) throw new Error("Metric not permitted");
    const existing = await tx
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
          input.line !== null
            ? eq(metricVisibilityOverrides.line, input.line)
            : isNull(metricVisibilityOverrides.line)
        )
      );

    if (existing.length > 1) throw new Error("Duplicate visibility rules require review");

    if (existing[0]) {
      await tx
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
      await tx.insert(metricVisibilityOverrides).values({
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
  });

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

  const [manager] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, managerUserId), eq(users.organizationId, organizationId)))
    .limit(1);
  if (!manager) return 0;
  const ctx = await getManagerContext(manager.email);
  if (!ctx) return 0;
  return (await getAssignedEmployees(ctx)).length;
}
