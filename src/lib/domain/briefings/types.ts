import type { MetricStatus, ResolvedTarget, ValueType, Direction } from "../metrics/types";

// ── Briefing Types ─────────────────────────────────────────

export interface BriefingMeta {
  generatedAt: string;
  dataFreshnessAt: string | null;
  generationVersion: number;
  periodStart: string;
  periodEnd: string;
}

// ── Team Weekly Briefing ───────────────────────────────────

export interface TeamBriefingPayload {
  meta: BriefingMeta;
  teamName: string;
  employeeCount: number;
  statusDistribution: {
    onTarget: number;
    warning: number;
    offTarget: number;
    noData: number;
  };
  needsAttention: AttentionItem[];
  notableImprovements: ImprovementItem[];
  teamPerformance: TeamMetricSummary[];
}

export interface AttentionItem {
  employeeId: string;
  employeeName: string;
  reasons: EvidencedStatement[];
}

export interface ImprovementItem {
  employeeId: string;
  employeeName: string;
  achievements: EvidencedStatement[];
}

export interface TeamMetricSummary {
  metricDefinitionId: string;
  metricKey: string;
  metricName: string;
  category: string | null;
  unit: string | null;
  valueType: ValueType;
  direction: Direction;
  teamAverage: number | null;
  previousTeamAverage: number | null;
  employeeValues: {
    employeeId: string;
    employeeName: string;
    currentValue: number | null;
    previousValue: number | null;
    status: MetricStatus;
  }[];
}

// ── Employee Summary ───────────────────────────────────────

export interface EmployeeSummaryPayload {
  meta: BriefingMeta;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  teamName: string;
  executiveSummary: EvidencedStatement;
  changes: MetricChange[];
  metricSnapshots: MetricSnapshot[];
  overallStatus: "on_track" | "mixed" | "needs_attention" | "no_data";
}

export interface MetricChange {
  metricKey: string;
  metricName: string;
  category: string | null;
  unit: string | null;
  valueType: ValueType;
  direction: Direction;
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  changeDirection: "improved" | "declined" | "stable" | "new";
  evidence: string;
}

export interface MetricSnapshot {
  metricDefinitionId: string;
  metricKey: string;
  metricName: string;
  category: string | null;
  unit: string | null;
  valueType: ValueType;
  direction: Direction;
  currentValue: number | null;
  previousValue: number | null;
  target: ResolvedTarget | null;
  status: MetricStatus;
  qualityStatus: string;
  isPrimary: boolean;
}

// ── 1:1 Preparation ───────────────────────────────────────

export interface OneOnOnePayload {
  meta: BriefingMeta;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  teamName: string;
  takeaway: EvidencedStatement;
  atAGlance: {
    metricsOnTarget: number;
    metricsImproving: number;
    metricsDeclining: number;
    totalMetrics: number;
  };
  whatChanged: MetricChange[];
  whatToRecognize: EvidencedStatement[];
  whatToDiscuss: EvidencedStatement[];
  suggestedQuestions: string[];
}

// ── Shared ─────────────────────────────────────────────────

export interface EvidencedStatement {
  text: string;
  evidence: EvidenceRef[];
}

export interface EvidenceRef {
  type: "metric_value" | "metric_target" | "observation" | "trend";
  metricKey?: string;
  metricName?: string;
  value?: number;
  comparisonValue?: number;
  targetValue?: number;
  periodStart?: string;
}
