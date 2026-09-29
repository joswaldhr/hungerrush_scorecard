import { INBOUND_PARTICIPATION_CONTRACT, readMetricSourceContext } from "./source-context";

interface Contributor {
  id: string;
  dimensionsJson: unknown;
  recordType: string;
  recordContract: unknown;
}
const keys = new Set([
  "inbound_calls_offered",
  "inbound_calls_accepted",
  "inbound_calls_abandoned_on_hold",
  "missed_calls",
  "declined_calls",
  "avg_talk_time_inbound",
  "avg_hold_time_inbound",
  "avg_call_duration_inbound",
  "avg_consultation_time_inbound",
]);

/** Retain legacy facts; only one dedicated employee-period snapshot may replace them. */
export function selectInboundContributors<T extends Contributor>(key: string, facts: T[]) {
  const replacements = facts.filter(
    (f) =>
      readMetricSourceContext(f.dimensionsJson)?.sourceContract === INBOUND_PARTICIPATION_CONTRACT
  );
  if (!replacements.length) return { selected: facts, supersededFactIds: [] as string[] };
  if (
    !keys.has(key) ||
    replacements.length !== 1 ||
    replacements[0]!.recordType !== "inbound_participation_summary" ||
    replacements[0]!.recordContract !== INBOUND_PARTICIPATION_CONTRACT
  )
    throw Error("Invalid inbound replacement contributor");
  const legacy = facts.filter((f) => f !== replacements[0]);
  if (
    legacy.some(
      (f) =>
        f.recordType !== "call_stats" ||
        f.recordContract !== undefined ||
        readMetricSourceContext(f.dimensionsJson) !== null
    )
  )
    throw Error("Inbound replacement cannot supersede an unknown source contract");
  return { selected: replacements, supersededFactIds: legacy.map((f) => f.id) };
}
