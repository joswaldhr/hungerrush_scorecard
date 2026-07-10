import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { DataSourceConnector } from '@scorecard/shared';
import type { ZendeskWeekData } from '../metrics/types';
import type {
  ZendeskTicket,
  ZendeskSearchResponse,
  ZendeskSatisfactionRating,
  ZendeskSatisfactionRatingsResponse,
  ZendeskTicketMetricSet,
  ZendeskShowManyResponse,
  ZendeskSlaPoliciesResponse,
  ZendeskCall,
  ZendeskCallsResponse,
} from '../types/zendesk';

// Zendesk's search API hard-caps at 1,000 results (L10) — warn while an agent is
// approaching it so the cap never truncates silently.
const SEARCH_CAP_WARN_THRESHOLD = 900;

// The one Zendesk client factory (D3) — also used by the bootstrap's agent fetch in syncService.
export function createZendeskClient(): AxiosInstance {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const token = process.env.ZENDESK_API_TOKEN;
  if (!subdomain || !email || !token) {
    throw new Error('ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN must be set');
  }
  return axios.create({
    baseURL: `https://${subdomain}.zendesk.com/api/v2`,
    auth: { username: `${email}/token`, password: token },
  });
}

// --- API calls ---

async function searchTickets(
  client: AxiosInstance,
  agentId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ZendeskTicket[]> {
  const start = periodStart.toISOString().substring(0, 10);
  const end = periodEnd.toISOString().substring(0, 10);
  const query = `type:ticket assignee:${agentId} updated>=${start} updated<=${end}`;

  const tickets: ZendeskTicket[] = [];
  let url: string | null = `/search.json?query=${encodeURIComponent(query)}`;

  while (url) {
    const response: AxiosResponse<ZendeskSearchResponse> = await client.get(url);
    tickets.push(...response.data.results);
    url = response.data.next_page;
  }

  if (tickets.length > SEARCH_CAP_WARN_THRESHOLD) {
    console.warn(
      `[zendesk] Agent ${agentId}: ${tickets.length} tickets this period — ` +
      `approaching the search API's 1,000-result cap (L10); results beyond it are silently dropped`,
    );
  }

  return tickets;
}

async function searchOpenTickets(
  client: AxiosInstance,
  agentId: string,
): Promise<ZendeskTicket[]> {
  const query = `type:ticket assignee:${agentId} status<solved`;
  const tickets: ZendeskTicket[] = [];
  let url: string | null = `/search.json?query=${encodeURIComponent(query)}`;

  while (url) {
    const response: AxiosResponse<ZendeskSearchResponse> = await client.get(url);
    tickets.push(...response.data.results);
    url = response.data.next_page;
  }

  return tickets;
}

async function fetchTicketMetrics(
  client: AxiosInstance,
  ticketIds: number[],
): Promise<Map<number, ZendeskTicketMetricSet>> {
  const map = new Map<number, ZendeskTicketMetricSet>();

  for (let i = 0; i < ticketIds.length; i += 100) {
    const batch = ticketIds.slice(i, i + 100);
    const response = await client.get<ZendeskShowManyResponse>(
      `/tickets/show_many.json?ids=${batch.join(',')}&include=metric_sets`,
    );
    for (const ms of response.data.metric_sets) {
      map.set(ms.ticket_id, ms);
    }
  }

  return map;
}

// All CSAT surveys ANSWERED in the period, org-wide, grouped by assignee — one
// paginated call chain per sync run (score=received returns good/bad only; last
// week that was 133 rows vs 3,707 with the unanswered "offered" rows included).
// The endpoint rejects end_time less than 60s old, so live-sync bounds are clamped.
async function fetchReceivedRatings(
  client: AxiosInstance,
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<number, ZendeskSatisfactionRating[]>> {
  const byAssignee = new Map<number, ZendeskSatisfactionRating[]>();
  const startTime = Math.floor(periodStart.getTime() / 1000);
  const endTime = Math.min(
    Math.floor(periodEnd.getTime() / 1000),
    Math.floor(Date.now() / 1000) - 90,
  );
  if (endTime <= startTime) return byAssignee;

  let url: string | null =
    `/satisfaction_ratings.json?score=received&start_time=${startTime}&end_time=${endTime}`;
  while (url) {
    const response: AxiosResponse<ZendeskSatisfactionRatingsResponse> = await client.get(url);
    for (const rating of response.data.satisfaction_ratings) {
      if (rating.assignee_id === null) continue; // unassigned ticket — attributable to no agent
      const list = byAssignee.get(rating.assignee_id) ?? [];
      list.push(rating);
      byAssignee.set(rating.assignee_id, list);
    }
    url = response.data.next_page;
  }
  return byAssignee;
}

// Bulk fetch of all Zendesk Talk calls in the period, grouped by agent.
// Uses the incremental export endpoint to get all calls org-wide without per-agent limits.
async function fetchTalkCalls(
  client: AxiosInstance,
  periodStart: Date,
): Promise<Map<number, ZendeskCall[]>> {
  const byAssignee = new Map<number, ZendeskCall[]>();
  const startTime = Math.floor(periodStart.getTime() / 1000);
  
  let url: string | null = `/channels/voice/incremental/calls.json?start_time=${startTime}`;
  
  while (url) {
    const response: AxiosResponse<ZendeskCallsResponse> = await client.get(url);
    if (!response.data.calls) break;
    
    for (const call of response.data.calls) {
      if (call.agent_id === null) continue;
      
      const list = byAssignee.get(call.agent_id) ?? [];
      list.push(call);
      byAssignee.set(call.agent_id, list);
    }
    
    // Zendesk incremental APIs return next_page even when empty, so we must stop when count is < 1000 or empty.
    if (response.data.calls.length === 0) break;
    url = response.data.next_page;
  }
  
  return byAssignee;
}

async function fetchSlaReplyTarget(client: AxiosInstance): Promise<number | null> {
  try {
    const response = await client.get<ZendeskSlaPoliciesResponse>('/slas/policies');
    const first = response.data.sla_policies[0];
    if (!first) return null;
    const metric = first.policy_metrics.find(
      m => m.metric === 'first_reply_time' && m.priority === 'normal',
    );
    return metric?.target ?? null;
  } catch {
    return null;
  }
}

// --- Connector (fetcher — metric computation lives in apps/api/src/metrics/) ---

export interface ZendeskRunContext {
  client: AxiosInstance;
  slaTargetMinutes: number | null;
  ratingsByAssignee: Map<number, ZendeskSatisfactionRating[]>;
  callsByAssignee: Map<number, ZendeskCall[]>;
}

export const zendeskConnector: DataSourceConnector<ZendeskRunContext, ZendeskWeekData> = {
  name: 'zendesk',
  isAvailable: true,

  // Org-wide data fetched once per sync run instead of once per employee: the SLA
  // policy target (L3: previously 247 identical /slas/policies calls per run) and
  // the period's answered CSAT surveys (submitted-in-period semantics, commit 7).
  async prepareRun(periodStart: Date, periodEnd: Date): Promise<ZendeskRunContext> {
    const client = createZendeskClient();
    const [slaTargetMinutes, ratingsByAssignee, callsByAssignee] = await Promise.all([
      fetchSlaReplyTarget(client),
      fetchReceivedRatings(client, periodStart, periodEnd),
      fetchTalkCalls(client, periodStart),
    ]);
    return { client, slaTargetMinutes, ratingsByAssignee, callsByAssignee };
  },

  async fetchWeekData(
    agentId: string,
    periodStart: Date,
    periodEnd: Date,
    run: ZendeskRunContext,
  ): Promise<ZendeskWeekData | null> {
    const [tickets, openTickets] = await Promise.all([
      searchTickets(run.client, agentId, periodStart, periodEnd),
      searchOpenTickets(run.client, agentId)
    ]);
    const metricSets =
      tickets.length > 0
        ? await fetchTicketMetrics(run.client, tickets.map(t => t.id))
        : new Map<number, ZendeskTicketMetricSet>();
    return {
      tickets,
      openTickets,
      calls: run.callsByAssignee.get(Number(agentId)) ?? [],
      metricSets,
      slaTargetMinutes: run.slaTargetMinutes,
      ratings: run.ratingsByAssignee.get(Number(agentId)) ?? [],
      periodStart,
      periodEnd,
    };
  },

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = createZendeskClient();
      await client.get('/users/me.json');
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  },
};
