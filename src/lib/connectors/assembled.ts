import type {
  Connector,
  ConnectorConfig,
  SyncContext,
  IngestedRecord,
  NormalizedFactInput,
  IdentityMatch,
  HealthStatus,
} from "./types";
import { db } from "@/lib/db";
import { externalIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { toIntervals, totalDuration, overlapDuration } from "./interval-math";

const MAX_WEEKS_BACK = 4;
const BASE_URL = "https://api.assembledhq.com/v0";
const PAGE_LIMIT = 500;

interface AssembledPerson {
  agent_id: string | null;
  email: string;
}

interface AssembledAgentState {
  state: string;
  start_time: number;
  end_time: number;
}

interface AssembledActivity {
  agent_id: string;
  type_id: string;
  start_time: number;
  end_time: number;
}

interface AssembledActivityType {
  id: string;
  name: string;
  productive: boolean;
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
  private productiveTypeIds: Set<string> | null = null;
  private productiveStateNames: Set<string> | null = null;

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

  private async ensureProductiveSets(): Promise<{ typeIds: Set<string>; stateNames: Set<string> }> {
    if (this.productiveTypeIds && this.productiveStateNames) {
      return { typeIds: this.productiveTypeIds, stateNames: this.productiveStateNames };
    }
    const res = await assembledGet<{ activity_types: Record<string, AssembledActivityType> }>(
      "/activity_types"
    );
    const typeIds = new Set<string>();
    const stateNames = new Set<string>();
    for (const at of Object.values(res.activity_types)) {
      if (at.productive) {
        typeIds.add(at.id);
        stateNames.add(at.name);
      }
    }
    this.productiveTypeIds = typeIds;
    this.productiveStateNames = stateNames;
    return { typeIds, stateNames };
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
    const { typeIds, stateNames } = await this.ensureProductiveSets();

    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, config.dataSourceId));

    const activitiesRes = await assembledGet<{ activities: Record<string, AssembledActivity> }>(
      "/activities",
      { start_time: startTime, end_time: endTime }
    );
    const allActivities = Object.values(activitiesRes.activities);

    const now = new Date();
    const records: IngestedRecord[] = [];

    for (const identity of identities) {
      const email = identity.externalId;
      const person = people.get(email.toLowerCase());
      if (!person?.agent_id) continue;

      const agentActivities = allActivities.filter((a) => a.agent_id === person.agent_id);
      const scheduled = toIntervals(agentActivities.filter((a) => typeIds.has(a.type_id)));
      const scheduledTotal = totalDuration(scheduled);

      let scheduleAdherence: number | null = null;
      if (scheduledTotal > 0) {
        const states = await this.fetchAgentStates(person.agent_id, startTime, endTime);
        const actualStates = states.filter((s) => stateNames.has(s.state));
        if (actualStates.length > 0) {
          scheduleAdherence =
            Math.round(
              (overlapDuration(scheduled, toIntervals(actualStates)) / scheduledTotal) * 10000
            ) / 100;
        }
      }

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

  private async fetchAgentStates(
    agentId: string,
    startTime: number,
    endTime: number
  ): Promise<AssembledAgentState[]> {
    const all: AssembledAgentState[] = [];
    let offset = 0;
    for (;;) {
      const res = await assembledGet<{ agent_states: AssembledAgentState[] }>("/agents/state", {
        agent_id: agentId,
        start_time: startTime,
        end_time: endTime,
        limit: PAGE_LIMIT,
        offset,
      });
      all.push(...res.agent_states);
      if (res.agent_states.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }
    return all;
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
}
