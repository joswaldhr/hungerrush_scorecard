"use server";

import { requireAdmin } from "@/lib/auth/authorization";
import { assertOrganizationResource, organizationSourceIds } from "@/lib/auth/organization-scope";
import { db } from "@/lib/db";
import {
  rosterSourceTeamMappings,
  rosterCandidates,
  employees,
  externalIdentities,
  teamMemberships,
  dataSources,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZendeskConnector } from "@/lib/connectors";
import type { Connector } from "@/lib/connectors";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";

const CONNECTORS: Record<string, () => Connector> = {
  zendesk: () => new ZendeskConnector(),
};

export async function addGroupMapping(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const dataSourceId = formData.get("dataSourceId") as string;
  const externalGroupId = (formData.get("externalGroupId") as string)?.trim();
  const externalGroupLabel = (formData.get("externalGroupLabel") as string)?.trim();
  const teamId = formData.get("teamId") as string;

  if (!dataSourceId || !externalGroupId || !externalGroupLabel || !teamId) return;
  await assertOrganizationResource(organizationId, "source", dataSourceId);
  await assertOrganizationResource(organizationId, "team", teamId);

  await db.insert(rosterSourceTeamMappings).values({
    dataSourceId,
    externalGroupId,
    externalGroupLabel,
    teamId,
  });

  revalidatePath("/admin/roster-review");
}

export async function removeGroupMapping(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const mappingId = formData.get("mappingId") as string;
  if (!mappingId) return;

  await db
    .delete(rosterSourceTeamMappings)
    .where(
      and(
        eq(rosterSourceTeamMappings.id, mappingId),
        inArray(rosterSourceTeamMappings.dataSourceId, organizationSourceIds(organizationId))
      )
    );

  revalidatePath("/admin/roster-review");
}

export async function runRosterDiscovery(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const dataSourceId = formData.get("dataSourceId") as string;
  if (!dataSourceId) return;
  const [source] = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.id, dataSourceId), eq(dataSources.organizationId, organizationId)));
  if (!source) throw new Error("Resource not found or not permitted");
  const connectorFactory = CONNECTORS[source.type];
  if (!connectorFactory) return;

  await discoverRosterCandidates(connectorFactory(), dataSourceId);

  revalidatePath("/admin/roster-review");
}

export async function approveNewCandidate(formData: FormData) {
  const { organizationId, userId } = await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  const teamId = (formData.get("teamId") as string) || null;
  if (!candidateId) return;

  await db.transaction(async (tx) => {
    if (teamId) await assertOrganizationResource(organizationId, "team", teamId, tx);
    const [candidate] = await tx
      .select()
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.id, candidateId),
          inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
        )
      )
      .for("update");
    if (!candidate || candidate.status !== "pending" || candidate.changeType !== "new") return;

    const [employee] = await tx
      .insert(employees)
      .values({
        organizationId,
        displayName:
          candidate.externalDisplayName ?? candidate.externalEmail ?? candidate.externalId,
        email: candidate.externalEmail,
        primaryTeamId: teamId,
      })
      .returning();

    if (employee) {
      await tx.insert(externalIdentities).values({
        employeeId: employee.id,
        dataSourceId: candidate.dataSourceId,
        externalEntityType: "agent",
        externalId: candidate.externalId,
        externalEmail: candidate.externalEmail,
        externalDisplayName: candidate.externalDisplayName,
        matchMethod: "roster_discovery",
        matchConfidence: 1,
      });

      if (teamId) {
        await tx.insert(teamMemberships).values({
          employeeId: employee.id,
          teamId,
          effectiveFrom: new Date().toISOString().split("T")[0]!,
        });
      }
    }

    await tx
      .update(rosterCandidates)
      .set({ status: "approved", reviewedAt: new Date(), reviewedBy: userId })
      .where(
        and(
          eq(rosterCandidates.id, candidateId),
          inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
        )
      );
  });

  revalidatePath("/admin/roster-review");
  revalidatePath("/admin/employees");
}

export async function approveDeparture(formData: FormData) {
  const { organizationId, userId } = await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  if (!candidateId) return;

  await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.id, candidateId),
          inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
        )
      )
      .for("update");
    if (!candidate || candidate.status !== "pending" || candidate.changeType !== "departed") return;
    if (!candidate.employeeId) return;
    await assertOrganizationResource(organizationId, "employee", candidate.employeeId, tx);

    const today = new Date().toISOString().split("T")[0]!;

    await tx
      .update(employees)
      .set({ employmentStatus: "inactive", updatedAt: new Date() })
      .where(
        and(eq(employees.id, candidate.employeeId), eq(employees.organizationId, organizationId))
      );

    await tx
      .update(teamMemberships)
      .set({ effectiveTo: today })
      .where(
        and(
          eq(teamMemberships.employeeId, candidate.employeeId),
          isNull(teamMemberships.effectiveTo)
        )
      );

    await tx
      .update(rosterCandidates)
      .set({ status: "approved", reviewedAt: new Date(), reviewedBy: userId })
      .where(
        and(
          eq(rosterCandidates.id, candidateId),
          inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
        )
      );
  });

  revalidatePath("/admin/roster-review");
  revalidatePath("/admin/employees");
}

export async function rejectCandidate(formData: FormData) {
  const { organizationId, userId } = await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  if (!candidateId) return;

  await db
    .update(rosterCandidates)
    .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: userId })
    .where(
      and(
        eq(rosterCandidates.id, candidateId),
        eq(rosterCandidates.status, "pending"),
        inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
      )
    );

  revalidatePath("/admin/roster-review");
}

// The only way back for a candidate rejected by mistake -- discoverRosterCandidates treats
// any prior row for an identity (any status) as "already seen" and will never re-propose it,
// by design (a human's decision should stick). Deliberately does not touch approved/
// auto_approved rows: those already created a real employee/identity/membership, and
// resetting just this row's status would be misleading -- undoing an approval means
// deactivating the employee via /admin/employees, a different operation.
export async function restoreRejectedCandidate(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  if (!candidateId) return;

  await db
    .update(rosterCandidates)
    .set({ status: "pending", reviewedAt: null, reviewedBy: null })
    .where(
      and(
        eq(rosterCandidates.id, candidateId),
        eq(rosterCandidates.status, "rejected"),
        inArray(rosterCandidates.dataSourceId, organizationSourceIds(organizationId))
      )
    );

  revalidatePath("/admin/roster-review");
}
