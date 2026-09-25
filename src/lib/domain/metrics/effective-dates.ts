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

export function sevenDayPeriodEnd(periodStart: string): string {
  const end = new Date(`${periodStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}
