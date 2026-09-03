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
import { zendeskGet } from "./zendesk-shared";

const MAX_WEEKS_BACK = 4;

interface ZendeskTicket {
  id: number;
  status: string;
  assignee_id: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface ZendeskSearchResponse {
  results: ZendeskTicket[];
  next_page: string | null;
}

interface ZendeskTimeMetric {
  calendar: number;
  business: number;
}

interface ZendeskTicketMetricSet {
  ticket_id: number;
  full_resolution_time_in_minutes: ZendeskTimeMetric | null;
  reply_time_in_minutes: ZendeskTimeMetric | null;
}

interface ZendeskShowManyResponse {
  metric_sets: ZendeskTicketMetricSet[];
}

interface ZendeskSatisfactionRating {
  assignee_id: number | null;
  score: string;
}

interface ZendeskSatisfactionRatingsResponse {
  satisfaction_ratings: ZendeskSatisfactionRating[];
  next_page: string | null;
}

interface ZendeskUserSearchResponse {
  users: Array<{ id: number; email: string }>;
}

interface ZendeskGroupMembership {
  user_id: number;
  group_id: number;
}

interface ZendeskGroupMembershipsResponse {
  group_memberships: ZendeskGroupMembership[];
  next_page: string | null;
}

interface ZendeskUserDetail {
  id: number;
  email: string | null;
  name: string;
  active: boolean;
}

interface ZendeskShowManyUsersResponse {
  users: ZendeskUserDetail[];
}

interface ZendeskCall {
  agent_id: number | null;
  direction: string;
  completion_status: string;
  duration: number;
  talk_time: number;
  hold_time: number;
  consultation_time: number;
  created_at: string;
}

interface ZendeskCallsResponse {
  calls: ZendeskCall[];
  next_page: string | null;
  end_of_stream: boolean;
}

interface CallAggregate {
  inboundOffered: number;
  inboundAccepted: number;
  inboundAbandonedOnHold: number;
  avgTalkTimeInbound: number | null;
  avgHoldTimeInbound: number | null;
  avgDurationInbound: number | null;
  avgConsultationTimeInbound: number | null;
  outboundTotal: number;
  outboundCompleted: number;
  outboundNonAnswered: number;
  avgTalkTimeOutbound: number | null;
  avgHoldTimeOutbound: number | null;
}

function weekOf(weeksAgo: number): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7) - weeksAgo * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
  };
}

async function searchAllPages(query: string): Promise<ZendeskTicket[]> {
  const results: ZendeskTicket[] = [];
  let path: string | null = `/search.json?query=${encodeURIComponent(query)}`;
  while (path) {
    const res: ZendeskSearchResponse = await zendeskGet<ZendeskSearchResponse>(path);
    results.push(...res.results);
    path = res.next_page;
  }
  return results;
}

async function fetchMetricSets(ticketIds: number[]): Promise<Map<number, ZendeskTicketMetricSet>> {
  const map = new Map<number, ZendeskTicketMetricSet>();
  for (let i = 0; i < ticketIds.length; i += 100) {
    const batch = ticketIds.slice(i, i + 100);
    if (batch.length === 0) continue;
    const res = await zendeskGet<ZendeskShowManyResponse>(
      `/tickets/show_many.json?ids=${batch.join(",")}&include=metric_sets`
    );
    for (const ms of res.metric_sets) map.set(ms.ticket_id, ms);
  }
  return map;
}

async function fetchRatings(
  periodStart: string,
  periodEnd: string
): Promise<Map<number, ZendeskSatisfactionRating[]>> {
  const byAssignee = new Map<number, ZendeskSatisfactionRating[]>();
  const startTime = Math.floor(new Date(`${periodStart}T00:00:00Z`).getTime() / 1000);
  const endTime = Math.min(
    Math.floor(new Date(`${periodEnd}T23:59:59Z`).getTime() / 1000),
    Math.floor(Date.now() / 1000) - 90
  );
  if (endTime <= startTime) return byAssignee;

  let path: string | null =
    `/satisfaction_ratings.json?score=received&start_time=${startTime}&end_time=${endTime}`;
  while (path) {
    const res: ZendeskSatisfactionRatingsResponse =
      await zendeskGet<ZendeskSatisfactionRatingsResponse>(path);
    for (const rating of res.satisfaction_ratings) {
      if (rating.assignee_id === null) continue;
      const list = byAssignee.get(rating.assignee_id) ?? [];
      list.push(rating);
      byAssignee.set(rating.assignee_id, list);
    }
    path = res.next_page;
  }
  return byAssignee;
}

