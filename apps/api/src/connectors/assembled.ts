import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { DataSourceConnector } from '@scorecard/shared';
import type { AssembledWeekData } from '../metrics/types';
import type {
  AssembledPerson,
  AssembledAgentState,
  AssembledActivity,
  AssembledActivityType,
} from '../types/assembled';

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

// --- API calls ---

async function getPeople(client: AxiosInstance): Promise<AssembledPerson[]> {
  const response = await client.get<{ people: Record<string, AssembledPerson> }>('/people?limit=500');
  return Object.values(response.data.people);
}

async function getActivityTypes(client: AxiosInstance): Promise<AssembledActivityType[]> {
  const response = await client.get<{ activity_types: Record<string, AssembledActivityType> }>('/activity_types');
  return Object.values(response.data.activity_types);
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

// The /activities endpoint ignores agents[]/limit/offset and returns all org activities
// regardless of params (see CLAUDE.md decisions log) — fetched once per run in
// prepareRun, filtered by agent_id in fetchWeekData.
async function fetchAllActivities(
  client: AxiosInstance,
  startTime: number,
  endTime: number,
): Promise<AssembledActivity[]> {
  const response = await client.get<{ activities: Record<string, AssembledActivity> }>('/activities', {
    params: { start_time: startTime, end_time: endTime },
  });
  return Object.values(response.data.activities);
}

// --- Connector (fetcher — metric computation lives in apps/api/src/metrics/) ---
// The former module-level 10-minute cache is gone: the run context IS the per-run cache,
// created once by the sync and passed into every fetchWeekData call.

export interface AssembledRunContext {
  client: AxiosInstance;
  peopleByEmail: Map<string, AssembledPerson>;
  allActivities: AssembledActivity[];
  productiveTypeIds: Set<string>;
  productiveStateNames: Set<string>;
}

export const assembledConnector: DataSourceConnector<AssembledRunContext, AssembledWeekData> = {
  name: 'assembled',
  isAvailable: true,

  async prepareRun(periodStart: Date, periodEnd: Date): Promise<AssembledRunContext> {
    const client = createClient();
    const startTime = Math.floor(periodStart.getTime() / 1000);
    const endTime = Math.floor(periodEnd.getTime() / 1000);

    const [people, activityTypes, allActivities] = await Promise.all([
      getPeople(client),
      getActivityTypes(client),
      fetchAllActivities(client, startTime, endTime),
    ]);

    // First person wins on duplicate emails — same as the old .find() lookup.
    const peopleByEmail = new Map<string, AssembledPerson>();
    for (const p of people) {
      const key = p.email.toLowerCase();
      if (!peopleByEmail.has(key)) peopleByEmail.set(key, p);
    }

    const productiveTypeIds = new Set<string>();
    const productiveStateNames = new Set<string>();
    for (const at of activityTypes) {
      if (at.productive) {
        productiveTypeIds.add(at.id);
        productiveStateNames.add(at.name);
      }
    }

    return { client, peopleByEmail, allActivities, productiveTypeIds, productiveStateNames };
  },

  async fetchWeekData(
    email: string,
    periodStart: Date,
    periodEnd: Date,
    run: AssembledRunContext,
  ): Promise<AssembledWeekData | null> {
    const agent = run.peopleByEmail.get(email.toLowerCase());
    if (!agent) {
      console.warn(`[assembled] No agent found for email: ${email}`);
      return null;
    }
    if (!agent.agent_id) {
      console.warn(`[assembled] Agent ${email} has no agent_id — skipping`);
      return null;
    }

    const startTime = Math.floor(periodStart.getTime() / 1000);
    const endTime = Math.floor(periodEnd.getTime() / 1000);

    const states = await fetchAgentStates(run.client, agent.agent_id, startTime, endTime);
    const activities = run.allActivities.filter(a => a.agent_id === agent.agent_id);

    return {
      states,
      activities,
      productiveTypeIds: run.productiveTypeIds,
      productiveStateNames: run.productiveStateNames,
    };
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
