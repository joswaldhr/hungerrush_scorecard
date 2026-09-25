export const SOLVED_CSAT_CONTRACT = "zendesk-solved-current-assignee-csat-v1";
export const INCOMPATIBLE_COMPARISON_REASON =
  "Comparison unavailable because the source definition, scope or reporting timezone changed.";
export const SOURCE_TARGET_REASON = "Targets have not been verified for this source definition.";

export interface MetricSourceContext {
  sourceContract: string;
  reportingTimeZone: string;
  sourceScopeFingerprint?: string;
}

/** Legacy observations have no explicit context. Never infer a new contract from a value. */
export function readMetricSourceContext(value: unknown): MetricSourceContext | null {
  if (value === null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.sourceContract === undefined && row.reportingTimeZone === undefined) return null;
  if (
    typeof row.sourceContract !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(row.sourceContract) ||
    typeof row.reportingTimeZone !== "string"
  )
    throw new Error("Invalid metric source context");
  const reportingTimeZone = new Intl.DateTimeFormat("en", {
    timeZone: row.reportingTimeZone,
  }).resolvedOptions().timeZone;
  if (
    row.sourceScopeFingerprint !== undefined &&
    (typeof row.sourceScopeFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.sourceScopeFingerprint))
  )
    throw new Error("Invalid metric source scope");
  return {
    sourceContract: row.sourceContract,
    reportingTimeZone,
    ...(typeof row.sourceScopeFingerprint === "string"
      ? { sourceScopeFingerprint: row.sourceScopeFingerprint }
      : {}),
  };
}

/** Fail publication rather than blend legacy and replacement definitions. */
export function sharedMetricSourceContext(values: unknown[]): MetricSourceContext | null {
  if (!values.length) return null;
  const contexts = values.map(readMetricSourceContext);
  const first = contexts[0]!;
  if (
    contexts.some(
      (context) =>
        context?.sourceContract !== first?.sourceContract ||
        context?.reportingTimeZone !== first?.reportingTimeZone ||
        context?.sourceScopeFingerprint !== first?.sourceScopeFingerprint
    )
  )
    throw new Error("Metric contributors use incompatible source contracts");
  if (first?.sourceContract === SOLVED_CSAT_CONTRACT && values.length !== 1)
    throw new Error("Solved CSAT requires one complete employee-period snapshot");
  return first;
}

export function compatibleMetricSourceContexts(current: unknown, previous: unknown): boolean {
  const a = readMetricSourceContext(current),
    b = readMetricSourceContext(previous);
  return (
    a?.sourceContract === b?.sourceContract &&
    a?.reportingTimeZone === b?.reportingTimeZone &&
    a?.sourceScopeFingerprint === b?.sourceScopeFingerprint
  );
}
