import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { weekDates } from "@/lib/utils";
import { env } from "@/lib/env";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { readTalkCollectionSnapshot } from "./zendesk-talk-store";
import { createTalkExportReader, runTalkCollectionBatch } from "./zendesk-talk-worker";
import type { parseTalkCollectionPolicy } from "./zendesk-talk-config";
import { ZendeskConnector, MAX_WEEKS_BACK } from "./zendesk";
import { parseSyncPeriod } from "./sync-period";
import { loadPosInboundBindings } from "./zendesk-pos-inbound-bindings";
import {
  assertPosInboundPublicationFresh,
  buildPosInboundPublication,
  normalizePosInboundPublication,
  parsePosInboundRelease,
  type PosInboundRelease,
} from "./zendesk-pos-inbound-publication";
import type { TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { Connector, ConnectorConfig, IngestedRecord } from "./types";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bindingDigest = (rows: Array<{ employeeId: string; teamId: string; externalId: string }>) =>
  digest([...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId)));

/** Dedicated adapter for the normal atomic sync service; no route or environment enables it. */
export function createPosInboundPublisher(
  input: PosInboundRelease,
  load: (
    config: ConnectorConfig,
    start: string,
    end: string,
    externalIds: string[]
  ) => Promise<{ snapshot: TalkCollectionSnapshot; identities: Map<string, number> }>,
  subdomain: string,
  now: () => Date = () => new Date()
): Connector {
  const release = parsePosInboundRelease(input),
    policy = release.policy;
  const connector = new ZendeskConnector();
  let fetched: { recordsDigest: string; bindings: string; periodStart: string } | null = null;
  connector.fetchRecords = async (config, ctx) => {
    fetched = null;
    if (
      (!ctx.period && ctx.cursor === null) ||
      (ctx.cursor !== null && (!/^[0-3]$/.test(ctx.cursor) || Number(ctx.cursor) >= MAX_WEEKS_BACK))
    )
      throw Error("POS inbound requires one reporting week");
    const { periodStart, periodEnd } = ctx.period
      ? parseSyncPeriod(ctx.period, now())
      : weekDates(Number(ctx.cursor));
    const bindings = await loadPosInboundBindings(policy, config, periodStart, subdomain);
    const loaded = await load(
      config,
      periodStart,
      periodEnd,
      bindings.map((b) => b.externalId)
    );
    if (
      loaded.identities.size !== bindings.length ||
      bindings.some((b) => !loaded.identities.has(b.externalId)) ||
      new Set(loaded.identities.values()).size !== bindings.length
    )
      throw Error("POS inbound source identities are incomplete or ambiguous");
    const observedNow = now();
    const records = bindings.map((binding) =>
      buildPosInboundPublication(
        loaded.snapshot,
        release,
        config,
        { ...binding, agentId: loaded.identities.get(binding.externalId)! },
        periodStart,
        periodEnd,
        observedNow
      )
    );
    fetched = { recordsDigest: digest(records), bindings: bindingDigest(bindings), periodStart };
    return {
      records,
      cursor: null,
      hasMore: false,
      diagnostics: {
        family: "pos_inbound_report",
        periodStart,
        periodEnd,
        activeEmployees: bindings.length,
        releaseEvidenceSha256: release.releaseEvidenceSha256,
      },
    };
  };
  connector.normalizeRecords = (records, employeeId, teamId, start, end) =>
    records.flatMap((r) =>
      normalizePosInboundPublication(r.payload, employeeId, teamId, start, end)
    );
  return Object.assign(connector, {
    supportsFixedPeriod: true,
    async validatePublication(
      connection: Parameters<NonNullable<Connector["validatePublication"]>>[0],
      config: ConnectorConfig,
      records: IngestedRecord[]
    ) {
      if (!fetched || digest(records) !== fetched.recordsDigest)
        throw Error("POS inbound publication differs from its fetched snapshot");
      await connection.execute(sql`set local lock_timeout = '5s'`);
      await connection.execute(
        sql`lock table employees, external_identities, teams, metric_definitions, metric_assignments in share mode`
      );
      const current = await loadPosInboundBindings(
        policy,
        config,
        fetched.periodStart,
        subdomain,
        connection
      );
      if (bindingDigest(current) !== fetched.bindings)
        throw Error("POS inbound employee scope changed before publication");
      // Recheck after acquiring locks: waiting must not permit stale or partial-week publication.
      const at = now();
      for (const record of records) assertPosInboundPublicationFresh(record.payload, at);
    },
  });
}

/** Explicit, bounded POS projection adapter. No environment policy or route selects it yet. */
export function createLivePosInboundPublisher(
  input: PosInboundRelease,
  collection: NonNullable<ReturnType<typeof parseTalkCollectionPolicy>>
) {
  const release = parsePosInboundRelease(input),
    policy = release.policy;
  if (
    collection.scope.organizationId !== policy.organizationId ||
    collection.scope.dataSourceId !== policy.dataSourceId ||
    collection.scope.accountReference !== policy.accountReference
  )
    throw Error("POS collection and publication must own the same source");
  const scope = { ...collection.scope, projection: "pos-call-hold-v1" as const };
  return createPosInboundPublisher(
    release,
    async (_config, _start, _end, externalIds) => {
      const credentials = {
        subdomain: env.ZENDESK_SUBDOMAIN ?? "",
        email: env.ZENDESK_EMAIL ?? "",
        apiKey: env.ZENDESK_API_KEY ?? "",
      };
      const result = await runTalkCollectionBatch(
        scope,
        collection.bootstrapStart,
        createTalkExportReader(credentials, policy.accountReference),
        { maxPages: 22, maxDurationMs: 150000 }
      );
      if (result.status !== "collected" || !result.callsExhausted || !result.legsExhausted)
        throw Error("POS collection incomplete; retained checkpoints can resume");
      const stored = await readTalkCollectionSnapshot(scope);
      if (stored.status !== "ready_for_qualification" || !stored.snapshot)
        throw Error("POS source streams are still collecting");
      const reader = createBoundedCsatReader(credentials, { elapsedMs: 90000, requestBudget: 20 });
      const staff = await resolveCsatStaffIdentities(externalIds, reader.read);
      return { snapshot: stored.snapshot, identities: staff.identities };
    },
    env.ZENDESK_SUBDOMAIN ?? ""
  );
}
