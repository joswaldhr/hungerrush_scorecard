import type { PickerEmployee } from "@/components/one-on-ones-picker";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import type { Direction, ResolvedTarget, ValueType } from "@/lib/domain/metrics/types";
import { evaluateStatus } from "@/lib/domain/metrics/target-resolution";
import { shiftWeekStart, weekBoundsForDate } from "@/lib/utils";

// Hand-authored fictional identities. No employee or vendor records are imported.
export const demoTeams = [
  { id: "demo-pos", name: "HungerRush POS Support" },
  { id: "demo-menufy", name: "Menufy Support" },
];
const names = [
  "Maya Bennett",
  "Ethan Brooks",
  "Sofia Ramirez",
  "Daniel Chen",
  "Olivia Carter",
  "Marcus Reed",
  "Priya Shah",
  "Lucas Morgan",
  "Isabella Torres",
  "Noah Williams",
  "Chloe Anderson",
  "Jordan Ellis",
  "Amelia Parker",
  "Adrian Cole",
  "Natalie Kim",
];
export const demoEmployees: PickerEmployee[] = names.map((displayName, index) => ({
  id: `demo-${String(index + 1).padStart(2, "0")}`,
  displayName,
  jobTitle:
    index < 8
      ? index % 3 === 0
        ? "Senior Technical Support Specialist"
        : "Technical Support Specialist"
      : "Customer Support Specialist",
  primaryTeamId: index < 8 ? "demo-pos" : "demo-menufy",
  line: index < 8 ? null : index < 12 ? "restaurant" : "consumer",
}));

