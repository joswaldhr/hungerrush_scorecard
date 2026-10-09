import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { weekDates } from "@/lib/utils";
import { ZendeskConnector, MAX_WEEKS_BACK } from "./zendesk";
import { loadAgentUpdateBindings } from "./zendesk-agent-update-bindings";
import {
  assertAgentUpdateObservationFresh,
  buildAgentUpdatePublicationRecord,
  normalizeAgentUpdatePublicationRecord,
  parseAgentUpdateRelease,
  AGENT_UPDATE_KEY,
  type AgentUpdateRelease,
} from "./zendesk-agent-update-publication-record";
import type { Connector, ConnectorConfig, IngestedRecord } from "./types";
import { parseSyncPeriod } from "./sync-period";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bindingDigest = (rows: Array<{ employeeId: string; teamId: string; externalId: string }>) =>
  digest([...rows].sort((a, b) => a.employeeId.localeCompare(b.employeeId)));

/**
 * Explicit agent-update connector using the normal atomic sync service. No route,
 * environment policy or scheduler imports it. Activation requires separate source
 * qualification and release; solved and human-only publication remain independent.
 */
export function createAgentUpdatePublisher(
  input: AgentUpdateRelease,
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
  const policy = parseAgentUpdateRelease(input);
  const connector = new ZendeskConnector();
  let fetched: { recordsDigest: string; bindings: string; periodStart: string } | null = null;
  connector.fetchRecords = async (config, ctx) => {
    fetched = null;
    if (
      (!ctx.period && ctx.cursor === null) ||
      (ctx.cursor !== null && (!/^[0-3]$/.test(ctx.cursor) || Number(ctx.cursor) >= MAX_WEEKS_BACK))
    )
      throw Error("AgentUpdate publication requires exactly one week offset");
    const { periodStart, periodEnd } = ctx.period
      ? parseSyncPeriod(ctx.period)
      : weekDates(Number(ctx.cursor));
    const bindings = await loadAgentUpdateBindings(policy, config, periodStart, policy.subdomain);
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
      throw Error("AgentUpdate source identities are incomplete or ambiguous");
    const records = bindings.map((binding) =>
      buildAgentUpdatePublicationRecord(
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
        family: "agent_update_report",
        metricKey: AGENT_UPDATE_KEY,
        periodStart,
        periodEnd,
        activeEmployees: bindings.length,
        releaseEvidenceSha256: policy.releaseEvidenceSha256,
      },
    };
  };
  connector.normalizeRecords = (records, employeeId, teamId, start, end) =>
    records.flatMap((r) =>
      normalizeAgentUpdatePublicationRecord(r.payload, employeeId, teamId, start, end)
    );
  return Object.assign(connector, {
    supportsFixedPeriod: true,
    async validatePublication(
      connection: Parameters<NonNullable<Connector["validatePublication"]>>[0],
      config: ConnectorConfig,
      records: IngestedRecord[]
    ) {
      if (!fetched || digest(records) !== fetched.recordsDigest)
        throw Error("AgentUpdate publication differs from its fetched snapshot");
      for (const record of records) assertAgentUpdateObservationFresh(record.payload, now());
      await connection.execute(sql`set local lock_timeout = '5s'`);
      await connection.execute(
        sql`lock table employees, external_identities, teams, metric_definitions, metric_assignments in share mode`
      );
      const current = await loadAgentUpdateBindings(
        policy,
        config,
        fetched.periodStart,
        policy.subdomain,
        connection
      );
      if (bindingDigest(current) !== fetched.bindings)
        throw Error("AgentUpdate employee scope changed before publication");
    },
  });
}
