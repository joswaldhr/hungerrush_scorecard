import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { weekDates } from "@/lib/utils";
import { ZendeskConnector, MAX_WEEKS_BACK } from "./zendesk";
import { parseSyncPeriod } from "./sync-period";
import { loadInboundReportBindings } from "./zendesk-inbound-report-bindings";
import {
  buildInboundPublicationRecord,
  normalizeInboundPublicationRecord,
  parseInboundReleasePolicy,
  type InboundReleasePolicy,
} from "./zendesk-inbound-publication-record";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import { readTalkCollectionSnapshot } from "./zendesk-talk-store";
import { createTalkExportReader, runTalkCollectionBatch } from "./zendesk-talk-worker";
import { validateTalkObservation, type TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { parseTalkCollectionPolicy } from "./zendesk-talk-config";
import type { ConnectorConfig, IngestedRecord } from "./types";

const digest = (records: IngestedRecord[]) =>
  createHash("sha256").update(JSON.stringify(records)).digest("hex");
const bindingDigest = (rows: Array<{ employeeId: string; teamId: string; externalId: string }>) =>
  JSON.stringify([...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId)));

/** Snapshot adapter shared by synthetic rehearsal and the live source fetch. No routes enable it by default. */
export function createInboundPublisher(
  input: InboundReleasePolicy,
  load: (
    config: ConnectorConfig,
    periodStart: string,
    periodEnd: string,
    externalIds: string[]
  ) => Promise<{ snapshot: TalkCollectionSnapshot; identities: Map<string, number> }>,
  subdomain: string,
  now: () => Date = () => new Date()
) {
  const release = parseInboundReleasePolicy(input),
    policy = release.policy;
  const connector = new ZendeskConnector();
  let fetched: {
    recordsDigest: string;
    bindings: string;
    periodStart: string;
    periodEnd: string;
    snapshot: TalkCollectionSnapshot;
  } | null = null;
  const validateSource = (
    snapshot: TalkCollectionSnapshot,
    periodStart: string,
    periodEnd: string,
    at: Date
  ) => {
    const observed = validateTalkObservation(
      snapshot,
      policy.accountReference,
      { periodStart, periodEnd, timeZone: policy.timeZone },
      policy.observationLimits,
      at
    );
    const localDay = (date: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: policy.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const part = (key: string) => parts.find((p) => p.type === key)!.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    };
    if (localDay(at) > periodEnd && localDay(new Date(observed.observationStartedAt)) <= periodEnd)
      throw Error("Inbound closed week requires both collections after period end");
  };
  connector.fetchRecords = async (config, ctx) => {
    fetched = null;
    if (
      (!ctx.period && ctx.cursor === null) ||
      (ctx.cursor !== null && (!/^[0-3]$/.test(ctx.cursor) || Number(ctx.cursor) >= MAX_WEEKS_BACK))
    )
      throw Error("Inbound requires exactly one week offset");
    const { periodStart, periodEnd } = ctx.period
      ? parseSyncPeriod(ctx.period, now())
      : weekDates(Number(ctx.cursor));
    const bindings = await loadInboundReportBindings(policy, config, periodStart, subdomain);
    const { snapshot, identities } = await load(
      config,
      periodStart,
      periodEnd,
      bindings.map((b) => b.externalId)
    );
    if (
      identities.size !== bindings.length ||
      bindings.some((b) => !identities.has(b.externalId)) ||
      new Set(identities.values()).size !== bindings.length
    )
      throw Error("Inbound source identity mapping is incomplete or ambiguous");
    const observedNow = now();
    validateSource(snapshot, periodStart, periodEnd, observedNow);
    const records = bindings.map((binding) =>
      buildInboundPublicationRecord(
        snapshot,
        release,
        config,
        { ...binding, agentId: identities.get(binding.externalId)! },
        periodStart,
        periodEnd,
        observedNow
      )
    );
    fetched = {
      recordsDigest: digest(records),
      bindings: bindingDigest(bindings),
      periodStart,
      periodEnd,
      snapshot: structuredClone(snapshot),
    };
    return {
      records,
      cursor: null,
      hasMore: false,
      diagnostics: {
        family: "inbound_call_participation",
        periodStart,
        periodEnd,
        activeEmployees: bindings.length,
        releaseEvidenceSha256: release.releaseEvidenceSha256,
      },
    };
  };
  connector.normalizeRecords = (records, employeeId, teamId, start, end) =>
    records.flatMap((r) =>
      normalizeInboundPublicationRecord(r.payload, employeeId, teamId, start, end)
    );
  // Keep assignment/identity writers out through commit, including insertion of a
  // new conflicting assignment (row locks alone cannot prevent that phantom).
  // Bounded wait; this runs only for the explicitly enabled dedicated publisher.
  return Object.assign(connector, {
    supportsFixedPeriod: true,
    async validatePublication(
      connection: Parameters<NonNullable<import("./types").Connector["validatePublication"]>>[0],
      config: ConnectorConfig,
      records: IngestedRecord[]
    ) {
      if (!fetched || digest(records) !== fetched.recordsDigest)
        throw Error("Inbound publication differs from its fetched snapshot");
      await connection.execute(sql`set local lock_timeout = '5s'`);
      await connection.execute(
        sql`lock table employees, external_identities, teams, metric_definitions, metric_assignments in share mode`
      );
      const current = await loadInboundReportBindings(
        policy,
        config,
        fetched.periodStart,
        subdomain,
        connection
      );
      if (bindingDigest(current) !== fetched.bindings)
        throw Error("Inbound employee scope changed before publication");
      // Waiting for publication locks must not turn a fresh progress capture into a stale or closed-week result.
      validateSource(fetched.snapshot, fetched.periodStart, fetched.periodEnd, now());
    },
  });
}

