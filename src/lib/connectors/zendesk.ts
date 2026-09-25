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
  ExistingRosterAssignment,
} from "./types";
import { db } from "@/lib/db";
import { externalIdentities, employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { zendeskGet, type RequestStats } from "./zendesk-shared";
import { logger } from "@/lib/logger";
import { fetchCompleteSearch, type SearchExportPage } from "./zendesk-search";
import { fetchCompleteTalkWeek, type TalkCall, type TalkPage } from "./zendesk-talk";
import { averageEvidence, sourceIds } from "./source-evidence";
import { normalizeSolvedCsatRecord } from "./zendesk-solved-csat-record";
import { normalizeFirstReplyRecord } from "./zendesk-first-reply-record";
import { FIRST_REPLY_CONTRACT } from "@/lib/domain/metrics/source-context";
import { configuredCsatPolicy } from "./zendesk-csat-config";
import { csatPolicyForPeriod } from "./zendesk-csat-policy";
import { mapWithConcurrency, weekDates } from "@/lib/utils";

// Real timing data (2026-09-10, see FOLLOWUPS.md) showed the per-employee
// ticket-search and identity-resolution loops -- not the Talk calls fetch --
// dominating fetch time: ~84 sequential requests each, one employee at a
// time. Neither Zendesk's Search nor Users API rate limit is confirmed in
// this codebase (only Talk's 10 req/min is documented), so this is a
// deliberately conservative concurrency rather than a measured maximum --
// zendeskGet's existing 429 retry/backoff is the safety net if it's still
// too aggressive for a given account.
const EMPLOYEE_FETCH_CONCURRENCY = 5;

export const MAX_WEEKS_BACK = 4;

interface ZendeskTicket {
  id: number;
  status: string;
  assignee_id: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface ZendeskTimeMetric {
  calendar: number | null;
  business: number | null;
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
  id: number;
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

interface ZendeskCall extends TalkCall {
  agent_id: number | null;
  direction: string;
  completion_status: string;
  duration: number;
  talk_time: number;
  hold_time: number;
  consultation_time: number;
  created_at: string;
}

interface CallAggregate {
  sourceEvidence: Record<string, unknown>;
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
  const { periodStart, periodEnd } = weekDates(weeksAgo);
  return { periodStart, periodEnd };
}

async function searchAllPages(query: string): Promise<ZendeskTicket[]> {
  return fetchCompleteSearch(query, (path) => zendeskGet<SearchExportPage<ZendeskTicket>>(path));
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
  const visited = new Set<string>();
  const ratingIds = new Set<number>();
  while (path) {
    if (visited.has(path) || visited.size >= 100)
      throw new Error("Zendesk ratings incomplete: pagination stalled or budget exhausted");
    visited.add(path);
    const res: ZendeskSatisfactionRatingsResponse =
      await zendeskGet<ZendeskSatisfactionRatingsResponse>(path);
    for (const rating of res.satisfaction_ratings) {
      if (!Number.isSafeInteger(rating.id) || rating.id <= 0 || ratingIds.has(rating.id))
        throw new Error("Zendesk ratings incomplete: invalid or repeated rating ID");
      ratingIds.add(rating.id);
      if (rating.assignee_id === null) continue;
      const list = byAssignee.get(rating.assignee_id) ?? [];
      list.push(rating);
      byAssignee.set(rating.assignee_id, list);
    }
    path = res.next_page;
  }
  return byAssignee;
}

async function fetchCallsForWeek(
  periodStart: string,
  periodEnd: string
): Promise<{ calls: ZendeskCall[]; diagnostics: Record<string, unknown> }> {
  const stats: RequestStats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
  const startedAt = Date.now();
  const { calls, pages } = await fetchCompleteTalkWeek(periodStart, periodEnd, (path) =>
    zendeskGet<TalkPage<ZendeskCall>>(path, stats)
  );
  const diagnostics = {
    periodStart,
    periodEnd,
    pages,
    callsCollected: calls.length,
    ...stats,
    totalMs: Date.now() - startedAt,
  };
  logger.info("Zendesk Talk calls fetch complete", diagnostics);
  return { calls, diagnostics };
}

// Only the fields confirmed on real call records map cleanly here. "Missed",
// "Declined", and transfer counts (w/ and w/o consult) are NOT available on
// individual call records. Historical leg exports expose these events, but
// their agent attribution, call joins and target contract must be qualified
// before publication (see zendesk-agent-legs and the September 25 investigation).
// Deliberately not approximated from whole-call fields here.
function aggregateCalls(calls: ZendeskCall[]): CallAggregate {
  const inbound = calls.filter((c) => c.direction === "inbound");
  const outbound = calls.filter((c) => c.direction === "outbound");
  const inboundConsult = inbound.filter((c) => c.consultation_time > 0);

  return {
    sourceEvidence: {
      contractVersion: 1,
      attribution: "first_answering_agent_whole_call",
      callIds: sourceIds(calls),
      inboundTalk: averageEvidence(inbound.map((c) => c.talk_time)),
      inboundHold: averageEvidence(inbound.map((c) => c.hold_time)),
      inboundDuration: averageEvidence(inbound.map((c) => c.duration)),
      inboundConsultation: averageEvidence(inboundConsult.map((c) => c.consultation_time)),
      outboundTalk: averageEvidence(outbound.map((c) => c.talk_time)),
      outboundHold: averageEvidence(outbound.map((c) => c.hold_time)),
    },
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
  // Zero elapsed business minutes can coexist with positive calendar minutes
  // (for example, work outside the schedule). Only null means unmeasured.
  // Dropping reported zeros biases the mean upward and changes its denominator.
  if (metric?.business == null) return null;
  if (!Number.isFinite(metric.business) || metric.business < 0)
    throw new Error("Invalid Zendesk business duration");
  return metric.business;
}

function averageOf(values: Array<number | null>): number | null {
  const evidence = averageEvidence(values);
  return evidence.numerator === null
    ? null
    : Math.round((evidence.numerator / evidence.denominator) * 10) / 10;
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
    config: ConnectorConfig,
    externalIds: string[]
  ): Promise<IdentityMatch[]> {
    const matches: IdentityMatch[] = [];
    for (const email of externalIds) {
      const id = await this.resolveNumericId(email);
      if (id === null) continue;
      const [identity] = await db
        .select()
        .from(externalIdentities)
        .where(
          and(
            eq(externalIdentities.externalId, email),
            eq(externalIdentities.dataSourceId, config.dataSourceId)
          )
        );
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
  ): Promise<{
    records: IngestedRecord[];
    cursor: string | null;
    hasMore: boolean;
    diagnostics?: Record<string, unknown>;
  }> {
    const weekOffset = ctx.cursor ? parseInt(ctx.cursor, 10) : 0;
    if (weekOffset >= MAX_WEEKS_BACK) {
      return { records: [], cursor: null, hasMore: false };
    }

    const { periodStart, periodEnd } = weekOf(weekOffset);
    const csatPolicy = csatPolicyForPeriod(configuredCsatPolicy(), config, periodStart);
    // Only active employees -- a departed employee's external_identities row
    // stays in the DB (roster departure never deletes it, just marks the
    // employee inactive and closes team_memberships), but there's no reason
    // to keep re-fetching their Zendesk data every sync. Found the hard way
    // (2026-09-15): a departed employee's ticket count for one week hit
    // 1,211 -- past Zendesk Search's ~1,000-result pagination ceiling -- and
    // crashed the entire week's sync for every other employee too. See
    // FOLLOWUPS.md.
    const identities = await db
      .select({ externalId: externalIdentities.externalId, teamId: employees.primaryTeamId })
      .from(externalIdentities)
      .innerJoin(employees, eq(externalIdentities.employeeId, employees.id))
      .where(
        and(
          eq(externalIdentities.dataSourceId, config.dataSourceId),
          eq(employees.employmentStatus, "active")
        )
      );

    // Coarse phase timing (2026-09-10): the Talk calls fetch turned out NOT
    // to be the bottleneck real data pointed to (11 pages, 42.5s, zero
    // 429s) -- ~85% of a real run's fetchMs was unaccounted for elsewhere.
    // 84 employee identities means both the ticket-search loop below and
    // resolveNumericId() in the record-building loop each make ~84
    // sequential Zendesk requests one at a time -- timing each phase here
    // to find out which one (or both) actually accounts for it, rather
    // than guessing a second time. See FOLLOWUPS.md.
    const ratingsStartedAt = Date.now();
    const csatOwned = (teamId: string | null | undefined) =>
      csatPolicy?.teams.some((team) => team.teamId === teamId) ?? false;
    const ratingsByAssignee = identities.some((identity) => !csatOwned(identity.teamId))
      ? await fetchRatings(periodStart, periodEnd)
      : new Map<number, ZendeskSatisfactionRating[]>();
    const ratingsMs = Date.now() - ratingsStartedAt;

    const { calls, diagnostics: callDiagnostics } = await fetchCallsForWeek(periodStart, periodEnd);

    const perEmployeeTickets = new Map<string, ZendeskTicket[]>();
    const perEmployeeOpen = new Map<string, ZendeskTicket[]>();
    const allTicketIds: number[] = [];

    const ticketSearchStartedAt = Date.now();
    const ticketResults = await mapWithConcurrency(
      identities,
      EMPLOYEE_FETCH_CONCURRENCY,
      async (identity) => {
        const email = identity.externalId;
        const updatedQuery = `type:ticket assignee:${email} updated>=${periodStart} updated<=${periodEnd}`;
        const tickets = await searchAllPages(updatedQuery);

        let openTickets: ZendeskTicket[] | null = null;
        if (weekOffset === 0) {
          const openQuery = `type:ticket assignee:${email} status<solved`;
          openTickets = await searchAllPages(openQuery);
        }
        return { email, tickets, openTickets };
      }
    );
    for (const { email, tickets, openTickets } of ticketResults) {
      perEmployeeTickets.set(email, tickets);
      allTicketIds.push(...tickets.map((t) => t.id));
      if (openTickets !== null) perEmployeeOpen.set(email, openTickets);
    }
    const ticketSearchMs = Date.now() - ticketSearchStartedAt;

    const metricSetsStartedAt = Date.now();
    const metricSets = await fetchMetricSets(allTicketIds);
    const metricSetsMs = Date.now() - metricSetsStartedAt;
    const now = new Date();

    const recordBuildStartedAt = Date.now();

    // Resolved up front, concurrently, so the record-building loop below can
    // stay synchronous -- resolveNumericId() is the one network call per
    // identity that made this loop slow (see EMPLOYEE_FETCH_CONCURRENCY).
    const numericIdByEmail = new Map<string, number | null>();
    await mapWithConcurrency(identities, EMPLOYEE_FETCH_CONCURRENCY, async (identity) => {
      const email = identity.externalId;
      numericIdByEmail.set(email, await this.resolveNumericId(email));
    });

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
          sourceEvidence: {
            contractVersion: 1,
            durationPolicy: "include_reported_business_zero",
            cohort: "current_assignee_last_updated_in_period",
            ticketIds: sourceIds(tickets),
            resolvedTicketIds: sourceIds(
              tickets.filter((t) => t.status === "solved" || t.status === "closed")
            ),
            createdCohortIds: sourceIds(createdInPeriod),
            backlogTicketIds: weekOffset === 0 ? sourceIds(perEmployeeOpen.get(email) ?? []) : null,
            fullResolutionBusinessMinutes: averageEvidence(
              createdInPeriod.map((t) =>
                businessMinutes(metricSets.get(t.id)?.full_resolution_time_in_minutes)
              )
            ),
            firstReplyBusinessMinutes: averageEvidence(
              createdInPeriod.map((t) =>
                businessMinutes(metricSets.get(t.id)?.reply_time_in_minutes)
              )
            ),
          },
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

      const numericId = numericIdByEmail.get(email) ?? null;
      const ratings = numericId !== null ? (ratingsByAssignee.get(numericId) ?? []) : [];
      const rated = ratings.filter((r) => r.score === "good" || r.score === "bad");
      const good = rated.filter((r) => r.score === "good").length;
      const csatScore = rated.length === 0 ? null : Math.round((good / rated.length) * 10000) / 100;

      // null (not aggregated) when the agent's Zendesk id can't be resolved --
      // that's missing data, not a confirmed zero. An empty call list for a
      // resolved agent IS a confirmed zero and aggregates normally.
      const employeeCalls =
        numericId !== null ? calls.filter((c) => c.agent_id === numericId) : null;
      const callAgg = employeeCalls !== null ? aggregateCalls(employeeCalls) : null;

      records.push({
        externalRecordType: "call_stats",
        externalRecordId: `calls-${email}-${periodStart}`,
        employeeExternalId: email,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          sourceEvidence: callAgg?.sourceEvidence ?? {
            contractVersion: 1,
            identityResolved: false,
          },
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

      if (!csatOwned(identity.teamId))
        records.push({
          externalRecordType: "csat_summary",
          externalRecordId: `csat-${email}-${periodStart}`,
          employeeExternalId: email,
          occurredAt: now,
          periodStart,
          periodEnd,
          payload: {
            csatScore,
            totalRatings: rated.length,
            sourceEvidence: {
              contractVersion: 1,
              identityResolved: numericId !== null,
              ratingIds: sourceIds(rated),
              numerator: good,
              denominator: rated.length,
            },
          },
          sourceUpdatedAt: now,
        });
    }

    const recordBuildMs = Date.now() - recordBuildStartedAt;

    logger.info("Zendesk fetchRecords phase timing", {
      periodStart,
      periodEnd,
      identityCount: identities.length,
      ratingsMs,
      ticketSearchMs,
      metricSetsMs,
      recordBuildMs,
      allTicketIdsCount: allTicketIds.length,
    });

    return {
      records,
      cursor: String(weekOffset + 1),
      hasMore: weekOffset + 1 < MAX_WEEKS_BACK,
      diagnostics: {
        callsFetch: callDiagnostics,
        identityCount: identities.length,
        ratingsMs,
        ticketSearchMs,
        metricSetsMs,
        recordBuildMs,
      },
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
      if ("sourceContract" in payload) {
        // Explicit contracts must validate; never fall back to legacy CSAT parsing.
        facts.push(
          ...(payload.sourceContract === FIRST_REPLY_CONTRACT
            ? normalizeFirstReplyRecord(payload, employeeId, teamId, periodStart, periodEnd)
            : normalizeSolvedCsatRecord(payload, employeeId, teamId, periodStart, periodEnd))
        );
        continue;
      }
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
    groupMappings: RosterGroupMapping[],
    existingAssignments: ExistingRosterAssignment[] = []
  ): Promise<DiscoveredRosterMember[]> {
    if (groupMappings.length === 0) return [];

    const seenExternalIds = new Map<
      string,
      { userId: number; member: DiscoveredRosterMember; lines: Set<string | null> }
    >();

    for (const mapping of groupMappings) {
      if (!/^\d+$/.test(mapping.externalGroupId))
        throw new Error("Invalid roster group identifier");
      const userIds: number[] = [];
      const visited = new Set<string>();
      let path: string | null = `/groups/${mapping.externalGroupId}/memberships.json`;
      while (path) {
        if (visited.has(path) || visited.size >= 100)
          throw new Error("Roster membership pagination did not complete");
        visited.add(path);
        const res: ZendeskGroupMembershipsResponse =
          await zendeskGet<ZendeskGroupMembershipsResponse>(path);
        if (
          !Array.isArray(res.group_memberships) ||
          res.group_memberships.some(
            (member) =>
              !Number.isSafeInteger(member.user_id) ||
              member.user_id <= 0 ||
              String(member.group_id) !== mapping.externalGroupId
          ) ||
          !(
            res.next_page === null ||
            (typeof res.next_page === "string" && res.next_page.length > 0)
          )
        )
          throw new Error("Incomplete or invalid roster membership response");
        userIds.push(...res.group_memberships.map((m) => m.user_id));
        path = res.next_page;
      }

      const uniqueUserIds = [...new Set(userIds)];
      for (let i = 0; i < uniqueUserIds.length; i += 100) {
        const batch = uniqueUserIds.slice(i, i + 100);
        if (batch.length === 0) continue;
        const res = await zendeskGet<ZendeskShowManyUsersResponse>(
          `/users/show_many.json?ids=${batch.join(",")}`
        );
        if (
          !Array.isArray(res.users) ||
          res.users.length !== batch.length ||
          new Set(res.users.map((user) => user.id)).size !== batch.length ||
          res.users.some(
            (user) =>
              !batch.includes(user.id) ||
              typeof user.active !== "boolean" ||
              !(user.email === null || typeof user.email === "string") ||
              typeof user.name !== "string"
          )
        )
          throw new Error("Roster user lookup did not return every requested account");
        for (const user of res.users) {
          if (!user.active || !user.email) continue;
          const key = user.email.trim().toLowerCase();
          const previous = seenExternalIds.get(key);
          if (previous) {
            if (previous.userId !== user.id || previous.member.teamId !== mapping.teamId) {
              throw new Error("Roster identity has conflicting accounts or team mappings");
            }
            previous.lines.add(mapping.line ?? null);
            continue;
          }
          seenExternalIds.set(key, {
            userId: user.id,
            lines: new Set([mapping.line ?? null]),
            member: {
              externalId: user.email,
              externalEmail: user.email,
              externalDisplayName: user.name,
              teamId: mapping.teamId,
              line: mapping.line ?? null,
            },
          });
        }
      }
    }

    return [...seenExternalIds.entries()].map(([key, { member, lines }]) => {
      if (lines.size > 1) {
        // Group membership proves presence, not a new primary line. Retain an
        // existing assignment only when this same account is observed in it.
        const matches = existingAssignments.filter(
          (assignment) => assignment.externalId.trim().toLowerCase() === key
        );
        const existing = matches[0];
        if (
          matches.length !== 1 ||
          !existing ||
          existing.teamId !== member.teamId ||
          existing.line === null ||
          !lines.has(existing.line)
        )
          throw new Error("Roster identity has conflicting accounts or team mappings");
        return { ...member, externalId: existing.externalId, line: existing.line };
      }
      return member;
    });
  }
}
