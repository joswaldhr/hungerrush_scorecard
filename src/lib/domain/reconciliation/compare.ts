import type { CalculationType } from "@/lib/domain/metrics/types";

export type ReconciliationStatus = "match" | "mismatch" | "source_missing" | "cadence_missing";

export interface ComparisonResult {
  cadenceValue: number | null;
  sourceValue: number | null;
  absoluteDelta: number | null;
  relativeDeltaPct: number | null;
  status: ReconciliationStatus;
}

export function compareValues(
  cadenceValue: number | null,
  sourceValue: number | null,
  thresholdPct: number
): ComparisonResult {
  if (cadenceValue === null && sourceValue === null) {
    return {
      cadenceValue: null,
      sourceValue: null,
      absoluteDelta: null,
      relativeDeltaPct: null,
      status: "source_missing",
    };
  }
  if (sourceValue === null) {
    return {
      cadenceValue,
      sourceValue: null,
      absoluteDelta: null,
      relativeDeltaPct: null,
      status: "source_missing",
    };
  }
  if (cadenceValue === null) {
    return {
      cadenceValue: null,
      sourceValue,
      absoluteDelta: null,
      relativeDeltaPct: null,
      status: "cadence_missing",
    };
  }

  const absoluteDelta = Math.abs(cadenceValue - sourceValue);
  const denominator = Math.abs(sourceValue);
  const relativeDeltaPct =
    denominator > 0 ? (absoluteDelta / denominator) * 100 : cadenceValue === sourceValue ? 0 : 100;

  const status: ReconciliationStatus = relativeDeltaPct <= thresholdPct ? "match" : "mismatch";

  return {
    cadenceValue,
    sourceValue,
    absoluteDelta: Math.round(absoluteDelta * 1000) / 1000,
    relativeDeltaPct: Math.round(relativeDeltaPct * 100) / 100,
    status,
  };
}

export function aggregateSourceValues(
  values: number[],
  calculationType: CalculationType
): number | null {
  if (values.length === 0) return null;

  switch (calculationType) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "average":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "count":
      return values.length;
    case "latest":
      return values[values.length - 1] ?? null;
    default:
      return values[values.length - 1] ?? null;
  }
}
