import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { weekDates } from "@/lib/utils";
import { ZendeskConnector, MAX_WEEKS_BACK } from "./zendesk";
import { loadSolvedReportBindings } from "./zendesk-solved-report-bindings";
import {
  assertSolvedObservationFresh,
  buildSolvedPublicationRecord,
  normalizeSolvedPublicationRecord,
  parseSolvedRelease,
  solvedMetricKey,
  type SolvedRelease,
} from "./zendesk-solved-publication-record";
import type { Connector, ConnectorConfig, IngestedRecord } from "./types";
import { parseSyncPeriod } from "./sync-period";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bindingDigest = (rows: Array<{ employeeId: string; teamId: string; externalId: string }>) =>
  digest([...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId)));

/**
 * Dedicated solved-only connector using the normal atomic sync service. A collector
 * must supply complete evidence; this adapter cannot enable the human-only publisher
 * or publish the separately unqualified update-event measure.
 */
export function createSolvedPublisher(
  input: SolvedRelease,
  load: (
    config: ConnectorConfig,
    periodStart: string,
    periodEnd: string,
    externalIds: string[]
  ) => Promise<{
    snapshot: unknown;
    observationStartedAt: string;
    identities: Map<string, number>;
  }>,
  now: () => Date = () => new Date()
): Connector {
  const policy = parseSolvedRelease(input);
  const connector = new ZendeskConnector();
  let fetched: { recordsDigest: string; bindings: string; periodStart: string } | null = null;
  connector.fetchRecords = async (config, ctx) => {
    fetched = null;
    if (
      (!ctx.period && ctx.cursor === null) ||
      (ctx.cursor !== null && (!/^[0-3]$/.test(ctx.cursor) || Number(ctx.cursor) >= MAX_WEEKS_BACK))
    )
      throw Error("Solved publication requires exactly one week offset");
    const { periodStart, periodEnd } = ctx.period
      ? parseSyncPeriod(ctx.period)
      : weekDates(Number(ctx.cursor));
    const bindings = await loadSolvedReportBindings(policy, config, periodStart, policy.subdomain);
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
      throw Error("Solved source identities are incomplete or ambiguous");
    const records = bindings.map((binding) =>
      buildSolvedPublicationRecord(
        loaded.snapshot,
        policy,
        config,
        {
          ...binding,
          agentId: loaded.identities.get(binding.externalId)!,
          observationStartedAt: loaded.observationStartedAt,
        },
        periodStart,
        periodEnd,
        now()
      )
    );
    fetched = { recordsDigest: digest(records), bindings: bindingDigest(bindings), periodStart };
    return {
      records,
      cursor: null,
      hasMore: false,
      diagnostics: {
        family: "solved_ticket_report",
        metricKey: solvedMetricKey(policy),
        periodStart,
        periodEnd,
        activeEmployees: bindings.length,
        releaseEvidenceSha256: policy.releaseEvidenceSha256,
      },
    };
  };
  connector.normalizeRecords = (records, employeeId, teamId, start, end) =>
    records.flatMap((r) =>
      normalizeSolvedPublicationRecord(r.payload, employeeId, teamId, start, end)
    );
  return Object.assign(connector, {
    supportsFixedPeriod: true,
    async validatePublication(
      connection: Parameters<NonNullable<Connector["validatePublication"]>>[0],
      config: ConnectorConfig,
      records: IngestedRecord[]
    ) {
      if (!fetched || digest(records) !== fetched.recordsDigest)
        throw Error("Solved publication differs from its fetched snapshot");
      for (const record of records) assertSolvedObservationFresh(record.payload, now());
      await connection.execute(sql`set local lock_timeout = '5s'`);
      await connection.execute(
        sql`lock table employees, external_identities, teams, metric_definitions, metric_assignments in share mode`
      );
      const current = await loadSolvedReportBindings(
        policy,
        config,
        fetched.periodStart,
        policy.subdomain,
        connection
      );
      if (bindingDigest(current) !== fetched.bindings)
        throw Error("Solved employee scope changed before publication");
    },
  });
}
