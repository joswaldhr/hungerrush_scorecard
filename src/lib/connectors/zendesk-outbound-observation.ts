import { z } from "zod";
import { calculateOutboundParticipation, type OutboundScope } from "./zendesk-outbound";
import {
  outboundTicketCohort,
  outboundTicketMetadataSchema,
  type collectOutboundTicketGroups,
} from "./zendesk-outbound-tickets";
import {
  validateTalkObservation,
  type TalkCollectionSnapshot,
  type TalkObservationLimits,
} from "./zendesk-talk-observation";

const snapshotSchema = z.object({
  tickets: z.array(outboundTicketMetadataSchema).max(10000),
  coverage: z.object({
    complete: z.literal(true),
    accountReference: z.string(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    timeZone: z.string(),
    observationStartedAt: z.iso.datetime({ offset: true }),
    observationEndedAt: z.iso.datetime({ offset: true }),
    requestedTickets: z.number().int().nonnegative(),
    returnedTickets: z.number().int().nonnegative(),
    unlinkedCalls: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
    callPopulationDigest: z.string().regex(/^[a-f0-9]{64}$/),
    scopeMeaning: z.literal("current-linked-ticket-group"),
  }),
});

/** Inactive qualification boundary. It never fetches, publishes, or certifies independent parity. */
export function prepareOutboundObservation(
  snapshot: TalkCollectionSnapshot,
  ticketSnapshot: Awaited<ReturnType<typeof collectOutboundTicketGroups>>,
  expectedAccountReference: string,
  scope: OutboundScope,
  limits: TalkObservationLimits,
  now = new Date()
) {
  const provenance = validateTalkObservation(
    snapshot,
    expectedAccountReference,
    scope,
    limits,
    now
  );
  const parsed = snapshotSchema.safeParse(ticketSnapshot);
  if (!parsed.success) throw Error("Invalid outbound ticket observation");
  const { tickets, coverage } = parsed.data;
  if (
    coverage.accountReference !== expectedAccountReference ||
    coverage.periodStart !== scope.periodStart ||
    coverage.periodEnd !== scope.periodEnd ||
    coverage.timeZone !== scope.timeZone
  )
    throw Error("Outbound ticket observation scope mismatch");
  const start = Date.parse(coverage.observationStartedAt),
    end = Date.parse(coverage.observationEndedAt);
  if (start > end || end > now.getTime() || tickets.some((t) => Date.parse(t.updated_at) > end))
    throw Error("Invalid outbound ticket observation chronology");
  if (now.getTime() - end > limits.maxAgeMs) throw Error("Outbound ticket observation is stale");
  const combinedStart = Math.min(start, Date.parse(provenance.observationStartedAt));
  const combinedEnd = Math.max(end, Date.parse(provenance.observationEndedAt));
  if (combinedEnd - combinedStart > limits.maxSpanMs)
    throw Error("Outbound source observations span too wide a window");
  const expected = outboundTicketCohort(snapshot.calls, {
    ...scope,
    accountReference: expectedAccountReference,
  });
  const received = new Set(tickets.map((t) => t.id));
  if (
    coverage.callPopulationDigest !== expected.callPopulationDigest ||
    coverage.unlinkedCalls !== expected.unlinkedCalls ||
    coverage.requestedTickets !== expected.ticketIds.length ||
    coverage.returnedTickets !== tickets.length ||
    coverage.requests !== Math.ceil(expected.ticketIds.length / 100) ||
    tickets.length !== received.size ||
    received.size !== expected.ticketIds.length ||
    expected.ticketIds.some((id) => !received.has(id))
  )
    throw Error("Outbound ticket observation does not cover the exact call snapshot");
  const result = calculateOutboundParticipation(snapshot.calls, tickets, snapshot.legs, scope);
  return {
    result,
    provenance: {
      ...provenance,
      observationStartedAt: new Date(combinedStart).toISOString(),
      observationEndedAt: new Date(combinedEnd).toISOString(),
      ticketObservationStartedAt: coverage.observationStartedAt,
      ticketObservationEndedAt: coverage.observationEndedAt,
      ticketScopeMeaning: coverage.scopeMeaning,
      ticketCount: tickets.length,
      unlinkedCalls: expected.unlinkedCalls,
      callPopulationDigest: expected.callPopulationDigest,
    },
  };
}