export function createLiveInboundPublisher(
  input: InboundReleasePolicy,
  collection: NonNullable<ReturnType<typeof parseTalkCollectionPolicy>>
) {
  const release = parseInboundReleasePolicy(input),
    policy = release.policy;
  if (
    collection.scope.organizationId !== policy.organizationId ||
    collection.scope.dataSourceId !== policy.dataSourceId ||
    collection.scope.accountReference !== policy.accountReference
  )
    throw Error("Inbound collection and publication must own the same source");
  return createInboundPublisher(
    release,
    async (config, periodStart, periodEnd, externalIds) => {
      const credentials = {
        subdomain: env.ZENDESK_SUBDOMAIN ?? "",
        email: env.ZENDESK_EMAIL ?? "",
        apiKey: env.ZENDESK_API_KEY ?? "",
      };
      const result = await runTalkCollectionBatch(
        collection.scope,
        collection.bootstrapStart,
        createTalkExportReader(credentials, policy.accountReference),
        { maxPages: 22, maxDurationMs: 150000 }
      );
      if (result.status !== "collected" || !result.callsExhausted || !result.legsExhausted)
        throw Error("Inbound collection incomplete; retained checkpoints can resume");
      const stored = await readTalkCollectionSnapshot({
        ...config,
        accountReference: policy.accountReference,
      });
      if (stored.status !== "ready_for_qualification" || !stored.snapshot)
        throw Error("Inbound source streams are still collecting");
      validateTalkObservation(
        stored.snapshot,
        policy.accountReference,
        { periodStart, periodEnd, timeZone: policy.timeZone },
        policy.observationLimits,
        new Date()
      );
      const reader = createBoundedCsatReader(credentials, { elapsedMs: 90000, requestBudget: 20 });
      const staff = await resolveCsatStaffIdentities(externalIds, reader.read);
      return { snapshot: stored.snapshot, identities: staff.identities };
    },
    env.ZENDESK_SUBDOMAIN ?? ""
  );
}
