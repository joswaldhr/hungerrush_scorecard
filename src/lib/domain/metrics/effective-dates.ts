// Match the existing membership convention: inclusive start, exclusive end.
// A weekly configuration is selected at its reporting period's start date.
export function isEffectiveOn(
  interval: { effectiveFrom: string | null; effectiveTo: string | null },
  date: string
): boolean {
  return (
    (!interval.effectiveFrom || interval.effectiveFrom <= date) &&
    (!interval.effectiveTo || date < interval.effectiveTo)
  );
}