// The Talk incremental-calls endpoint is a forward cursor export (start_time
// only, no end_time) rather than a bounded search -- so pages are consumed
// until either Zendesk says end_of_stream or an entire page comes back past
// the target week, with a hard page cap as a safety valve.
async function fetchCallsForWeek(periodStart: string, periodEnd: string): Promise<ZendeskCall[]> {
  const startTime = Math.floor(new Date(`${periodStart}T00:00:00Z`).getTime() / 1000);
  const endTime = new Date(`${periodEnd}T23:59:59Z`).getTime();
  const calls: ZendeskCall[] = [];
  let path: string | null = `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`;
  let pages = 0;
  while (path && pages < 50) {
    const res: ZendeskCallsResponse = await zendeskGet<ZendeskCallsResponse>(path);
    pages++;
    let allPastWindow = res.calls.length > 0;
    for (const call of res.calls) {
      if (new Date(call.created_at).getTime() <= endTime) {
        calls.push(call);
        allPastWindow = false;
      }
    }
    if (res.end_of_stream || allPastWindow) break;
    path = res.next_page;
  }
  return calls;
}

// Only the fields confirmed on real call records map cleanly here. "Missed",
// "Declined", and transfer counts (w/ and w/o consult) are NOT available on
// individual call records in this Zendesk instance -- they only exist on the
// live-only agents_overview/agents_activity endpoints (see [[phone-system]]
// memory), which can't be queried historically. Deliberately not
// approximated from a proxy signal here.
function aggregateCalls(calls: ZendeskCall[]): CallAggregate {
  const inbound = calls.filter((c) => c.direction === "inbound");
  const outbound = calls.filter((c) => c.direction === "outbound");
  const inboundConsult = inbound.filter((c) => c.consultation_time > 0);

  return {
    inboundOffered: inbound.length,
    inboundAccepted: inbound.filter((c) => c.completion_status === "completed").length,
    inboundAbandonedOnHold: inbound.filter((c) => c.completion_status === "abandoned_on_hold")
      .length,
    avgTalkTimeInbound: averageOf(inbound.map((c) => c.talk_time)),
    avgHoldTimeInbound: averageOf(inbound.map((c) => c.hold_time)),
    avgDurationInbound: averageOf(inbound.map((c) => c.duration)),
    avgConsultationTimeInbound:
      inboundConsult.length > 0 ? averageOf(inboundConsult.map((c) => c.consultation_time)) : null,
    outboundTotal: outbound.length,
    outboundCompleted: outbound.filter((c) => c.completion_status === "completed").length,
    outboundNonAnswered: outbound.filter((c) => c.completion_status === "failed").length,
    avgTalkTimeOutbound: averageOf(outbound.map((c) => c.talk_time)),
    avgHoldTimeOutbound: averageOf(outbound.map((c) => c.hold_time)),
  };
}

function businessMinutes(metric: ZendeskTimeMetric | null | undefined): number | null {
  if (!metric) return null;
  if (metric.business === 0 && metric.calendar > 0) return null;
  return metric.business;
}

function averageOf(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10;
}

// Elevation is tracked with two different tagging conventions in this Zendesk
// instance: POS/CSG tickets carry a flat "elevated_csg" tag (plus a per-agent
// "elevated_<name>" tag), while Menufy tickets carry a per-agent
// "<name>_elevated" tag from the "Elevated by _MFY" field. Matching both
// patterns lets this stay one connector path instead of branching per team.
function isElevatedTicket(tags: string[]): boolean {
  return tags.some((t) => /^elevated_/i.test(t) || /_elevated$/i.test(t));
}

// Same two-convention split for "was the escalation avoidable": POS/CSG uses
// the "Unnecessary/Avoidable Escalation? _CSG" checkbox (tag
// "unnecessary_escalation"), Menufy uses the "Elevation Avoidable? _MFY"
// tagger field (tag "yes_avoidable").
function isAvoidableElevation(tags: string[]): boolean {
  return tags.includes("unnecessary_escalation") || tags.includes("yes_avoidable");
}

export class ZendeskConnector implements Connector {
  readonly sourceType = "zendesk";
  private emailToId = new Map<string, number>();

