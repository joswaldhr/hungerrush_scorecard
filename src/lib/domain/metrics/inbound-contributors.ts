import { INBOUND_PARTICIPATION_CONTRACT, readMetricSourceContext } from "./source-context";
const keys = new Set([
  "inbound_calls_offered",
  "inbound_calls_accepted",
  "declined_calls",
  "missed_calls",
  "inbound_calls_unreachable",
  "inbound_calls_answer_rate",
  "inbound_calls_abandoned_on_hold",
  "total_talk_time_inbound",
  "max_hold_time_inbound",
]);
interface Contributor {
  id: string;
  dimensionsJson: unknown;
  recordType: string;
  recordContract: unknown;
}
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
