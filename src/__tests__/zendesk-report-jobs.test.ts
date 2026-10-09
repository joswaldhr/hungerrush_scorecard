// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, organizations, sourceRecords } from "@/lib/db/schema";
import {
  claimReportJob,
  finishReportJob,
  requestReportJobs,
  REPORT_JOB_RECORD,
  type ReportJobDefinition,
} from "@/lib/connectors/zendesk-report-jobs";

const organizationId = randomUUID(),
  source = randomUUID(),
  otherSource = randomUUID();
const accountReference = `zendesk-account:jobs-${randomUUID()}`;
const scope = { organizationId, dataSourceId: source, accountReference };
const second = { ...scope, dataSourceId: otherSource };
const policyHash = "a".repeat(64),
  otherPolicyHash = "b".repeat(64);
const definition: ReportJobDefinition = {
  kind: "updater",
  policyHash,
  periodStart: "2020-12-27",
  periodEnd: "2021-01-02",
};
const desiredAt = "2021-01-03T00:00:00.000Z";
const request = (d: ReportJobDefinition = definition, at = desiredAt) => ({
  definition: d,
  desiredAt: at,
});
async function rows() {
  return db
    .select()
    .from(sourceRecords)
    .where(inArray(sourceRecords.dataSourceId, [source, otherSource]));
}
async function claim(s = scope) {
  const claimed = await claimReportJob(s, [policyHash]);
  if (!claimed) throw Error("Expected a claimed synthetic job");
  return claimed;
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic recovery" });
  await db.insert(dataSources).values(
    [source, otherSource].map((id) => ({
      id,
      organizationId,
      type: "zendesk",
      displayName: "Synthetic recovery",
      status: "configured",
      configurationReference: accountReference,
    }))
  );
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(inArray(sourceRecords.dataSourceId, [source, otherSource]));
  await db
    .update(dataSources)
    .set({ status: "configured", configurationReference: accountReference })
    .where(inArray(dataSources.id, [source, otherSource]));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(inArray(sourceRecords.dataSourceId, [source, otherSource]));
  await db.delete(dataSources).where(inArray(dataSources.id, [source, otherSource]));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("coalesces duplicate delivery, acknowledges only the requested generation, and retains exact dates", async () => {
  await Promise.all([requestReportJobs(scope, [request()]), requestReportJobs(scope, [request()])]);
  expect(await rows()).toHaveLength(1);
  const owned = await claim();
  expect(owned.definition).toEqual(definition);
  expect(owned.desiredAt).toBe(desiredAt);
  await finishReportJob(scope, owned, { status: "complete" });
  await requestReportJobs(scope, [request()]);
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
});

it("does not lose newer demand arriving while an older attempt is running", async () => {
  await requestReportJobs(scope, [request()]);
  const first = await claim();
  const newer = "2021-01-04T00:00:00.000Z";
  await requestReportJobs(scope, [request(definition, newer)]);
  await finishReportJob(scope, first, { status: "complete" });
  const next = await claim();
  expect(next.desiredAt).toBe(newer);
  expect(next.definition).toEqual(first.definition);
  expect(next.token).not.toBe(first.token);
  await expect(finishReportJob(scope, first, { status: "complete" })).rejects.toThrow("ownership");
});

it("grants only one account owner across simultaneous deliveries and different sources", async () => {
  await requestReportJobs(scope, [request()]);
  await requestReportJobs(second, [request()]);
  const claims = await Promise.all([
    claimReportJob(scope, [policyHash]),
    claimReportJob(second, [policyHash]),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});

it("recovers a terminated invocation after expiry and fences the old acknowledgement", async () => {
  await requestReportJobs(scope, [request()]);
  const lost = await claim();
  await db.execute(sql`update source_records set payload_json=jsonb_set(payload_json,'{lease,expiresAt}',to_jsonb('2021-01-01T00:00:00.000Z'::text))
    where data_source_id=${source} and external_record_type=${REPORT_JOB_RECORD}`);
  const recovered = await claim();
  expect(recovered.token).not.toBe(lost.token);
  expect(recovered.definition).toEqual(lost.definition);
  expect((await rows())[0]?.payloadJson).toMatchObject({ attempts: 2, lastOutcome: "interrupted" });
  await expect(finishReportJob(scope, lost, { status: "complete" })).rejects.toThrow("ownership");
  await finishReportJob(scope, recovered, { status: "complete" });
});

it("persists cooldown without claiming work or erasing prior successful completion", async () => {
  await requestReportJobs(scope, [request()]);
  await finishReportJob(scope, await claim(), { status: "complete" });
  await requestReportJobs(scope, [request(definition, "2021-01-04T00:00:00.000Z")]);
  const next = await claim();
  const retryAt = new Date(Date.now() + 3600000).toISOString();
  await finishReportJob(scope, next, { status: "deferred", retryAt });
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
  expect((await rows())[0]?.payloadJson).toMatchObject({
    completedThrough: desiredAt,
    desiredAt: next.desiredAt,
    notBefore: retryAt,
    failures: 0,
    lease: null,
    lastOutcome: "deferred",
  });
});

it("backs off failures and retains the exact work for a later invocation", async () => {
  await requestReportJobs(scope, [request()]);
  await finishReportJob(scope, await claim(), { status: "failed" });
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
  const state = (await rows())[0]!.payloadJson as {
    notBefore: string;
    failures: number;
    completedThrough: null;
  };
  expect(state.failures).toBe(1);
  expect(state.completedThrough).toBeNull();
  expect(Date.parse(state.notBefore) - Date.now()).toBeGreaterThan(290000);
});

it("keeps work under a removed policy unclaimed instead of applying today's definition", async () => {
  await requestReportJobs(scope, [request()]);
  expect(await claimReportJob(scope, [otherPolicyHash])).toBeNull();
  expect(await rows()).toHaveLength(1);
});

it("retains CSAT dates, prior completion and vendor delays longer than one day", async () => {
  const csat: ReportJobDefinition = { ...definition, kind: "csat" };
  await requestReportJobs(scope, [request(csat)]);
  await finishReportJob(scope, await claim(), { status: "complete" });
  await requestReportJobs(scope, [request(csat, "2021-01-04T00:00:00.000Z")]);
  const next = await claim();
  const retryAt = new Date(Date.now() + 172800000).toISOString();
  await finishReportJob(scope, next, { status: "failed", retryAt });
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
  expect((await rows())[0]!.payloadJson).toMatchObject({
    definition: csat,
    completedThrough: desiredAt,
    notBefore: retryAt,
    failures: 1,
    lease: null,
    lastOutcome: "failed",
  });
});

it("leaves unknown inactive policies intact but honors their account-wide active leases", async () => {
  await requestReportJobs(scope, [request({ ...definition, policyHash: otherPolicyHash })]);
  const other = await claimReportJob(scope, [otherPolicyHash]);
  await db.execute(
    sql`update source_records set payload_json=jsonb_set(payload_json,'{definition,kind}',to_jsonb('future-kind'::text)) where data_source_id=${source}`
  );
  await requestReportJobs(scope, [request()]);
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
  await db.execute(
    sql`update source_records set payload_json=jsonb_set(payload_json,'{lease,expiresAt}',to_jsonb('2021-01-01T00:00:00.000Z'::text)) where data_source_id=${source} and payload_json->'definition'->>'policyHash'=${otherPolicyHash}`
  );
  expect((await claim()).definition).toEqual(definition);
  expect(other).not.toBeNull();
  expect(await rows()).toHaveLength(2);
});

it("prioritizes unfinished collection and fairly rotates deferred publishers", async () => {
  await requestReportJobs(scope, [
    request(),
    request({ kind: "collection", policyHash }),
    request({ ...definition, kind: "assignee-solved" }),
  ]);
  const collect = await claim();
  expect(collect.definition.kind).toBe("collection");
  await finishReportJob(scope, collect, { status: "deferred" });
  const publication = await claim();
  expect(publication.definition.kind).not.toBe("collection");
  await finishReportJob(scope, publication, { status: "deferred" });
  const another = await claim();
  expect(another.definition.kind).not.toBe(publication.definition.kind);
});

it("rejects invalid/future dates and duplicate jobs atomically", async () => {
  await expect(requestReportJobs(scope, [request(), request()])).rejects.toThrow("Duplicate");
  await expect(
    requestReportJobs(scope, [request(), request({ ...definition, periodEnd: "2021-01-03" })])
  ).rejects.toThrow();
  await expect(
    requestReportJobs(scope, [request(definition, "2999-01-01T00:00:00.000Z")])
  ).rejects.toThrow("future");
  expect(await rows()).toHaveLength(0);
});

it("rechecks source authorization on both claim and completion", async () => {
  await requestReportJobs(scope, [request()]);
  const owned = await claim();
  await db.update(dataSources).set({ status: "disabled" }).where(eq(dataSources.id, source));
  await expect(claim()).rejects.toThrow("binding");
  await expect(finishReportJob(scope, owned, { status: "complete" })).rejects.toThrow("binding");
  expect((await rows())[0]?.payloadJson).toMatchObject({ completedThrough: null });
});

it("persists a legacy retry and its original period through cooldown and a new worker", async () => {
  const legacy: ReportJobDefinition = { ...definition, kind: "legacy-sync" };
  await requestReportJobs(scope, [request(legacy)]);
  const first = await claim();
  const retryAt = new Date(Date.now() + 7200000).toISOString();
  await finishReportJob(scope, first, { status: "failed", retryAt });
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
  expect((await rows())[0]!.payloadJson).toMatchObject({
    definition: legacy,
    completedThrough: null,
    failures: 1,
    notBefore: retryAt,
    lease: null,
  });
  // Simulate elapsed database time, without an actual two-hour wait or source request.
  await db.execute(
    sql`update source_records set payload_json=jsonb_set(payload_json,'{notBefore}',to_jsonb('2021-01-01T00:00:00.000Z'::text)) where data_source_id=${source}`
  );
  const next = await claim();
  expect(next.definition).toEqual(legacy);
  await expect(finishReportJob(scope, first, { status: "complete" })).rejects.toThrow("ownership");
  await finishReportJob(scope, next, { status: "complete" });
  expect((await rows())[0]!.payloadJson).toMatchObject({
    completedThrough: desiredAt,
    failures: 0,
  });
  expect(await claimReportJob(scope, [policyHash])).toBeNull();
});
