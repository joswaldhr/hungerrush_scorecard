import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, employees, sourceRecords } from "@/lib/db/schema";
import {
  entraAccountReference,
  readEntraRoster,
  type DirectoryCredentials,
} from "@/lib/connectors/entra-roster";
import {
  DIRECTORY_RECORD,
  directoryStateSchema,
  directoryHealth,
  identityKey,
  rosterKey,
  type DirectoryState,
} from "./directory-state";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DirectoryConfig = { sourceId: string; credentials: DirectoryCredentials };
const recordWhere = (sourceId: string) =>
  and(
    eq(sourceRecords.dataSourceId, sourceId),
    eq(sourceRecords.externalRecordType, DIRECTORY_RECORD),
    eq(sourceRecords.externalRecordId, "latest")
  );
const cohort = (tx: Transaction, organizationId: string) =>
  tx
    .select({ id: employees.id, email: employees.email })
    .from(employees)
    .where(
      and(eq(employees.organizationId, organizationId), eq(employees.employmentStatus, "active"))
    )
    .limit(101);
async function writeState(tx: Transaction, sourceId: string, state: DirectoryState) {
  const values = {
    payloadJson: state,
    payloadHash: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    ingestedAt: new Date(),
  };
  await tx
    .insert(sourceRecords)
    .values({
      dataSourceId: sourceId,
      externalRecordType: DIRECTORY_RECORD,
      externalRecordId: "latest",
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        sourceRecords.dataSourceId,
        sourceRecords.externalRecordType,
        sourceRecords.externalRecordId,
      ],
      set: values,
    });
}

/** Writes directory-check evidence only. Source lock + expiring token protect overlapping workers. */
export async function runDirectoryCheck(config: DirectoryConfig, reader = readEntraRoster) {
  const reference = entraAccountReference(config.credentials.tenantId);
  const claim = await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, config.sourceId))
      .for("update");
    if (
      !source ||
      source.type !== "entra" ||
      source.status !== "configured" ||
      source.configurationReference !== reference
    )
      throw new Error("Directory source binding is invalid");
    const [record] = await tx.select().from(sourceRecords).where(recordWhere(source.id));
    const prior = record ? directoryStateSchema.parse(record.payloadJson) : null;
    if (prior && prior.accountReference !== reference)
      throw new Error("Directory observation binding changed");
    const now = new Date();
    if (
      prior &&
      ((prior.lease && Date.parse(prior.lease.expiresAt) > now.getTime()) ||
        now.getTime() - Date.parse(prior.lastAttemptAt) < 15 * 60000)
    )
      return null;
    const members = await cohort(tx, source.organizationId);
    const state: DirectoryState = {
      accountReference: reference,
      lastAttemptAt: now.toISOString(),
      outcome: "running",
      lease: { token: randomUUID(), expiresAt: new Date(now.getTime() + 5 * 60000).toISOString() },
      observation: prior?.observation ?? null,
    };
    await writeState(tx, source.id, state);
    return { source, state, members };
  });
  if (!claim) return { status: "deferred" as const };
  try {
    if (claim.members.length > 100) throw new Error("Directory cohort exceeds bounded capacity");
    const results = await reader(claim.members, config.credentials);
    // Readers must provide exactly one decision for every requested employee.
    if (
      results.length !== claim.members.length ||
      new Set(results.map((r) => r.employeeId)).size !== results.length ||
      results.some((r) => !claim.members.some((e) => e.id === r.employeeId))
    )
      throw new Error("Directory results incomplete");
    const next = directoryStateSchema.parse({
      ...claim.state,
      outcome: "completed",
      lease: null,
      observation: {
        observedAt: new Date().toISOString(),
        members: results.map((r) => ({
          ...r,
          identityKey: identityKey(claim.members.find((e) => e.id === r.employeeId)!),
        })),
      },
    });
    await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(dataSources)
        .where(eq(dataSources.id, config.sourceId))
        .for("update");
      if (
        !source ||
        source.type !== "entra" ||
        source.status !== "configured" ||
        source.organizationId !== claim.source.organizationId ||
        source.configurationReference !== reference
      )
        throw new Error("Directory source changed during check");
      const [record] = await tx.select().from(sourceRecords).where(recordWhere(source.id));
      const current = directoryStateSchema.parse(record?.payloadJson);
      if (
        current.lease?.token !== claim.state.lease!.token ||
        Date.parse(current.lease.expiresAt) <= Date.now()
      )
        throw new Error("Directory check expired");
      if (rosterKey(await cohort(tx, source.organizationId)) !== rosterKey(claim.members))
        throw new Error("Roster changed during directory check");
      await writeState(tx, source.id, next);
      // Retain observations separately from the latest health record; no metric freshness updates.
      await tx.insert(sourceRecords).values({
        dataSourceId: source.id,
        externalRecordType: "entra_roster_observation_v1",
        externalRecordId: claim.state.lease!.token,
        payloadJson: next,
        occurredAt: new Date(next.observation!.observedAt),
        payloadHash: createHash("sha256").update(JSON.stringify(next)).digest("hex"),
      });
    });
    return {
      status: "completed" as const,
      checked: results.length,
      conflicts: results.filter((r) => r.status !== "enabled").length,
    };
  } catch {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: dataSources.id })
        .from(dataSources)
        .where(eq(dataSources.id, config.sourceId))
        .for("update");
      const [record] = await tx.select().from(sourceRecords).where(recordWhere(config.sourceId));
      const current = directoryStateSchema.safeParse(record?.payloadJson);
      if (current.success && current.data.lease?.token === claim.state.lease!.token)
        await writeState(tx, config.sourceId, { ...current.data, outcome: "failed", lease: null });
    });
    return { status: "failed" as const };
  }
}