type Definition = [
  key: string,
  name: string,
  category: string,
  type: ValueType,
  direction: Direction,
  target: number,
  description: string,
];
const definitions: Definition[] = [
  [
    "tickets_resolved",
    "Tickets Resolved",
    "ticket_case_work",
    "count",
    "higher_is_better",
    65,
    "Distinct fictional tickets resolved by this fictional employee.",
  ],
  [
    "tickets_updated",
    "Tickets Updated",
    "ticket_case_work",
    "count",
    "higher_is_better",
    100,
    "Distinct fictional tickets updated, including the resolved tickets.",
  ],
  [
    "worked_elevated_tickets",
    "Worked Elevated Tickets",
    "ticket_case_work",
    "count",
    "neutral",
    15,
    "Fictional elevated tickets worked; a subset of tickets updated.",
  ],
  [
    "avoidable_worked_elevated_tickets",
    "Avoidable Worked Elevated Tickets",
    "ticket_case_work",
    "count",
    "lower_is_better",
    2,
    "Fictional avoidable escalations; a subset of elevated tickets.",
  ],
  [
    "demo_active_handle_time",
    "Avg Handle Time",
    "efficiency",
    "duration",
    "lower_is_better",
    900,
    "Simulated active handling effort, excluding time waiting for a customer. Not a live-source capability claim.",
  ],
  [
    "avg_response_time",
    "Avg Response Time",
    "efficiency",
    "duration",
    "lower_is_better",
    1800,
    "Simulated first public reply in business seconds.",
  ],
  [
    "csat_score",
    "CSAT Score",
    "quality",
    "percentage",
    "higher_is_better",
    95,
    "Positive fictional surveys divided by all fictional answered surveys.",
  ],
  [
    "first_contact_resolution",
    "First Contact Resolution",
    "quality",
    "percentage",
    "higher_is_better",
    75,
    "Fictional resolved tickets completed on first contact divided by all fictional resolved tickets. Illustration only.",
  ],
  [
    "schedule_adherence",
    "Schedule Adherence",
    "attendance",
    "percentage",
    "higher_is_better",
    95,
    "Simulated time in schedule divided by scheduled time. Illustration only; no workforce integration.",
  ],
  [
    "backlog_count",
    "Backlog",
    "workload",
    "count",
    "lower_is_better",
    12,
    "Fictional unresolved assigned tickets at the simulated observation time, not a guaranteed end-of-week count.",
  ],
  [
    "inbound_calls_offered",
    "IB (Inbound)",
    "inbound_call",
    "count",
    "neutral",
    200,
    "Simulated accepted calls plus missed and declined offers.",
  ],
  [
    "inbound_calls_accepted",
    "Accepted IB (Inbound)",
    "inbound_call",
    "count",
    "higher_is_better",
    125,
    "Simulated accepted calls, including calls later abandoned on hold.",
  ],
  [
    "inbound_calls_abandoned_on_hold",
    "Abandoned on Hold",
    "inbound_call",
    "count",
    "lower_is_better",
    3,
    "Fictional accepted calls later abandoned while on hold; not an additional offered call.",
  ],
  [
    "avg_talk_time_inbound",
    "Avg Talk",
    "inbound_call",
    "duration",
    "neutral",
    600,
    "Average simulated inbound talk seconds.",
  ],
  [
    "avg_hold_time_inbound",
    "Avg Hold",
    "inbound_call",
    "duration",
    "lower_is_better",
    60,
    "Average simulated inbound hold seconds.",
  ],
  [
    "avg_call_duration_inbound",
    "Avg Duration",
    "inbound_call",
    "duration",
    "neutral",
    900,
    "Average simulated inbound talk, hold, consultation and other elapsed seconds.",
  ],
  [
    "avg_consultation_time_inbound",
    "Avg Consultation",
    "inbound_call",
    "duration",
    "neutral",
    90,
    "Simulated consultation seconds averaged over all accepted demo calls.",
  ],
  [
    "outbound_calls",
    "OB (Outbound)",
    "outbound_call",
    "count",
    "neutral",
    70,
    "Fictional completed and non-answered outbound attempts.",
  ],
  [
    "outbound_calls_completed",
    "Completed OB (Outbound)",
    "outbound_call",
    "count",
    "higher_is_better",
    35,
    "Fictional outbound calls that connected.",
  ],
  [
    "outbound_calls_non_answered",
    "Non-answered OB (Outbound)",
    "outbound_call",
    "count",
    "lower_is_better",
    15,
    "Fictional outbound attempts that did not connect.",
  ],
  [
    "avg_talk_time_outbound",
    "Avg Talk",
    "outbound_call",
    "duration",
    "neutral",
    480,
    "Average simulated outbound talk seconds.",
  ],
  [
    "avg_hold_time_outbound",
    "Avg Hold",
    "outbound_call",
    "duration",
    "lower_is_better",
    45,
    "Average simulated outbound hold seconds.",
  ],
];

function valuesFor(index: number, periodStart: string, now: Date) {
  const weekIndex = Math.floor(Date.parse(`${periodStart}T00:00:00Z`) / 604800000);
  const variation = (((weekIndex + index * 3) % 7) + 7) % 7;
  const isCurrent = weekBoundsForDate(now.toISOString().slice(0, 10)).periodStart === periodStart;
  const fraction = isCurrent ? Math.max(1 / 7, (now.getUTCDay() + 1) / 7) : 1;
  const count = (value: number) => Math.round(value * fraction);
  const resolved = count(58 + (index % 5) * 8 + variation * 2);
  const accepted = count(118 + index * 3 + variation * 4);
  const completed = count(28 + (index % 6) * 5 + variation);
  const nonAnswered = count(5 + (index % 8));
  const talk = 280 + index * 13 + variation * 8;
  const hold = 25 + index * 3;
  const consultation = 12 + index * 2;
  const surveys = count(25 + index * 2 + variation);
  const positive = surveys - count(index % 4);
  const firstContact = Math.round(resolved * (0.72 + (index % 6) * 0.035));
  return {
    values: {
      tickets_resolved: resolved,
      tickets_updated: resolved + count(45 + index * 3),
      worked_elevated_tickets: count(4 + (index % 9)),
      avoidable_worked_elevated_tickets: count(index % 4),
      demo_active_handle_time: 540 + index * 27 + variation * 12,
      avg_response_time: 780 + index * 90 + variation * 45,
      csat_score: (positive / surveys) * 100,
      first_contact_resolution: (firstContact / resolved) * 100,
      schedule_adherence: 93.2 + (index % 7) * 0.9,
      backlog_count: 4 + (index % 12),
      inbound_calls_offered: accepted + count(4 + (index % 5)) + count(index % 3),
      inbound_calls_accepted: accepted,
      inbound_calls_abandoned_on_hold: count(index % 4),
      avg_talk_time_inbound: talk,
      avg_hold_time_inbound: hold,
      avg_call_duration_inbound: talk + hold + consultation + 35,
      avg_consultation_time_inbound: consultation,
      outbound_calls: completed + nonAnswered,
      outbound_calls_completed: completed,
      outbound_calls_non_answered: nonAnswered,
      avg_talk_time_outbound: 210 + index * 11 + variation * 6,
      avg_hold_time_outbound: 15 + index * 2,
    } as Record<string, number>,
    surveys,
    positive,
    firstContact,
    resolved,
  };
}

