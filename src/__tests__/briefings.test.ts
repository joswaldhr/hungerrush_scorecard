import { describe, it, expect } from "vitest";
import {
  describeChange,
  describeExecutiveSummary,
  describeTakeaway,
  generateRecognitionItems,
  generateDiscussionItems,
  generateSuggestedQuestions,
} from "@/lib/domain/briefings/templates";
import type { MetricChange } from "@/lib/domain/briefings/types";

function makeChange(overrides: Partial<MetricChange> = {}): MetricChange {
  return {
    metricKey: "csat_score",
    metricName: "CSAT Score",
    unit: "%",
    valueType: "percentage",
    direction: "higher_is_better",
    currentValue: 88,
    previousValue: 82,
    changePercent: 7.3,
    changeDirection: "improved",
    evidence: "CSAT Score increased 7% from 82 to 88.",
    ...overrides,
  };
}

describe("describeChange", () => {
  it("describes an increase", () => {
    const result = describeChange(makeChange());
    expect(result).toContain("CSAT Score");
    expect(result).toContain("up");
    expect(result).toContain("7%");
  });

  it("describes a decrease", () => {
    const result = describeChange(
      makeChange({ currentValue: 75, previousValue: 85, changePercent: -11.8 })
    );
    expect(result).toContain("down");
  });

  it("handles stable values", () => {
    const result = describeChange(makeChange({ changePercent: 0.3 }));
    expect(result).toContain("stable");
  });

  it("handles null current value", () => {
    const result = describeChange(makeChange({ currentValue: null }));
    expect(result).toContain("no data");
  });

  it("handles null previous value", () => {
    const result = describeChange(makeChange({ previousValue: null }));
    expect(result).toContain("first period");
  });
});

describe("describeExecutiveSummary", () => {
  it("describes on_track with improvements", () => {
    const result = describeExecutiveSummary("Alex", [makeChange()], "on_track");
    expect(result.text).toContain("Alex");
    expect(result.text).toContain("performing well");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("describes needs_attention with declining metric", () => {
    const declining = makeChange({
      changeDirection: "declined",
      changePercent: -15,
      metricName: "Handle Time",
    });
    const result = describeExecutiveSummary("Mike", [declining], "needs_attention");
    expect(result.text).toContain("needs attention");
    expect(result.text).toContain("Handle Time");
  });

  it("describes no_data honestly instead of implying performance", () => {
    const result = describeExecutiveSummary("Alex", [], "no_data");
    expect(result.text).toContain("No metric data");
    expect(result.text).not.toContain("performing");
  });

  it("describes mixed performance", () => {
    const result = describeExecutiveSummary(
      "Sarah",
      [makeChange(), makeChange({ changeDirection: "declined", changePercent: -10 })],
      "mixed"
    );
    expect(result.text).toContain("mixed");
    expect(result.evidence.length).toBe(2);
  });

  it("every statement has evidence", () => {
    const result = describeExecutiveSummary("Alex", [makeChange()], "on_track");
    expect(result.evidence).toBeDefined();
    expect(result.evidence.length).toBeGreaterThan(0);
    for (const ref of result.evidence) {
      expect(ref.type).toBe("metric_value");
      expect(ref.metricKey).toBeTruthy();
    }
  });
});

describe("describeTakeaway", () => {
  it("describes fully on-target state", () => {
    const result = describeTakeaway(
      "Alex",
      { metricsOnTarget: 3, metricsImproving: 0, metricsDeclining: 0, totalMetrics: 3 },
      []
    );
    expect(result.text).toContain("fully on target");
  });

  it("describes no data honestly instead of implying stability", () => {
    const noData = makeChange({
      currentValue: null,
      previousValue: null,
      changePercent: null,
      changeDirection: "new",
    });
    const result = describeTakeaway(
      "Alex",
      { metricsOnTarget: 0, metricsImproving: 0, metricsDeclining: 0, totalMetrics: 1 },
      [noData]
    );
    expect(result.text).toContain("No metric data");
    expect(result.text).not.toContain("stable");
  });

  it("flags declining metrics", () => {
    const declining = makeChange({ changeDirection: "declined", metricName: "Handle Time" });
    const result = describeTakeaway(
      "Alex",
      { metricsOnTarget: 1, metricsImproving: 0, metricsDeclining: 2, totalMetrics: 3 },
      [declining]
    );
    expect(result.text).toContain("declining");
    expect(result.text).toContain("worth discussing");
  });
});

describe("generateRecognitionItems", () => {
  it("includes improvements above 5%", () => {
    const items = generateRecognitionItems([makeChange({ changePercent: 12 })]);
    expect(items.length).toBe(1);
    expect(items[0]!.text).toContain("improved");
    expect(items[0]!.evidence.length).toBe(1);
  });

  it("excludes small improvements", () => {
    const items = generateRecognitionItems([makeChange({ changePercent: 3 })]);
    expect(items.length).toBe(0);
  });

  it("excludes declines", () => {
    const items = generateRecognitionItems([
      makeChange({ changeDirection: "declined", changePercent: -15 }),
    ]);
    expect(items.length).toBe(0);
  });
});

describe("generateDiscussionItems", () => {
  it("includes declines above 5%", () => {
    const items = generateDiscussionItems([
      makeChange({ changeDirection: "declined", changePercent: -12 }),
    ]);
    expect(items.length).toBe(1);
    expect(items[0]!.text).toContain("declined");
  });

  it("excludes improvements", () => {
    const items = generateDiscussionItems([
      makeChange({ changeDirection: "improved", changePercent: 15 }),
    ]);
    expect(items.length).toBe(0);
  });
});

describe("generateSuggestedQuestions", () => {
  it("generates questions from discussion items", () => {
    const discussion = [
      { text: "CSAT declined", evidence: [{ type: "metric_value" as const, metricName: "CSAT" }] },
    ];
    const questions = generateSuggestedQuestions(discussion, []);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0]).toContain("CSAT");
  });

  it("generates fallback question when nothing notable", () => {
    const questions = generateSuggestedQuestions([], []);
    expect(questions.length).toBe(1);
    expect(questions[0]).toContain("workload");
  });
});

describe("reproducibility", () => {
  it("same inputs produce identical output from templates", () => {
    const changes = [
      makeChange(),
      makeChange({
        changeDirection: "declined",
        changePercent: -10,
        metricName: "Handle Time",
        metricKey: "handle_time",
      }),
    ];

    const result1 = describeExecutiveSummary("Alex", changes, "mixed");
    const result2 = describeExecutiveSummary("Alex", changes, "mixed");

    expect(result1.text).toBe(result2.text);
    expect(result1.evidence).toEqual(result2.evidence);
  });
});

describe("provenance", () => {
  it("every recognition item traces to a metric_value evidence", () => {
    const items = generateRecognitionItems([
      makeChange({ changePercent: 15, metricKey: "csat_score" }),
      makeChange({
        changePercent: 20,
        metricKey: "tickets_resolved",
        metricName: "Tickets Resolved",
      }),
    ]);
    for (const item of items) {
      expect(item.evidence.length).toBeGreaterThan(0);
      for (const ref of item.evidence) {
        expect(ref.type).toBe("metric_value");
        expect(ref.metricKey).toBeTruthy();
      }
    }
  });

  it("every discussion item traces to a metric_value evidence", () => {
    const items = generateDiscussionItems([
      makeChange({ changeDirection: "declined", changePercent: -20 }),
    ]);
    for (const item of items) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.evidence[0]!.type).toBe("metric_value");
    }
  });
});