  async healthCheck(_config: ConnectorConfig): Promise<HealthStatus> {
    try {
      await zendeskGet(`/users/me.json`);
      return { connected: true, message: "Zendesk connection healthy", lastSyncAt: null };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : "Unknown error",
        lastSyncAt: null,
      };
    }
  }

  private async resolveNumericId(email: string): Promise<number | null> {
    const cached = this.emailToId.get(email);
    if (cached !== undefined) return cached;
    const res = await zendeskGet<ZendeskUserSearchResponse>(
      `/users/search.json?query=${encodeURIComponent(email)}`
    );
    const match = res.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) this.emailToId.set(email, match.id);
    return match?.id ?? null;
  }

  async resolveIdentities(
    _config: ConnectorConfig,
    externalIds: string[]
  ): Promise<IdentityMatch[]> {
    const matches: IdentityMatch[] = [];
    for (const email of externalIds) {
      const id = await this.resolveNumericId(email);
      if (id === null) continue;
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

    const { periodStart, periodEnd } = weekOf(weekOffset);
    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, config.dataSourceId));

    const ratingsByAssignee = await fetchRatings(periodStart, periodEnd);
    const calls = await fetchCallsForWeek(periodStart, periodEnd);

    const perEmployeeTickets = new Map<string, ZendeskTicket[]>();
    const perEmployeeOpen = new Map<string, ZendeskTicket[]>();
    const allTicketIds: number[] = [];

    for (const identity of identities) {
      const email = identity.externalId;
      const updatedQuery = `type:ticket assignee:${email} updated>=${periodStart} updated<=${periodEnd}`;
      const tickets = await searchAllPages(updatedQuery);
      perEmployeeTickets.set(email, tickets);
      allTicketIds.push(...tickets.map((t) => t.id));

      if (weekOffset === 0) {
        const openQuery = `type:ticket assignee:${email} status<solved`;
        perEmployeeOpen.set(email, await searchAllPages(openQuery));
      }
    }

    const metricSets = await fetchMetricSets(allTicketIds);
    const now = new Date();

    const records: IngestedRecord[] = [];
    for (const identity of identities) {
      const email = identity.externalId;
      const tickets = perEmployeeTickets.get(email) ?? [];
      const resolvedCount = tickets.filter(
        (t) => t.status === "solved" || t.status === "closed"
      ).length;

      const createdInPeriod = tickets.filter((t) => {
        const created = new Date(t.created_at).toISOString().split("T")[0]!;
        return created >= periodStart && created <= periodEnd;
      });
      const avgHandleTimeMinutes = averageOf(
        createdInPeriod.map((t) =>
          businessMinutes(metricSets.get(t.id)?.full_resolution_time_in_minutes)
        )
      );
      const avgResponseTimeMinutes = averageOf(
        createdInPeriod.map((t) => businessMinutes(metricSets.get(t.id)?.reply_time_in_minutes))
      );

      const backlogCount = weekOffset === 0 ? (perEmployeeOpen.get(email)?.length ?? 0) : null;

      const workedElevatedTickets = tickets.filter((t) => isElevatedTicket(t.tags)).length;
      const avoidableWorkedElevatedTickets = tickets.filter((t) =>
        isAvoidableElevation(t.tags)
      ).length;

      records.push({
        externalRecordType: "agent_stats",
        externalRecordId: `stats-${email}-${periodStart}`,
        employeeExternalId: email,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          ticketsResolved: resolvedCount,
          ticketsUpdated: tickets.length,
          avgHandleTimeMinutes,
          avgResponseTimeMinutes,
          backlogCount,
          workedElevatedTickets,
          avoidableWorkedElevatedTickets,
        },
        sourceUpdatedAt: now,
      });

      const numericId = await this.resolveNumericId(email);
      const ratings = numericId !== null ? (ratingsByAssignee.get(numericId) ?? []) : [];
      const rated = ratings.filter((r) => r.score === "good" || r.score === "bad");
      const good = rated.filter((r) => r.score === "good").length;
      const csatScore = rated.length === 0 ? null : Math.round((good / rated.length) * 10000) / 100;

      // null (not aggregated) when the agent's Zendesk id can't be resolved --
      // that's missing data, not a confirmed zero. An empty call list for a
      // resolved agent IS a confirmed zero and aggregates normally.
      const employeeCalls = numericId !== null ? calls.filter((c) => c.agent_id === numericId) : null;
      const callAgg = employeeCalls !== null ? aggregateCalls(employeeCalls) : null;

      records.push({
        externalRecordType: "call_stats",
        externalRecordId: `calls-${email}-${periodStart}`,
        employeeExternalId: email,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          inboundOffered: callAgg?.inboundOffered ?? null,
          inboundAccepted: callAgg?.inboundAccepted ?? null,
          inboundAbandonedOnHold: callAgg?.inboundAbandonedOnHold ?? null,
          avgTalkTimeInbound: callAgg?.avgTalkTimeInbound ?? null,
          avgHoldTimeInbound: callAgg?.avgHoldTimeInbound ?? null,
          avgDurationInbound: callAgg?.avgDurationInbound ?? null,
          avgConsultationTimeInbound: callAgg?.avgConsultationTimeInbound ?? null,
          outboundTotal: callAgg?.outboundTotal ?? null,
          outboundCompleted: callAgg?.outboundCompleted ?? null,
          outboundNonAnswered: callAgg?.outboundNonAnswered ?? null,
          avgTalkTimeOutbound: callAgg?.avgTalkTimeOutbound ?? null,
          avgHoldTimeOutbound: callAgg?.avgHoldTimeOutbound ?? null,
        },
        sourceUpdatedAt: now,
      });

      records.push({
        externalRecordType: "csat_summary",
        externalRecordId: `csat-${email}-${periodStart}`,
        employeeExternalId: email,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: { csatScore, totalRatings: rated.length },
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
      if ("ticketsResolved" in payload) {
        facts.push({
          employeeId,
          teamId,
          factType: "tickets_resolved",
          numericValue: payload.ticketsResolved as number,
          textValue: null,
          booleanValue: null,
          unit: "count",
          periodStart,
          periodEnd,
          dimensionsJson: null,
        });
        if (payload.ticketsUpdated != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "tickets_updated",
            numericValue: payload.ticketsUpdated as number,
            textValue: null,
            booleanValue: null,
            unit: "count",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.avgHandleTimeMinutes != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "avg_handle_time",
            numericValue: payload.avgHandleTimeMinutes as number,
            textValue: null,
            booleanValue: null,
            unit: "min",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.avgResponseTimeMinutes != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "avg_response_time",
            numericValue: payload.avgResponseTimeMinutes as number,
            textValue: null,
            booleanValue: null,
            unit: "min",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.backlogCount != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "backlog_count",
            numericValue: payload.backlogCount as number,
            textValue: null,
            booleanValue: null,
            unit: "count",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.workedElevatedTickets != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "worked_elevated_tickets",
            numericValue: payload.workedElevatedTickets as number,
            textValue: null,
            booleanValue: null,
            unit: "count",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.avoidableWorkedElevatedTickets != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "avoidable_worked_elevated_tickets",
            numericValue: payload.avoidableWorkedElevatedTickets as number,
            textValue: null,
            booleanValue: null,
            unit: "count",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
      }

      if ("inboundOffered" in payload) {
        const callFactMap: Array<[string, unknown, string]> = [
          ["inbound_calls_offered", payload.inboundOffered, "count"],
          ["inbound_calls_accepted", payload.inboundAccepted, "count"],
          ["inbound_calls_abandoned_on_hold", payload.inboundAbandonedOnHold, "count"],
          ["avg_talk_time_inbound", payload.avgTalkTimeInbound, "s"],
          ["avg_hold_time_inbound", payload.avgHoldTimeInbound, "s"],
          ["avg_call_duration_inbound", payload.avgDurationInbound, "s"],
          ["avg_consultation_time_inbound", payload.avgConsultationTimeInbound, "s"],
          ["outbound_calls", payload.outboundTotal, "count"],
          ["outbound_calls_completed", payload.outboundCompleted, "count"],
          ["outbound_calls_non_answered", payload.outboundNonAnswered, "count"],
          ["avg_talk_time_outbound", payload.avgTalkTimeOutbound, "s"],
          ["avg_hold_time_outbound", payload.avgHoldTimeOutbound, "s"],
        ];
        for (const [factType, value, unit] of callFactMap) {
          if (value == null) continue;
          facts.push({
            employeeId,
            teamId,
            factType,
            numericValue: value as number,
            textValue: null,
            booleanValue: null,
            unit,
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
      }

      if ("csatScore" in payload && payload.csatScore != null) {
        facts.push({
          employeeId,
          teamId,
          factType: "csat_score",
          numericValue: payload.csatScore as number,
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
      const userIds: number[] = [];
      let path: string | null = `/groups/${mapping.externalGroupId}/memberships.json`;
      while (path) {
        const res: ZendeskGroupMembershipsResponse =
          await zendeskGet<ZendeskGroupMembershipsResponse>(path);
        userIds.push(...res.group_memberships.map((m) => m.user_id));
        path = res.next_page;
      }

      for (let i = 0; i < userIds.length; i += 100) {
        const batch = userIds.slice(i, i + 100);
        if (batch.length === 0) continue;
        const res = await zendeskGet<ZendeskShowManyUsersResponse>(
          `/users/show_many.json?ids=${batch.join(",")}`
        );
        for (const user of res.users) {
          if (!user.active || !user.email) continue;
          if (seenExternalIds.has(user.email)) continue;
          seenExternalIds.add(user.email);
          members.push({
            externalId: user.email,
            externalEmail: user.email,
            externalDisplayName: user.name,
            teamId: mapping.teamId,
          });
        }
      }
    }

    return members;
  }
}
