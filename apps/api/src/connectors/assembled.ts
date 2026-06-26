import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { DataSourceConnector, ConnectorMetricResult } from '@scorecard/shared';
import type {
  AssembledPerson,
  AssembledAgentState,
  AssembledActivity,
  AssembledActivityType,
} from '../types/assembled.js';

const BASE_URL = 'https://api.assembledhq.com/v0';
const PAGE_LIMIT = 500;

function createClient(): AxiosInstance {
  const apiKey = process.env.ASSEMBLED_API_KEY;
  if (!apiKey) {
    throw new Error('ASSEMBLED_API_KEY is not set');
  }
  return axios.create({
    baseURL: BASE_URL,
    auth: { username: apiKey, password: '' },
  });
}

// --- Per-sync-run cache ---
// Populated on first call, cleared after 10 minutes (longer than any sync run).

let cachedPeople: AssembledPerson[] | null = null;
let cachedActivityTypes: AssembledActivityType[] | null = null;
let cacheClient: AxiosInstance | null = null;
let cacheExpiry = 0;

function getClient(): AxiosInstance {
  const now = Date.now();
  if (!cacheClient || now > cacheExpiry) {
    cacheClient = createClient();
    cachedPeople = null;
    cachedActivityTypes = null;
    cacheExpiry = now + 10 * 60 * 1000;
  }
  return cacheClient;
}

export function clearAssembledCache(): void {
  cachedPeople = null;
  cachedActivityTypes = null;
  cacheClient = null;
  cacheExpiry = 0;
}

// --- API calls ---

async function getPeople(client: AxiosInstance): Promise<AssembledPerson[]> {
  if (cachedPeople) return cachedPeople;
  const response = await client.get<{ people: Record<string, AssembledPerson> }>('/people?limit=500');
  cachedPeople = Object.values(response.data.people);
  return cachedPeople;
}

async function getActivityTypes(client: AxiosInstance): Promise<AssembledActivityType[]> {
  if (cachedActivityTypes) return cachedActivityTypes;
  const response = await client.get<{ activity_types: Record<string, AssembledActivityType> }>('/activity_types');
  cachedActivityTypes = Object.values(response.data.activity_types);
  return cachedActivityTypes;
}

