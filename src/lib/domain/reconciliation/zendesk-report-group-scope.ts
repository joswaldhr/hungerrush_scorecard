/** Report labels are filters, not permission to union every historical alias. */
export interface ReportGroup {
  id: number;
  name: string;
}
export interface ReportGroupRename {
  groupId: number;
  from: string;
  to: string;
}

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0;
}

/** Separate exact observed names from renamed candidates requiring source-set proof. */
export function resolveReportGroupLabels(
  labels: string[],
  groups: ReportGroup[],
  renames: ReportGroupRename[]
) {
  if (
    !labels.length ||
    labels.some((label) => !label || label !== label.trim()) ||
    new Set(labels).size !== labels.length ||
    groups.some((group) => !validId(group.id) || !group.name) ||
    new Set(groups.map((group) => group.id)).size !== groups.length ||
    renames.some((rename) => !validId(rename.groupId) || !rename.from || !rename.to)
  )
    throw Error("Invalid report group evidence");
  const exactIds = new Set<number>();
  const historicalAliases: Array<{ label: string; groupId: number }> = [];
  const unknownLabels: string[] = [];
  for (const label of labels) {
    const exact = groups.filter((group) => group.name === label);
    if (exact.length > 1) throw Error("Ambiguous report group name");
    if (exact.length === 1) {
      exactIds.add(exact[0]!.id);
      continue;
    }
    const candidates = new Set(
      renames
        .filter((rename) => rename.from === label || rename.to === label)
        .map((rename) => rename.groupId)
    );
    if (candidates.size > 1) throw Error("Ambiguous report group rename");
    const groupId = [...candidates][0];
    if (groupId === undefined || !groups.some((group) => group.id === groupId))
      unknownLabels.push(label);
    else historicalAliases.push({ label, groupId });
  }
  return {
    exactNameGroupIds: [...exactIds].sort((a, b) => a - b),
    historicalAliases,
    unknownLabels,
    requiresSourceSetQualification: historicalAliases.length > 0 || unknownLabels.length > 0,
  };
}

/** Independent report membership must match before accepting a reconstructed scope. */
export function compareReportSourceMembership(reportedIds: number[], reconstructedIds: number[]) {
  for (const ids of [reportedIds, reconstructedIds])
    if (ids.some((id) => !validId(id)) || new Set(ids).size !== ids.length)
      throw Error("Invalid or duplicate report source identity");
  const reported = new Set(reportedIds),
    reconstructed = new Set(reconstructedIds);
  const missing = reportedIds.filter((id) => !reconstructed.has(id)).sort((a, b) => a - b);
  const extra = reconstructedIds.filter((id) => !reported.has(id)).sort((a, b) => a - b);
  return { matches: !missing.length && !extra.length, missing, extra };
}
