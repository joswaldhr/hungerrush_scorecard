import { FIRST_REPLY_CONTRACT, readMetricSourceContext } from "./source-context";

interface Contributor {
  id: string;
  dimensionsJson: unknown;
  recordType: string;
  recordContract: unknown;
}
/** Explicit prospective replacement, retaining legacy facts rather than deleting sibling evidence. */
export function selectFirstReplyContributors<T extends Contributor>(key: string, facts: T[]) {
  const replacements = facts.filter(
    (f) => readMetricSourceContext(f.dimensionsJson)?.sourceContract === FIRST_REPLY_CONTRACT
  );
  if (!replacements.length) return { selected: facts, supersededFactIds: [] as string[] };
  if (
    key !== "avg_response_time" ||
    replacements.length !== 1 ||
    replacements[0]!.recordType !== "first_reply_summary" ||
    replacements[0]!.recordContract !== FIRST_REPLY_CONTRACT
  )
    throw new Error("Invalid first-reply replacement contributor");
  const legacy = facts.filter((f) => f !== replacements[0]);
  if (
    legacy.some(
      (f) =>
        f.recordType !== "agent_stats" ||
        f.recordContract !== undefined ||
        readMetricSourceContext(f.dimensionsJson) !== null
    )
  )
    throw new Error("First-reply replacement cannot supersede an unknown source contract");
  return { selected: replacements, supersededFactIds: legacy.map((f) => f.id) };
}