/** Pure synthetic provider. Never imported by live metric queries or publication. */
export function demoRows(
  employeeId: string,
  periodStart: string,
  now = new Date()
): EmployeeMetricRow[] {
  const index = demoEmployees.findIndex((employee) => employee.id === employeeId);
  if (index < 0) throw new Error("Unknown demo employee");
  const date = new Date(`${periodStart}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== periodStart ||
    date.getUTCDay() !== 0 ||
    date > now
  )
    throw new Error("Invalid demo week");
  const current = valuesFor(index, periodStart, now);
  const previous = valuesFor(index, shiftWeekStart(periodStart, -1), now);
  const end = new Date(`${weekBoundsForDate(periodStart).periodEnd}T23:59:00Z`);
  const observation = end > now ? new Date(Math.floor(now.getTime() / 60000) * 60000) : end;
  return definitions.map(
    ([key, name, category, valueType, direction, targetValue, description], displayOrder) => {
      const currentValue = current.values[key];
      const previousValue = previous.values[key];
      if (currentValue === undefined || previousValue === undefined)
        throw new Error(`Missing demo fixture: ${key}`);
      const target: ResolvedTarget = {
        targetValue: direction === "neutral" ? null : targetValue,
        targetMin: direction === "neutral" ? 0 : null,
        targetMax: direction === "neutral" ? targetValue : null,
        warningValue:
          direction === "neutral"
            ? null
            : targetValue * (direction === "higher_is_better" ? 0.9 : 1.2),
        targetType:
          direction === "neutral"
            ? "range"
            : direction === "higher_is_better"
              ? "minimum"
              : "maximum",
        source: "team",
        priority: 0,
      };
      const sample =
        key === "csat_score"
          ? ` Sample: ${current.positive} positive / ${current.surveys} answered surveys.`
          : key === "first_contact_resolution"
            ? ` Sample: ${current.firstContact} / ${current.resolved} resolved tickets.`
            : "";
      return {
        definitionId: `demo-${key}`,
        key,
        name,
        category,
        valueType,
        direction,
        displayOrder,
        unit:
          valueType === "duration"
            ? "s"
            : valueType === "percentage"
              ? "%"
              : category.includes("call")
                ? "calls"
                : "tickets",
        isPrimary: ["tickets_resolved", "csat_score", "avg_response_time"].includes(key),
        currentValue,
        previousValue,
        target,
        status: evaluateStatus(currentValue, target, direction),
        qualityStatus: "complete",
        dataFreshnessAt: observation,
        calculationVersion: 1,
        sourceDescription: `${description}${sample} Sample data: values, observation times and fixed illustrative targets are synthetic; not evidence of production coverage or accuracy.`,
        sourceContract: "cadence-fictional-demo-v1",
        reportingTimeZone: "UTC",
        missingReason: null,
        comparisonUnavailableReason: null,
      };
    }
  );
}
