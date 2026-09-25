import { expect, it } from "vitest";
import { metricSourceDescription, unsupportedMetricReason } from "./source-description";

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
