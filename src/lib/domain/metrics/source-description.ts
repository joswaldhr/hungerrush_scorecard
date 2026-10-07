import {
  FIRST_REPLY_CONTRACT,
  INBOUND_PARTICIPATION_CONTRACT,
  OUTBOUND_PARTICIPATION_CONTRACT,
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
  if (context?.sourceContract === INBOUND_PARTICIPATION_CONTRACT) {
    const cohort = `Inbound calls created in this period (${context.reportingTimeZone}), filtered by the configured call groups and lines, attributed through this employee's call legs.`;
    const descriptions = new Map([
      [
        "inbound_calls_offered",
        "Accepted, declined (including transfer declines), missed and unreachable agent legs. Repeated offers on one call count separately.",
      ],
      [
        "inbound_calls_accepted",
        "Completed agent legs with positive reported talk time. This is acceptance participation, not distinct customer calls.",
      ],
      ["declined_calls", "Agent-declined and agent-transfer-declined legs."],
      ["missed_calls", "Agent-missed legs."],
      ["inbound_calls_unreachable", "Agent-unreachable legs."],
      [
        "inbound_calls_answer_rate",
        "Accepted agent legs divided by offered agent legs, multiplied by 100. No offers or uncertain acceptance means unavailable.",
      ],
      [
        "inbound_calls_abandoned_on_hold",
        "Distinct abandoned-on-hold calls in which this employee participated. Participation does not assign responsibility for abandonment.",
      ],
    ]);
    if (descriptions.has(key)) return `${cohort} ${descriptions.get(key)}`;
    if (key === "total_talk_time_inbound" || key === "max_hold_time_inbound") {
      const samples =
        context.sampleCount === undefined
          ? ""
          : ` ${context.sampleCount} measured legs out of ${context.cohortCount}.`;
      return `${cohort} ${key === "total_talk_time_inbound" ? "Sum of employee-leg talk seconds" : "Maximum employee-leg hold seconds"}, including agent/supervisor legs and reported zeros. Missing leg measurements withhold the result.${samples}`;
    }
  }
  if (context?.sourceContract === OUTBOUND_PARTICIPATION_CONTRACT) {
    const cohort = `Outbound calls created in this period (${context.reportingTimeZone}), scoped by their linked ticket's current group and attributed through this employee's agent/supervisor call legs.`;
    if (key === "outbound_calls")
      return `${cohort} Distinct calls with employee participation; repeated legs count once.`;
    if (key === "outbound_calls_completed")
      return `${cohort} Calls with completed status and positive whole-call talk. Connection does not prove a human customer answered.`;
    if (key === "outbound_calls_non_answered")
      return `${cohort} Account-qualified non-answered classification includes completed zero-talk non-voicemail calls and failed calls without positive talk. Unclassified outcomes remain unavailable.`;
    if (key === "avg_talk_time_outbound" || key === "avg_hold_time_outbound") {
      const sample =
        context.sampleCount === undefined
          ? ""
          : ` ${context.sampleCount} measured legs out of ${context.cohortCount}.`;
      return `${cohort} Mean employee-leg ${key === "avg_talk_time_outbound" ? "talk" : "hold"} time, stored in seconds. Repeated legs and reported zeros are included; missing durations are excluded.${sample}`;
    }
  }
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
  if (context?.sourceContract === INBOUND_PARTICIPATION_CONTRACT) {
    if (["total_talk_time_inbound", "max_hold_time_inbound"].includes(key))
      return "No complete set of employee-leg duration measurements is available.";
    if (key === "inbound_calls_answer_rate")
      return "No offered legs, or acceptance could not be established for every completed agent leg.";
    if (["inbound_calls_offered", "inbound_calls_accepted"].includes(key))
      return "Acceptance could not be established for every completed agent leg.";
    return null;
  }
  if (context?.sourceContract === OUTBOUND_PARTICIPATION_CONTRACT) {
    if (key === "outbound_calls_completed" || key === "outbound_calls_non_answered")
      return "One or more outbound call outcomes could not be classified from the source evidence.";
    if (key === "avg_talk_time_outbound" || key === "avg_hold_time_outbound")
      return "No reported employee-leg durations in the outbound call cohort.";
  }
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
