"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  rosterSourceTeamMappings,
  rosterCandidates,
  employees,
  externalIdentities,
  teamMemberships,
  dataSources,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ZendeskConnector, AssembledConnector } from "@/lib/connectors";
import type { Connector } from "@/lib/connectors";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";

const CONNECTORS: Record<string, () => Connector> = {
  zendesk: () => new ZendeskConnector(),
  assembled: () => new AssembledConnector(),
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !(await isPlatformAdmin(session.user.email))) {
    redirect("/");
  }
  return session!.user!.email!;
}

export async function addGroupMapping(formData: FormData) {
  await requireAdmin();

  const dataSourceId = formData.get("dataSourceId") as string;
  const externalGroupId = (formData.get("externalGroupId") as string)?.trim();
  const externalGroupLabel = (formData.get("externalGroupLabel") as string)?.trim();
  const teamId = formData.get("teamId") as string;

  if (!dataSourceId || !externalGroupId || !externalGroupLabel || !teamId) return;

  await db.insert(rosterSourceTeamMappings).values({
    dataSourceId,
    externalGroupId,
    externalGroupLabel,
    teamId,
  });

  revalidatePath("/admin/roster-review");
}

export async function removeGroupMapping(formData: FormData) {
  await requireAdmin();

  const mappingId = formData.get("mappingId") as string;
  if (!mappingId) return;

  await db.delete(rosterSourceTeamMappings).where(eq(rosterSourceTeamMappings.id, mappingId));

  revalidatePath("/admin/roster-review");
}

export async function runRosterDiscovery(formData: FormData) {
  await requireAdmin();

  const dataSourceId = formData.get("dataSourceId") as string;
  const dataSourceType = formData.get("dataSourceType") as string;
  const connectorFactory = CONNECTORS[dataSourceType];
  if (!dataSourceId || !connectorFactory) return;

  await discoverRosterCandidates(connectorFactory(), dataSourceId);

  revalidatePath("/admin/roster-review");
}

export async function approveNewCandidate(formData: FormData) {
  await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  const teamId = (formData.get("teamId") as string) || null;
  if (!candidateId) return;

  const [candidate] = await db
    .select()
    .from(rosterCandidates)
    .where(eq(rosterCandidates.id, candidateId));
  if (!candidate || candidate.status !== "pending" || candidate.changeType !== "new") return;

  const [source] = await db
    .select({ organizationId: dataSources.organizationId })
    .from(dataSources)
    .where(eq(dataSources.id, candidate.dataSourceId));
  if (!source) return;

  const [employee] = await db
    .insert(employees)
    .values({
      organizationId: source.organizationId,
      displayName: candidate.externalDisplayName ?? candidate.externalEmail ?? candidate.externalId,
      email: candidate.externalEmail,
      primaryTeamId: teamId,
    })
    .returning();

  if (employee) {
    await db.insert(externalIdentities).values({
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
      await db.insert(teamMemberships).values({
        employeeId: employee.id,
        teamId,
        effectiveFrom: new Date().toISOString().split("T")[0]!,
      });
    }
  }

  await db
    .update(rosterCandidates)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(rosterCandidates.id, candidateId));

  revalidatePath("/admin/roster-review");
  revalidatePath("/admin/employees");
}

export async function approveDeparture(formData: FormData) {
  await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  if (!candidateId) return;

  const [candidate] = await db
    .select()
    .from(rosterCandidates)
    .where(eq(rosterCandidates.id, candidateId));
  if (!candidate || candidate.status !== "pending" || candidate.changeType !== "departed") return;
  if (!candidate.employeeId) return;

  const today = new Date().toISOString().split("T")[0]!;

  await db
    .update(employees)
    .set({ employmentStatus: "inactive", updatedAt: new Date() })
    .where(eq(employees.id, candidate.employeeId));

  await db
    .update(teamMemberships)
    .set({ effectiveTo: today })
    .where(
      and(eq(teamMemberships.employeeId, candidate.employeeId), isNull(teamMemberships.effectiveTo))
    );

  await db
    .update(rosterCandidates)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(rosterCandidates.id, candidateId));

  revalidatePath("/admin/roster-review");
  revalidatePath("/admin/employees");
}

export async function rejectCandidate(formData: FormData) {
  await requireAdmin();

  const candidateId = formData.get("candidateId") as string;
  if (!candidateId) return;

  await db
    .update(rosterCandidates)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(eq(rosterCandidates.id, candidateId));

  revalidatePath("/admin/roster-review");
}
