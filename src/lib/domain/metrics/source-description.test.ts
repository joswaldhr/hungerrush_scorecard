import { expect, it } from "vitest";
import {
  metricSourceDescription,
  metricSourceName,
  unsupportedMetricReason,
} from "./source-description";
import {
  FIRST_REPLY_CONTRACT,
  SOLVED_CSAT_CONTRACT,
  OUTBOUND_PARTICIPATION_CONTRACT,
} from "./source-context";

it("uses replacement semantics only for explicitly classified observations", () => {
  const context = { sourceContract: SOLVED_CSAT_CONTRACT, reportingTimeZone: "America/Chicago" };
  expect(metricSourceDescription("csat_score", "zendesk", context)).toContain("last solved");
  expect(metricSourceDescription("csat_score", "zendesk")).toContain("ratings received");
  expect(unsupportedMetricReason("csat_response_rate", "zendesk", context)).toContain(
    "No offered or rated"
  );
});

it("distinguishes employee outbound legs from legacy whole calls and explains unavailable outcomes", () => {
  const context = {
    sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
    reportingTimeZone: "America/Chicago",
    sampleCount: 2,
    cohortCount: 3,
  };
  expect(metricSourceDescription("avg_talk_time_outbound", "zendesk", context)).toContain(
    "2 measured legs out of 3"
  );
  expect(metricSourceDescription("outbound_calls", "zendesk", context)).toContain("Distinct calls");
  expect(metricSourceDescription("outbound_calls_completed", "zendesk", context)).toContain(
    "does not prove a human"
  );
  expect(unsupportedMetricReason("outbound_calls_completed", "zendesk", context)).toContain(
    "could not be classified"
  );
  expect(unsupportedMetricReason("avg_hold_time_outbound", "zendesk", context)).toContain(
    "No reported employee-leg"
  );
  expect(metricSourceDescription("avg_talk_time_outbound", "zendesk")).toContain("whole-call");
});

it("does not imply employee handling effort or offered events from whole-ticket/call metrics", () => {
  expect(metricSourceDescription("avg_handle_time", "zendesk")).toContain("does not measure");
  expect(metricSourceDescription("inbound_calls_offered", "zendesk")).toContain(
    "first answering agent"
  );
  expect(metricSourceDescription("avg_response_time", "zendesk")).toContain(
    "first public agent reply"
  );
});

it("distinguishes unsupported metrics from supported metrics with no samples", () => {
  expect(unsupportedMetricReason("csat_response_rate", "zendesk")).toContain("denominator");
  expect(unsupportedMetricReason("missed_calls", "zendesk")).toContain("not connected");
  expect(unsupportedMetricReason("declined_calls", "zendesk")).toContain("not connected");
  expect(unsupportedMetricReason("csat_score", "zendesk")).toBeNull();
});

it("does not attach Zendesk semantics to manual values or unknown keys", () => {
  expect(metricSourceDescription("avg_handle_time", "manual")).toBeNull();
  expect(unsupportedMetricReason("missed_calls", "manual")).toBeNull();
  expect(metricSourceDescription("constructor", "zendesk")).toBeNull();
});

it("describes first reply with its measured denominator and preserves legacy names", () => {
  const c = {
    sourceContract: FIRST_REPLY_CONTRACT,
    reportingTimeZone: "America/Chicago",
    sampleCount: 3,
    cohortCount: 5,
  };
  expect(metricSourceName("Avg Response", "avg_response_time", c)).toContain("First Reply");
  expect(metricSourceName("Avg Response", "avg_response_time", null)).toBe("Avg Response");
  expect(metricSourceDescription("avg_response_time", "zendesk", c)).toContain(
    "3 measured tickets out of 5"
  );
  expect(unsupportedMetricReason("avg_response_time", "zendesk", c)).toContain(
    "No reported first-reply"
  );
});
