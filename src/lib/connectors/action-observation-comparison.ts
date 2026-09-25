import { readTicketActionExport, type TicketActionExportScope } from "./ticket-action-checkpoint";
import { readAgentLegExport } from "./agent-leg-checkpoint";

function differences<T extends { id: number }>(previous: T[], current: T[]) {
  const before = new Map(previous.map((record) => [record.id, JSON.stringify(record)]));
  const after = new Map(current.map((record) => [record.id, JSON.stringify(record)]));
  return {
    added: [...after.keys()].filter((id) => !before.has(id)).sort((a, b) => a - b),
    removed: [...before.keys()].filter((id) => !after.has(id)).sort((a, b) => a - b),
    changed: [...after.keys()]
      .filter((id) => before.has(id) && before.get(id) !== after.get(id))
      .sort((a, b) => a - b),
  };
}

/** Internal evidence only. Completion is required; differences never publish corrections. */
export async function compareActionObservation(
  scope: TicketActionExportScope,
  observationId: string
) {
  const initial = { ...scope, observationId: undefined };
  const revised = { ...scope, observationId };
  const [beforeTickets, afterTickets, beforeLegs, afterLegs] = await Promise.all([
    readTicketActionExport(initial),
    readTicketActionExport(revised),
    readAgentLegExport(initial),
    readAgentLegExport(revised),
  ]);
  if (!beforeTickets.cohort || !afterTickets.cohort || !beforeLegs.cohort || !afterLegs.cohort)
    return { status: "incomplete" as const, tickets: null, legs: null };
  return {
    status: "review_required" as const,
    tickets: differences(beforeTickets.cohort.events, afterTickets.cohort.events),
    legs: differences(beforeLegs.cohort.legs, afterLegs.cohort.legs),
  };
}
