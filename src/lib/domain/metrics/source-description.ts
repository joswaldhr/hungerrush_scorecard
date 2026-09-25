import {
  FIRST_REPLY_CONTRACT,
  SOLVED_CSAT_CONTRACT,
  type MetricSourceContext,
} from "./source-context";

export function metricSourceName(name: string, key: string, context?: MetricSourceContext | null) {
  return key === "avg_response_time" && context?.sourceContract === FIRST_REPLY_CONTRACT
    ? "Avg First Reply — Business Time"
    : name;
}

/** Describe the stored observation's contract, not the latest collector's behavior. */
export function metricSourceDescription(
  key: string,
  sourceStrategy: string | null,
  context?: MetricSourceContext | null
) {
  if (key === "avg_response_time" && context?.sourceContract === FIRST_REPLY_CONTRACT) {
    const sample =
      context.sampleCount === undefined
        ? ""
        : ` ${context.sampleCount} measured tickets out of ${context.cohortCount}; tickets without a reported duration are excluded, reported zeros are included.`;
    return `Mean Zendesk business time to the first public agent reply on tickets created in this period (${context.reportingTimeZone}), attributed to their current assignee within the configured groups and brand scope. This measures ticket service time, not the employee's active effort or every reply.${sample}`;
  }
  if (context?.sourceContract === SOLVED_CSAT_CONTRACT) {
    const cohort = `Tickets last solved in this period (${context.reportingTimeZone}), attributed to their current assignee at observation time within the configured groups and brand scope.`;
    if (key === "csat_score")
      return `${cohort} Good ratings divided by good plus bad ratings; no ratings means no score.`;
    if (key === "csat_response_rate")
      return `${cohort} Good plus bad ratings divided by offered plus rated surveys. Offered is the vendor survey state, not confirmed email delivery.`;
  }
  if (sourceStrategy !== "zendesk") return null;
  const descriptions = new Map<string, string>([
    [
      "avg_handle_time",
      "Elapsed business time from ticket creation to full resolution. This does not measure the employee's active handling time.",
    ],
    [
      "avg_response_time",
      "Business minutes to the first public agent reply on tickets created and last updated in this period, attributed to their current assignee. This is not the average of all employee replies.",
    ],
    [
      "csat_score",
      "Good ratings divided by good plus bad ratings received in the period, attributed by the rating's assignee. No ratings means no score.",
    ],
    [
      "backlog_count",
      "Currently assigned unsolved tickets at the source observation time. Historical values are retained snapshots.",
    ],
    [
      "inbound_calls_offered",
      "Inbound whole calls attributed to the first answering agent. This is not a count of offers to every agent or transferred call legs.",
    ],
    [
      "inbound_calls_accepted",
      "Completed inbound whole calls attributed to the first answering agent. This does not count individual agent acceptance events.",
    ],
    [
      "inbound_calls_abandoned_on_hold",
      "Whole calls with an abandoned-on-hold status, attributed to the first answering agent.",
    ],
    ["outbound_calls", "Outbound whole calls attributed by Zendesk's call-level agent ID."],
    [
      "outbound_calls_completed",
      "Outbound whole calls with a completed status, attributed by Zendesk's call-level agent ID.",
    ],
    [
      "outbound_calls_non_answered",
      "Outbound whole calls with a failed status. Other meanings of an unanswered call are not included.",
    ],
    [
      "worked_elevated_tickets",
      "Currently assigned tickets last updated in the period with an elevation tag. Tags do not establish who performed the elevation.",
    ],
    [
      "avoidable_worked_elevated_tickets",
      "Currently assigned tickets last updated in the period with an avoidable-elevation tag. Tags do not establish who performed the work.",
    ],
  ]);
  const specific = descriptions.get(key);
  if (specific) return specific;
  if (
    [
      "avg_talk_time_inbound",
      "avg_hold_time_inbound",
      "avg_call_duration_inbound",
      "avg_talk_time_outbound",
      "avg_hold_time_outbound",
    ].includes(key)
  )
    return "Average whole-call duration in seconds, including reported zeros. Call-level attribution does not isolate this employee's time on transferred calls.";
  if (key === "avg_consultation_time_inbound")
    return "Average consultation seconds among whole inbound calls with a positive consultation duration, attributed to the first answering agent.";
  return null;
}

export function unsupportedMetricReason(
  key: string,
  sourceStrategy: string | null,
  context?: MetricSourceContext | null
) {
  if (sourceStrategy !== "zendesk") return null;
  if (key === "avg_response_time" && context?.sourceContract === FIRST_REPLY_CONTRACT)
    return "No reported first-reply business durations in the created-ticket cohort.";
  if (context?.sourceContract === SOLVED_CSAT_CONTRACT) {
    if (key === "csat_score") return "No rated tickets in the solved-ticket cohort.";
    if (key === "csat_response_rate")
      return "No offered or rated surveys in the solved-ticket cohort.";
  }
  if (sourceStrategy !== "zendesk") return null;
  if (key === "csat_response_rate")
    return "CSAT response rate is not connected: the survey invitation denominator is unavailable.";
  if (key === "missed_calls" || key === "declined_calls")
    return "This metric is not connected to historical agent call-leg data.";
  if (key === "first_contact_resolution")
    return "First contact resolution is not implemented by the current integration.";
  return null;
}
