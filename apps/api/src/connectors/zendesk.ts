import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type { DataSourceConnector, ConnectorMetricResult } from '@scorecard/shared';
import type {
  ZendeskTicket,
  ZendeskSearchResponse,
  ZendeskTicketMetricSet,
  ZendeskShowManyResponse,
  ZendeskSlaPoliciesResponse,
} from '../types/zendesk.js';

function createClient(): AxiosInstance {
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

// --- Metric computation ---

function roundPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function computeAllMetrics(
  tickets: ZendeskTicket[],
  metricSets: Map<number, ZendeskTicketMetricSet>,
  slaTargetMinutes: number | null,
): {
  ticketVolume: number;
  firstReplyTime: number;
  csatScore: number;
  slaCompliance: number;
  resolutionRate: number;
} {
  if (tickets.length === 0) {
    return { ticketVolume: 0, firstReplyTime: 0, csatScore: 0, slaCompliance: 0, resolutionRate: 0 };
  }

  const ticketVolume = tickets.length;

  const replySeconds: number[] = [];
  for (const t of tickets) {
    const ms = metricSets.get(t.id);
    if (ms?.reply_time_in_minutes) {
      replySeconds.push(ms.reply_time_in_minutes.business * 60);
    }
  }
  const firstReplyTime =
    replySeconds.length > 0
      ? Math.round(replySeconds.reduce((a, b) => a + b, 0) / replySeconds.length)
      : 0;

  let good = 0;
  let rated = 0;
  for (const t of tickets) {
    const score = t.satisfaction_rating?.score;
    if (score === 'good' || score === 'bad') {
      rated++;
      if (score === 'good') good++;
    }
  }
  const csatScore = roundPercent(good, rated);

  let slaCompliance = 0;
  if (slaTargetMinutes !== null && replySeconds.length > 0) {
    const targetSeconds = slaTargetMinutes * 60;
    const met = replySeconds.filter(s => s <= targetSeconds).length;
    slaCompliance = roundPercent(met, replySeconds.length);
  }

  const resolved = tickets.filter(t => t.status === 'solved' || t.status === 'closed').length;
  const resolutionRate = roundPercent(resolved, ticketVolume);

  return { ticketVolume, firstReplyTime, csatScore, slaCompliance, resolutionRate };
}

// --- Connector ---

export const zendeskConnector: DataSourceConnector = {
  name: 'zendesk',
  isAvailable: true,

  async fetchAgentMetrics(
    agentId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ConnectorMetricResult[]> {
    const client = createClient();

    const [tickets, slaTargetMinutes] = await Promise.all([
      searchTickets(client, agentId, periodStart, periodEnd),
      fetchSlaReplyTarget(client),
    ]);

    const ticketIds = tickets.map(t => t.id);
    const metricSets =
      ticketIds.length > 0
        ? await fetchTicketMetrics(client, ticketIds)
        : new Map<number, ZendeskTicketMetricSet>();

    const computed = computeAllMetrics(tickets, metricSets, slaTargetMinutes);

    const rawSource: Record<string, unknown> = {
      zendeskAgentId: agentId,
      ticketCount: tickets.length,
      ticketsWithMetrics: metricSets.size,
      slaTargetMinutes,
    };

    const base = { employeeId: agentId, periodStart, periodEnd };

    return [
      { ...base, metricKey: 'ticket_volume', value: computed.ticketVolume, unit: 'count', rawSource: { ...rawSource } },
      { ...base, metricKey: 'first_reply_time', value: computed.firstReplyTime, unit: 'seconds', rawSource: { ...rawSource } },
      { ...base, metricKey: 'csat_score', value: computed.csatScore, unit: 'percent', rawSource: { ...rawSource } },
      { ...base, metricKey: 'sla_compliance', value: computed.slaCompliance, unit: 'percent', rawSource: { ...rawSource } },
      { ...base, metricKey: 'resolution_rate', value: computed.resolutionRate, unit: 'percent', rawSource: { ...rawSource } },
    ];
  },

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const client = createClient();
      await client.get('/users/me.json');
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  },
};
