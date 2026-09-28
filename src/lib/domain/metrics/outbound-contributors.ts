import { OUTBOUND_PARTICIPATION_CONTRACT, readMetricSourceContext } from "./source-context";

interface Contributor {
  id: string;
  dimensionsJson: unknown;
  recordType: string;
  recordContract: unknown;
}
const keys = new Set([
  "outbound_calls",
  "outbound_calls_completed",
  "outbound_calls_non_answered",
  "avg_talk_time_outbound",
  "avg_hold_time_outbound",
]);

/** Retain raw legacy facts; only an exact, dedicated employee snapshot can supersede them. */
export function selectOutboundContributors<T extends Contributor>(key: string, facts: T[]) {
  const replacements = facts.filter(
    (f) =>
      readMetricSourceContext(f.dimensionsJson)?.sourceContract === OUTBOUND_PARTICIPATION_CONTRACT
  );
  if (!replacements.length) return { selected: facts, supersededFactIds: [] as string[] };
  if (
    !keys.has(key) ||
    replacements.length !== 1 ||
    replacements[0]!.recordType !== "outbound_participation_summary" ||
    replacements[0]!.recordContract !== OUTBOUND_PARTICIPATION_CONTRACT
  )
    throw Error("Invalid outbound replacement contributor");
  const legacy = facts.filter((f) => f !== replacements[0]);
  if (
    legacy.some(
      (f) =>
        f.recordType !== "agent_stats" ||
        f.recordContract !== undefined ||
        readMetricSourceContext(f.dimensionsJson) !== null
    )
  )
    throw Error("Outbound replacement cannot supersede an unknown source contract");
  return { selected: replacements, supersededFactIds: legacy.map((f) => f.id) };
}
