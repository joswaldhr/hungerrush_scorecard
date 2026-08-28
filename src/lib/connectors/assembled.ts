import type {
  Connector,
  ConnectorConfig,
  SyncContext,
  IngestedRecord,
  NormalizedFactInput,
  IdentityMatch,
  HealthStatus,
  RosterGroupMapping,
  DiscoveredRosterMember,
} from "./types";
import { db } from "@/lib/db";
import { externalIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

const MAX_WEEKS_BACK = 4;
const BASE_URL = "https://api.assembledhq.com/v0";
const PAGE_LIMIT = 500;
const REPORT_POLL_INTERVAL_MS = 1500;
const REPORT_POLL_MAX_ATTEMPTS = 20;

interface AssembledPerson {
  agent_id: string | null;
  email: string;
  channels: string[];
  first_name?: string;
  last_name?: string;
  deleted?: boolean;
}

interface AssembledReportMetric {
  name: string;
  value: number;
  attributes: {
    agent_id: string;
    start_time: number;
    end_time: number;
    type: "full_interval" | "interval";
  };
}

interface AssembledReport {
  status: "in_progress" | "complete" | "error";
  total_metric_count: number;
  metrics: AssembledReportMetric[];
}

function authHeader(): string {
  if (!env.ASSEMBLED_API_KEY) throw new Error("ASSEMBLED_API_KEY must be set");
  return `Basic ${Buffer.from(`${env.ASSEMBLED_API_KEY}:`).toString("base64")}`;
}

async function assembledGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader() } });
  if (!res.ok) {
    throw new Error(`Assembled GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function assembledPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Assembled POST ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function weekOf(weeksAgo: number): {
  periodStart: string;
  periodEnd: string;
  startTime: number;
  endTime: number;
} {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: new Date(sunday.getTime() - 1).toISOString().split("T")[0]!,
    startTime: Math.floor(monday.getTime() / 1000),
    endTime: Math.floor(sunday.getTime() / 1000),
  };
}

export class AssembledConnector implements Connector {
  readonly sourceType = "assembled";
  private peopleByEmail: Map<string, AssembledPerson> | null = null;

  async healthCheck(_config: ConnectorConfig): Promise<HealthStatus> {
    try {
      await assembledGet(`/people`, { limit: 1 });
      return { connected: true, message: "Assembled connection healthy", lastSyncAt: null };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : "Unknown error",
        lastSyncAt: null,
      };
    }
  }

  private async ensurePeople(): Promise<Map<string, AssembledPerson>> {
    if (this.peopleByEmail) return this.peopleByEmail;
    const res = await assembledGet<{ people: Record<string, AssembledPerson> }>("/people", {
      limit: PAGE_LIMIT,
    });
    const map = new Map<string, AssembledPerson>();
    for (const p of Object.values(res.people)) {
      map.set(p.email.toLowerCase(), p);
    }
    this.peopleByEmail = map;
    return map;
  }

  /**
   * Fetches Assembled's own computed schedule-adherence percentage per agent for one
   * channel/week via the async Reports API (POST /reports/adherence, poll GET
   * /reports/:reportID). Adherence can't be derived from /activities + /agents/state
   * directly — the state-to-activity-type mapping that determines "productive" is a
   * dashboard-only Administrator setting with no read API (confirmed against
   * docs.assembled.com's Agent States reference), so Assembled's own report is the only
   * correct source.
   */
  private async fetchAdherenceByAgent(
    channel: string,
    startTime: number,
    endTime: number
  ): Promise<Map<string, number>> {
    const { report_id } = await assembledPost<{ report_id: string }>("/reports/adherence", {
      report_type: "adherence",
      start_time: startTime,
      end_time: endTime,
      interval: "1w",
      channel,
    });

    let report: AssembledReport | null = null;
    for (let attempt = 0; attempt < REPORT_POLL_MAX_ATTEMPTS; attempt++) {
      const result = await assembledGet<AssembledReport>(`/reports/${report_id}`, {
        metric: "schedule_adherence_percentage",
        type: "full_interval",
      });
      if (result.status === "complete") {
        report = result;
        break;
      }
      if (result.status === "error") {
        throw new Error(`Assembled adherence report ${report_id} failed to generate`);
      }
      await sleep(REPORT_POLL_INTERVAL_MS);
    }
    if (!report) {
      throw new Error(`Assembled adherence report ${report_id} did not complete in time`);
    }

    const byAgent = new Map<string, number>();
    for (const metric of report.metrics) {
      if (metric.name === "schedule_adherence_percentage" && metric.attributes.type === "full_interval") {
        byAgent.set(metric.attributes.agent_id, Math.round(metric.value * 100) / 100);
      }
    }
    return byAgent;
  }

  async resolveIdentities(
    _config: ConnectorConfig,
    externalIds: string[]
  ): Promise<IdentityMatch[]> {
    const people = await this.ensurePeople();
    const matches: IdentityMatch[] = [];
    for (const email of externalIds) {
      const person = people.get(email.toLowerCase());
      if (!person?.agent_id) continue;
      const [identity] = await db
        .select()
        .from(externalIdentities)
        .where(eq(externalIdentities.externalId, email));
      if (identity) {
        matches.push({
          externalId: email,
          externalEmail: email,
          externalDisplayName: identity.externalDisplayName,
          employeeId: identity.employeeId,
          matchMethod: "email",
          matchConfidence: 1,
        });
      }
    }
    return matches;
  }

  async fetchRecords(
    config: ConnectorConfig,
    ctx: SyncContext
  ): Promise<{ records: IngestedRecord[]; cursor: string | null; hasMore: boolean }> {
    const weekOffset = ctx.cursor ? parseInt(ctx.cursor, 10) : 0;
    if (weekOffset >= MAX_WEEKS_BACK) {
      return { records: [], cursor: null, hasMore: false };
    }

    const { periodStart, periodEnd, startTime, endTime } = weekOf(weekOffset);
    const people = await this.ensurePeople();

    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, config.dataSourceId));

    // Adherence reports are requested per channel, not per agent — group known
    // identities by each person's primary channel so we issue one report call per
    // distinct channel instead of one per person.
    const channelsNeeded = new Set<string>();
    for (const identity of identities) {
      const person = people.get(identity.externalId.toLowerCase());
      const channel = person?.channels?.[0];
      if (channel) channelsNeeded.add(channel);
    }

    const adherenceByChannel = new Map<string, Map<string, number>>();
    for (const channel of channelsNeeded) {
      adherenceByChannel.set(channel, await this.fetchAdherenceByAgent(channel, startTime, endTime));
    }

    const now = new Date();
    const records: IngestedRecord[] = [];

    for (const identity of identities) {
      const email = identity.externalId;
      const person = people.get(email.toLowerCase());
      if (!person?.agent_id) continue;

      const channel = person.channels?.[0] ?? null;
      const scheduleAdherence = channel
        ? adherenceByChannel.get(channel)?.get(person.agent_id) ?? null
        : null;

      records.push({
        externalRecordType: "schedule_stats",
        externalRecordId: `sched-${email}-${periodStart}`,
        employeeExternalId: email,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: { scheduleAdherence },
        sourceUpdatedAt: now,
      });
    }

    return {
      records,
      cursor: String(weekOffset + 1),
      hasMore: weekOffset + 1 < MAX_WEEKS_BACK,
    };
  }

  normalizeRecords(
    records: Array<{ sourceRecordId: string; payload: Record<string, unknown> }>,
    employeeId: string,
    teamId: string | null,
    periodStart: string,
    periodEnd: string
  ): NormalizedFactInput[] {
    const facts: NormalizedFactInput[] = [];
    for (const { payload } of records) {
      if (payload.scheduleAdherence != null) {
        facts.push({
          employeeId,
          teamId,
          factType: "schedule_adherence",
          numericValue: payload.scheduleAdherence as number,
          textValue: null,
          booleanValue: null,
          unit: "%",
          periodStart,
          periodEnd,
          dimensionsJson: null,
        });
      }
    }
    return facts;
  }

  async discoverRoster(
    _config: ConnectorConfig,
    groupMappings: RosterGroupMapping[]
  ): Promise<DiscoveredRosterMember[]> {
    if (groupMappings.length === 0) return [];

    const members: DiscoveredRosterMember[] = [];
    const seenExternalIds = new Set<string>();

    for (const mapping of groupMappings) {
      const res = await assembledGet<{ people: Record<string, AssembledPerson> }>("/people", {
        team: mapping.externalGroupId,
        limit: PAGE_LIMIT,
        include_deleted: "false",
      });
      for (const person of Object.values(res.people)) {
        if (person.deleted || !person.email) continue;
        if (seenExternalIds.has(person.email)) continue;
        seenExternalIds.add(person.email);
        const displayName = [person.first_name, person.last_name].filter(Boolean).join(" ") || null;
        members.push({
          externalId: person.email,
          externalEmail: person.email,
          externalDisplayName: displayName,
          teamId: mapping.teamId,
        });
      }
    }

    return members;
  }
}
