import { and, asc, desc, eq, inArray, notLike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceRecords } from "@/lib/db/schema";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import {
  advanceTicketActionExport,
  readTicketActionState,
  type TicketActionExportScope,
} from "./ticket-action-checkpoint";
import { advanceAgentLegExport, readAgentLegState } from "./agent-leg-checkpoint";

const DAY = 86_400_000;
const CHECKPOINTS = [
  "zendesk_ticket_action_checkpoint_v2_shadow",
  "zendesk_agent_leg_checkpoint_v2_shadow",
];

/** Resume the oldest unfinished day, then catch up sequentially after downtime. */
export async function nextActionShadowScope(
  organizationId: string,
  dataSourceId: string,
  now = new Date()
) {
  await assertOrganizationResource(organizationId, "source", dataSourceId);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const latestEnd = now.getTime() - midnight < 120_000 ? midnight - DAY : midnight;
  const filter = and(
    eq(sourceRecords.dataSourceId, dataSourceId),
    notLike(sourceRecords.externalRecordId, "%/observation/%"),
    inArray(sourceRecords.externalRecordType, CHECKPOINTS)
  );
  const [pending] = await db
    .select({ key: sourceRecords.externalRecordId })
    .from(sourceRecords)
    .where(filter)
    .groupBy(sourceRecords.externalRecordId)
    .having(sql`count(*) <> 2 OR bool_or(${sourceRecords.payloadJson}->>'status' <> 'complete')`)
    .orderBy(asc(sourceRecords.externalRecordId))
    .limit(1);
  if (pending) {
    const [from, until] = pending.key.split("/");
    const start = new Date(from!),
      endExclusive = new Date(until!);
    if (
      !Number.isFinite(start.getTime()) ||
      endExclusive.getTime() - start.getTime() !== DAY ||
      endExclusive.getTime() > latestEnd
    ) {
      throw new Error("Shadow worker requires a valid closed daily checkpoint");
    }
    return { organizationId, dataSourceId, start, endExclusive };
  }
  const [last] = await db
    .select({ key: sourceRecords.externalRecordId })
    .from(sourceRecords)
    .where(filter)
    .orderBy(desc(sourceRecords.externalRecordId))
    .limit(1);
  const lastEnd = last ? Date.parse(last.key.split("/")[1]!) : latestEnd - DAY;
  if (!Number.isFinite(lastEnd)) throw new Error("Invalid shadow export checkpoint");
  const start = new Date(Math.min(lastEnd, latestEnd - DAY));
  return { organizationId, dataSourceId, start, endExclusive: new Date(start.getTime() + DAY) };
}

export async function runActionShadowBatch(
  scope: TicketActionExportScope,
  getPage: (path: string) => Promise<unknown>,
  options: { maxPages?: number; maxDurationMs?: number } = {}
) {
  const maxPages = options.maxPages ?? 6,
    maxDurationMs = options.maxDurationMs ?? 200_000;
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 20 ||
    !Number.isFinite(maxDurationMs) ||
    maxDurationMs < 35_000 ||
    maxDurationMs > 240_000
  ) {
    throw new Error("Invalid shadow worker budget");
  }
  const started = Date.now();
  let steps = 0;
  let tickets = await readTicketActionState(scope);
  let legs = await readAgentLegState(scope);
  while (steps < maxPages && Date.now() - started < maxDurationMs - 35_000) {
    let attempted = false;
    for (const stream of ["tickets", "legs"] as const) {
      const state = stream === "tickets" ? tickets : legs;
      if (
        state.status === "complete" ||
        (state.notBefore && Date.parse(state.notBefore) > Date.now())
      )
        continue;
      if (steps >= maxPages || Date.now() - started >= maxDurationMs - 35_000) break;
      attempted = true;
      steps++;
      if (stream === "tickets") tickets = (await advanceTicketActionExport(scope, getPage)).state;
      else legs = (await advanceAgentLegExport(scope, getPage)).state;
      // Let the other stream advance once even if ticket coverage is still waiting.
    }
    if (!attempted || tickets.status === "waiting") break;
  }
  return {
    periodStart: scope.start.toISOString(),
    periodEndExclusive: scope.endExclusive.toISOString(),
    observationId: scope.observationId ?? null,
    completed: tickets.status === "complete" && legs.status === "complete",
    steps,
    streams: {
      tickets: { status: tickets.status, pages: tickets.pages, notBefore: tickets.notBefore },
      legs: { status: legs.status, pages: legs.pages, notBefore: legs.notBefore },
    },
  };
}
