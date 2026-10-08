import { POS_INBOUND_CONTRACT, readMetricSourceContext } from "./source-context";

const keys = new Set([
  "inbound_calls_accepted",
  "declined_calls",
  "missed_calls",
  "avg_talk_time_inbound",
  "avg_hold_time_inbound",
  "avg_call_duration_inbound",
  "avg_consultation_time_inbound",
]);
interface Contributor {
  id: string;
  dimensionsJson: unknown;
  recordType: string;
  recordContract: unknown;
}
/** Replace exact legacy call summaries only; never blend two qualified definitions. */
export function selectPosInboundContributors<T extends Contributor>(key: string, facts: T[]) {
  const replacement = facts.filter(
    (f) => readMetricSourceContext(f.dimensionsJson)?.sourceContract === POS_INBOUND_CONTRACT
  );
  if (!replacement.length) return { selected: facts, supersededFactIds: [] as string[] };
  if (
    !keys.has(key) ||
    replacement.length !== 1 ||
    replacement[0]!.recordType !== "pos_inbound_report_summary" ||
    replacement[0]!.recordContract !== POS_INBOUND_CONTRACT
  )
    throw Error("Invalid POS inbound replacement contributor");
  const legacy = facts.filter((f) => f !== replacement[0]);
  if (
    legacy.some(
      (f) =>
        f.recordType !== "call_stats" ||
        f.recordContract !== undefined ||
        readMetricSourceContext(f.dimensionsJson) !== null
    )
  )
    throw Error("POS inbound cannot supersede an unknown or qualified source contract");
  return { selected: replacement, supersededFactIds: legacy.map((f) => f.id) };
}
