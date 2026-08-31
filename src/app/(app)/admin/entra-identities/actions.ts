"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { externalIdentities, dataSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { EntraClient } from "@/lib/connectors/entra";
import type { EntraCandidate } from "@/lib/connectors/entra";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !(await isPlatformAdmin(session.user.email))) {
    redirect("/");
  }
}

async function getEntraDataSourceId(): Promise<string> {
  const [source] = await db.select({ id: dataSources.id }).from(dataSources).where(eq(dataSources.type, "entra"));
  if (!source) throw new Error("Entra data source not configured");
  return source.id;
}

export async function searchEntraCandidates(displayName: string): Promise<EntraCandidate[]> {
  await requireAdmin();
  if (!displayName?.trim()) return [];
  const client = new EntraClient();
  return client.searchByName(displayName.trim());
}

export async function confirmEntraMatch(formData: FormData) {
  await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  const objectId = formData.get("objectId") as string;
  const displayName = formData.get("displayName") as string;
  const mail = (formData.get("mail") as string) || null;
  const userPrincipalName = formData.get("userPrincipalName") as string;
  if (!employeeId || !objectId) return;

  const entraDataSourceId = await getEntraDataSourceId();

  await db.insert(externalIdentities).values({
    employeeId,
    dataSourceId: entraDataSourceId,
    externalEntityType: "user",
    externalId: objectId,
    externalEmail: mail,
    externalDisplayName: displayName,
    matchMethod: "name_search",
    matchConfidence: 1,
    verifiedAt: new Date(),
    metadataJson: { userPrincipalName },
  });

  revalidatePath("/admin/entra-identities");
}

export async function markNoEntraMatch(formData: FormData) {
  await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  if (!employeeId) return;

  const entraDataSourceId = await getEntraDataSourceId();

  await db.insert(externalIdentities).values({
    employeeId,
    dataSourceId: entraDataSourceId,
    externalEntityType: "user",
    externalId: `no-entra-account:${employeeId}`,
    externalEmail: null,
    externalDisplayName: null,
    matchMethod: "confirmed_no_match",
    matchConfidence: 0,
    verifiedAt: new Date(),
  });

  revalidatePath("/admin/entra-identities");
}