async function fetchAgentStates(
  client: AxiosInstance,
  agentId: string,
  startTime: number,
  endTime: number
): Promise<AssembledAgentState[]> {
  const all: AssembledAgentState[] = [];
  let offset = 0;
  for (;;) {
    const response = await client.get<{ agent_states: AssembledAgentState[] }>('/agents/state', {
      params: { agent_id: agentId, start_time: startTime, end_time: endTime, limit: PAGE_LIMIT, offset },
    });
    const page = response.data.agent_states;
    all.push(...page);
    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

async function fetchActivities(
  client: AxiosInstance,
  agentId: string,
  startTime: number,
  endTime: number
): Promise<AssembledActivity[]> {
  const all: AssembledActivity[] = [];
  let offset = 0;
  for (;;) {
    const response = await client.get<{ activities: Record<string, AssembledActivity> }>('/activities', {
      params: { 'agents[]': agentId, start_time: startTime, end_time: endTime, limit: PAGE_LIMIT, offset },
    });
    const rawPage = Object.values(response.data.activities);
    all.push(...rawPage.filter(a => a.agent_id === agentId));
    if (rawPage.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

// --- Interval math ---

interface TimeInterval {
  start: number;
  end: number;
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const first = sorted[0]!;
  const merged: TimeInterval[] = [{ start: first.start, end: first.end }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  return merged;
}

function totalDuration(intervals: TimeInterval[]): number {
  return mergeIntervals(intervals).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

function overlapDuration(a: TimeInterval[], b: TimeInterval[]): number {
  const mergedA = mergeIntervals(a);
  const mergedB = mergeIntervals(b);
  let total = 0;
  for (const ia of mergedA) {
    for (const ib of mergedB) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (end > start) total += end - start;
    }
  }
  return total;
}

// --- Metric computation ---

function toIntervals(items: Array<{ start_time: number; end_time: number }>): TimeInterval[] {
  return items.map(i => ({ start: i.start_time, end: i.end_time }));
}

function computeScheduleAdherence(
  states: AssembledAgentState[],
  activities: AssembledActivity[],
  productiveTypeIds: Set<string>,
  productiveStateNames: Set<string>,
): number {
  const scheduled = toIntervals(activities.filter(a => productiveTypeIds.has(a.type_id)));
  const actual = toIntervals(states.filter(s => productiveStateNames.has(s.state)));
  const scheduledTotal = totalDuration(scheduled);
  if (scheduledTotal === 0) return 0;
  return Math.round((overlapDuration(scheduled, actual) / scheduledTotal) * 10000) / 100;
}

function computeOccupancy(
  states: AssembledAgentState[],
  productiveStateNames: Set<string>,
): number {
  const loggedIn = toIntervals(states.filter(s => s.state !== 'Offline'));
  const productive = toIntervals(states.filter(s => productiveStateNames.has(s.state)));
  const loggedInTotal = totalDuration(loggedIn);
  if (loggedInTotal === 0) return 0;
  return Math.round((totalDuration(productive) / loggedInTotal) * 10000) / 100;
}

function computeHandleTime(
  states: AssembledAgentState[],
  productiveStateNames: Set<string>,
): number {
  const customerFacing = states.filter(s => productiveStateNames.has(s.state));
  if (customerFacing.length === 0) return 0;
  const seconds = customerFacing.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
  return Math.round(seconds / customerFacing.length);
}

// --- Connector ---

export const assembledConnector: DataSourceConnector = {
  name: 'assembled',
  isAvailable: true,

  async fetchAgentMetrics(
    agentId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ConnectorMetricResult[]> {
    const client = getClient();
    const startTime = Math.floor(periodStart.getTime() / 1000);
    const endTime = Math.floor(periodEnd.getTime() / 1000);

    const people = await getPeople(client);
    const agent = people.find(p => p.email.toLowerCase() === agentId.toLowerCase());
    if (!agent) {
      console.warn(`[assembled] No agent found for email: ${agentId}`);
      return [];
    }
    if (!agent.agent_id) {
      console.warn(`[assembled] Agent ${agentId} has no agent_id — skipping`);
      return [];
    }

    const [states, activities, activityTypes] = await Promise.all([
      fetchAgentStates(client, agent.agent_id, startTime, endTime),
      fetchActivities(client, agent.agent_id, startTime, endTime),
      getActivityTypes(client),
    ]);

    const productiveTypeIds = new Set<string>();
    const productiveStateNames = new Set<string>();
    for (const at of activityTypes) {
      if (at.productive) {
        productiveTypeIds.add(at.id);
        productiveStateNames.add(at.name);
      }
    }

    const adherence = computeScheduleAdherence(states, activities, productiveTypeIds, productiveStateNames);
    const occupancy = computeOccupancy(states, productiveStateNames);
    const handleTime = computeHandleTime(states, productiveStateNames);

    const rawSource: Record<string, unknown> = {
      assembledAgentId: agent.id,
      assembledAgentName: agent.name,
      stateCount: states.length,
      activityCount: activities.length,
    };
    if (agent.platforms?.zendesk) {
      rawSource['zendeskAgentId'] = agent.platforms.zendesk;
    }

    const base = { employeeId: agentId, periodStart, periodEnd };

    return [
      { ...base, metricKey: 'schedule_adherence', value: adherence, unit: 'percent', rawSource: { ...rawSource } },
      { ...base, metricKey: 'occupancy', value: occupancy, unit: 'percent', rawSource: { ...rawSource } },
      { ...base, metricKey: 'handle_time', value: handleTime, unit: 'seconds', rawSource: { ...rawSource } },
    ];
  },

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = createClient();
      await client.get('/people', { params: { limit: 1 } });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  },
};
