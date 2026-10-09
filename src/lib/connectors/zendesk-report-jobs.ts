import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { shiftWeekStart, weekBoundsForDate } from "@/lib/utils";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import type { ReportEventScope } from "./zendesk-report-event-store";
import { parseSyncPeriod } from "./sync-period";

// Operational recovery records only: never normalized into employee metrics.
export const REPORT_JOB_RECORD = "zendesk_report_job_v1";
const hash = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
const dateTime = z.iso.datetime();
const definitionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("collection"), policyHash: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict(),
  z
    .object({
      kind: z.enum(["updater", "assignee-solved", "csat", "legacy-sync", "first-reply"]),
      policyHash: z.string().regex(/^[a-f0-9]{64}$/),
      periodStart: z.iso.date(),
      periodEnd: z.iso.date(),
    })
    .strict(),
]);
export type ReportJobDefinition = z.infer<typeof definitionSchema>;
export const reportJobStateSchema = z
  .object({
    version: z.literal(1),
    accountReference: z.string(),
    definition: definitionSchema,
    desiredAt: dateTime,
    completedThrough: dateTime.nullable(),
    notBefore: dateTime,
    lastAttemptAt: dateTime.nullable(),
    lastSyncRunId: z.uuid().nullable().default(null),
    lastCollectedPages: z.number().int().min(0).max(20).nullable().default(null),
    attempts: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
    lastOutcome: z.enum(["pending", "running", "complete", "deferred", "failed", "interrupted"]),
    lease: z
      .object({ token: z.uuid(), expiresAt: dateTime, desiredAt: dateTime })
      .strict()
      .nullable(),
  })
  .strict();
type State = z.infer<typeof reportJobStateSchema>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const selector = (scope: ReportEventScope) =>
  and(
    eq(sourceRecords.dataSourceId, scope.dataSourceId),
    eq(sourceRecords.externalRecordType, REPORT_JOB_RECORD)
  );