export type DirectoryReview = {
  health: "not_configured" | "unavailable" | "not_checked" | ReturnType<typeof directoryHealth>;
  observedAt: string | null;
  checked: number;
  total: number;
  rows: {
    employeeId: string;
    name: string;
    status: "disabled" | "not_found" | "ambiguous" | "missing_email" | "not_checked";
  }[];
};

/** Permission scope must come from authenticated server context. Reads retained evidence only. */
export async function getDirectoryReview(
  organizationId: string,
  employeeIds: string[] | "admin",
  binding: { sourceId: string; tenantId: string } | null,
  now = new Date()
): Promise<DirectoryReview> {
  const empty = (health: DirectoryReview["health"]): DirectoryReview => ({
    health,
    observedAt: null,
    checked: 0,
    total: 0,
    rows: [],
  });
  if (!binding) return empty("not_configured");
  try {
    const reference = entraAccountReference(binding.tenantId);
    const [source] = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.id, binding.sourceId),
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.type, "entra"),
          eq(dataSources.status, "configured"),
          eq(dataSources.configurationReference, reference)
        )
      );
    if (!source) return empty("unavailable");
    if (employeeIds !== "admin" && !employeeIds.length) return empty("not_checked");
    const members = await db
      .select({ id: employees.id, email: employees.email, name: employees.displayName })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, organizationId),
          eq(employees.employmentStatus, "active"),
          employeeIds === "admin" ? undefined : inArray(employees.id, employeeIds)
        )
      )
      .limit(101);
    if (members.length > 100) return empty("unavailable");
    const [record] = await db.select().from(sourceRecords).where(recordWhere(source.id));
    const state = record ? directoryStateSchema.parse(record.payloadJson) : null;
    if (state && state.accountReference !== reference) return empty("unavailable");
    const health = state ? directoryHealth(state, now) : "not_checked";
    if (health === "unavailable") return empty("unavailable");
    const observations = state?.observation?.members ?? [];
    if (new Set(observations.map((o) => o.employeeId)).size !== observations.length)
      return empty("unavailable");
    const rows: DirectoryReview["rows"] = [];
    let checked = 0;
    for (const employee of members) {
      const observation = observations.find(
        (o) => o.employeeId === employee.id && o.identityKey === identityKey(employee)
      );
      if (observation) checked++;
      if (observation?.status !== "enabled")
        rows.push({
          employeeId: employee.id,
          name: employee.name,
          status: observation?.status ?? "not_checked",
        });
    }
    return {
      health,
      observedAt: state?.observation?.observedAt ?? null,
      total: members.length,
      checked,
      rows,
    };
  } catch {
    return empty("unavailable");
  }
}
