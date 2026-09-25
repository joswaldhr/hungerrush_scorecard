export function averageEvidence(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  if (present.some((value) => !Number.isFinite(value)))
    throw new Error("Invalid numeric source observation");
  return {
    numerator: present.length ? present.reduce((sum, value) => sum + value, 0) : null,
    denominator: present.length,
  };
}

export function sourceIds(records: Array<{ id: number }>) {
  const ids = records.map((record) => record.id);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    throw new Error("Invalid source evidence ID");
  if (new Set(ids).size !== ids.length) throw new Error("Repeated source evidence ID");
  return ids.sort((a, b) => a - b);
}