function definition(input: unknown, now: Date) {
  const parsed = definitionSchema.parse(input);
  if (parsed.kind !== "collection")
    parseSyncPeriod({ periodStart: parsed.periodStart, periodEnd: parsed.periodEnd }, now);
  return parsed;
}
function key(d: ReportJobDefinition) {
  // A policy change creates different work. The dispatcher must only claim its current policy.
  return hash(d);
}
async function lock(tx: Tx, scope: ReportEventScope) {
  if (!isZendeskAccountReference(scope.accountReference)) throw Error("Invalid report job account");
  await tx.execute(
    sql`select set_config('lock_timeout','3000',true),set_config('statement_timeout','20000',true)`
  );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${scope.accountReference},0))`
  );
  const [source] = await tx.execute(sql`
    select * from ${dataSources} where id=${scope.dataSourceId} for update
  `);
  if (
    !source ||
    source.organization_id !== scope.organizationId ||
    source.type !== "zendesk" ||
    source.status !== "configured" ||
    source.configuration_reference !== scope.accountReference
  )
    throw Error("Report job source binding changed or disabled");
  const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
  return new Date(clock!.now);
}
async function put(tx: Tx, scope: ReportEventScope, state: State) {
  const values = {
    dataSourceId: scope.dataSourceId,
    externalRecordType: REPORT_JOB_RECORD,
    externalRecordId: key(state.definition),
    payloadJson: state,
    payloadHash: hash(state),
    ingestedAt: new Date(),
  };
  await tx
    .insert(sourceRecords)
    .values(values)
    .onConflictDoUpdate({
      target: [
        sourceRecords.dataSourceId,
        sourceRecords.externalRecordType,
        sourceRecords.externalRecordId,
      ],
      set: values,
    });
}
function readState(payload: unknown, scope: ReportEventScope) {
  const state = reportJobStateSchema.parse(payload);
  if (state.accountReference !== scope.accountReference) throw Error("Report job account changed");
  return state;
}

/** Coalesce duplicate/missed deliveries into the newest requested observation for fixed dates. */
export async function requestReportJobs(
  scope: ReportEventScope,
  requests: Array<{ definition: ReportJobDefinition; desiredAt: string }>
) {
  if (!requests.length || requests.length > 24) throw Error("Invalid report job request budget");
  return db.transaction(async (tx) => {
    const now = await lock(tx, scope);
    const parsed = requests.map((request) => {
      const desiredAt = dateTime.parse(request.desiredAt);
      if (Date.parse(desiredAt) > now.getTime())
        throw Error("Report job cannot request future observations");
      return { definition: definition(request.definition, now), desiredAt };
    });
    if (new Set(parsed.map((r) => key(r.definition))).size !== parsed.length)
      throw Error("Duplicate report jobs in request");
    for (const request of parsed) {
      const [row] = await tx
        .select()
        .from(sourceRecords)
        .where(and(selector(scope), eq(sourceRecords.externalRecordId, key(request.definition))));
      if (row) {
        const current = readState(row.payloadJson, scope);
        if (Date.parse(request.desiredAt) > Date.parse(current.desiredAt))
          await put(tx, scope, { ...current, desiredAt: request.desiredAt });
      } else {
        await put(tx, scope, {
          version: 1,
          accountReference: scope.accountReference,
          definition: request.definition,
          desiredAt: request.desiredAt,
          completedThrough: null,
          notBefore: now.toISOString(),
          lastAttemptAt: null,
          lastSyncRunId: null,
          lastCollectedPages: null,
          attempts: 0,
          failures: 0,
          lastOutcome: "pending",
          lease: null,
        });
      }
    }
  });
}

export interface ClaimedReportJob {
  definition: ReportJobDefinition;
  token: string;
  desiredAt: string;
  expiresAt: string;
}
export type ReportJobOutcome = (
  { status: "complete" } | { status: "deferred" | "failed"; retryAt?: string }
) & { syncRunId?: string; collectedPages?: number };

/** One bounded dispatcher owner per Zendesk account, including across Cadence sources. */
export async function claimReportJob(
  scope: ReportEventScope,
  currentPolicyHashes: string[]
): Promise<ClaimedReportJob | null> {
  if (
    !currentPolicyHashes.length ||
    currentPolicyHashes.length > 6 ||
    currentPolicyHashes.some((h) => !/^[a-f0-9]{64}$/.test(h))
  )
    throw Error("Invalid job policy allowlist");
  return db.transaction(async (tx) => {
    const now = await lock(tx, scope);
    const active = await tx.execute(sql`
      select id from ${sourceRecords}
      where external_record_type=${REPORT_JOB_RECORD}
        and payload_json->>'accountReference'=${scope.accountReference}
        and payload_json->'lease' is not null and payload_json->'lease' <> 'null'::jsonb
        and (payload_json->'lease'->>'expiresAt' is null
          or (payload_json->'lease'->>'expiresAt')::timestamptz > clock_timestamp())
      limit 1
    `);
    if (active.length) return null;
    // Inactive policies may belong to a newer worker. Retain them without decoding
    // their payload; the account-wide lease check above still fences their owners.
    const rows = await tx
      .select()
      .from(sourceRecords)
      .where(
        and(
          selector(scope),
          sql`${sourceRecords.payloadJson}->'definition'->>'policyHash' in (${sql.join(
            currentPolicyHashes.map((h) => sql`${h}`),
            sql`, `
          )})`
        )
      );
    const states = rows.map((r) => readState(r.payloadJson, scope));
    const eligible = states.filter(
      (s) =>
        currentPolicyHashes.includes(s.definition.policyHash) &&
        (s.completedThrough === null || Date.parse(s.completedThrough) < Date.parse(s.desiredAt)) &&
        Date.parse(s.notBefore) <= now.getTime()
    );
    const thisWeek = weekBoundsForDate(now.toISOString().slice(0, 10)).periodStart;
    const lastWeek = shiftWeekStart(thisWeek, -1);
    const reviewPriority = (s: State) =>
      s.definition.kind === "collection"
        ? 0
        : s.definition.periodStart === lastWeek
          ? 0
          : s.definition.periodStart === thisWeek
            ? 1
            : 2;
    // Collection continuation first; oldest attempt next. Prefer the 1:1 review for equal demand.
    eligible.sort(
      (a, b) =>
        Number(b.definition.kind === "collection") - Number(a.definition.kind === "collection") ||
        Date.parse(a.lastAttemptAt ?? a.desiredAt) - Date.parse(b.lastAttemptAt ?? b.desiredAt) ||
        reviewPriority(a) - reviewPriority(b) ||
        key(a.definition).localeCompare(key(b.definition))
    );
    const selected = eligible[0];
    if (!selected) return null;
    const lease = {
      token: randomUUID(),
      expiresAt: new Date(now.getTime() + 600000).toISOString(),
      desiredAt: selected.desiredAt,
    };
    await put(tx, scope, {
      ...selected,
      attempts: selected.attempts + 1,
      lastAttemptAt: now.toISOString(),
      lastOutcome: selected.lease ? "interrupted" : "running",
      lease,
    });
    return { definition: selected.definition, ...lease };
  });
}

/** Fenced acknowledgement: a late worker cannot erase a newer request or release its successor. */
export async function finishReportJob(
  scope: ReportEventScope,
  claimed: ClaimedReportJob,
  result: ReportJobOutcome
) {
  z.enum(["complete", "deferred", "failed"]).parse(result.status);
  if (result.syncRunId !== undefined) z.uuid().parse(result.syncRunId);
  if (result.collectedPages !== undefined)
    z.number().int().min(0).max(20).parse(result.collectedPages);
  return db.transaction(async (tx) => {
    const now = await lock(tx, scope);
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(and(selector(scope), eq(sourceRecords.externalRecordId, key(claimed.definition))));
    if (!row) throw Error("Report job is missing");
    const current = readState(row.payloadJson, scope);
    if (
      !current.lease ||
      current.lease.token !== claimed.token ||
      current.lease.desiredAt !== claimed.desiredAt ||
      Date.parse(current.lease.expiresAt) <= now.getTime()
    )
      throw Error("Report job ownership expired or changed");
    const failures =
      result.status === "failed"
        ? current.failures + 1
        : result.status === "complete"
          ? 0
          : current.failures;
    const minimumDelay =
      result.status === "failed"
        ? Math.min(21600000, 300000 * 2 ** Math.min(failures - 1, 7))
        : 30000;
    const requestedRetry =
      result.status !== "complete" && result.retryAt
        ? Date.parse(dateTime.parse(result.retryAt))
        : 0;
    // A valid vendor delay must not be shortened to our own backoff or one day.
    await put(tx, scope, {
      ...current,
      lease: null,
      failures,
      lastOutcome: result.status,
      lastSyncRunId: result.syncRunId ?? null,
      lastCollectedPages: result.collectedPages ?? null,
      completedThrough: result.status === "complete" ? claimed.desiredAt : current.completedThrough,
      notBefore:
        result.status === "complete"
          ? now.toISOString()
          : new Date(Math.max(now.getTime() + minimumDelay, requestedRetry)).toISOString(),
    });
  });
}
