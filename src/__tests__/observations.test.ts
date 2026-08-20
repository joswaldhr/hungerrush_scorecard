import { describe, it, expect } from "vitest";
import { detectObservations } from "@/lib/domain/metrics/observations";

describe("detectObservations", () => {
  describe("threshold crossings", () => {
    it("detects dropping below target (higher_is_better)", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 75,
        previousValue: 85,
        target: {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          source: "team",
          priority: 0,
        },
        history: [],
      });
      const crossing = results.find((r) => r.observationType === "threshold_crossed_below");
      expect(crossing).toBeDefined();
      expect(crossing!.severity).toBe("attention");
    });

    it("detects reaching target (higher_is_better)", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 85,
        previousValue: 75,
        target: {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          source: "team",
          priority: 0,
        },
        history: [],
      });
      const crossing = results.find((r) => r.observationType === "threshold_crossed_above");
      expect(crossing).toBeDefined();
      expect(crossing!.severity).toBe("info");
    });

    it("returns no threshold crossing when both periods are on target", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 90,
        previousValue: 85,
        target: {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          source: "team",
          priority: 0,
        },
        history: [],
      });
      expect(
        results.find((r) => r.observationType.startsWith("threshold_crossed"))
      ).toBeUndefined();
    });

    it("requires previousValue for threshold crossing", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 75,
        previousValue: null,
        target: {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          source: "team",
          priority: 0,
        },
        history: [],
      });
      expect(
        results.find((r) => r.observationType.startsWith("threshold_crossed"))
      ).toBeUndefined();
    });
  });

  describe("significant changes", () => {
    it("detects a significant increase", () => {
      const results = detectObservations({
        metricName: "Tickets",
        direction: "higher_is_better",
        currentValue: 120,
        previousValue: 100,
        target: null,
        history: [],
      });
      const change = results.find((r) => r.observationType === "significant_change");
      expect(change).toBeDefined();
      expect(change!.title).toContain("increased");
      expect(change!.severity).toBe("info");
    });

    it("detects a significant decrease in higher_is_better as watch", () => {
      const results = detectObservations({
        metricName: "Tickets",
        direction: "higher_is_better",
        currentValue: 80,
        previousValue: 100,
        target: null,
        history: [],
      });
      const change = results.find((r) => r.observationType === "significant_change");
      expect(change).toBeDefined();
      expect(change!.severity).toBe("watch");
    });

    it("ignores changes under 10%", () => {
      const results = detectObservations({
        metricName: "Tickets",
        direction: "higher_is_better",
        currentValue: 105,
        previousValue: 100,
        target: null,
        history: [],
      });
      expect(results.find((r) => r.observationType === "significant_change")).toBeUndefined();
    });

    it("skips when previousValue is zero", () => {
      const results = detectObservations({
        metricName: "Tickets",
        direction: "higher_is_better",
        currentValue: 10,
        previousValue: 0,
        target: null,
        history: [],
      });
      expect(results.find((r) => r.observationType === "significant_change")).toBeUndefined();
    });
  });

  describe("trends", () => {
    it("detects an improving upward trend for higher_is_better", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 90,
        previousValue: null,
        target: null,
        history: [70, 80, 90],
      });
      const trend = results.find((r) => r.observationType === "improving_trend");
      expect(trend).toBeDefined();
      expect(trend!.severity).toBe("info");
    });

    it("detects a declining downward trend for higher_is_better", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 70,
        previousValue: null,
        target: null,
        history: [90, 80, 70],
      });
      const trend = results.find((r) => r.observationType === "declining_trend");
      expect(trend).toBeDefined();
      expect(trend!.severity).toBe("watch");
    });

    it("detects an improving downward trend for lower_is_better", () => {
      const results = detectObservations({
        metricName: "Handle Time",
        direction: "lower_is_better",
        currentValue: 5,
        previousValue: null,
        target: null,
        history: [9, 7, 5],
      });
      const trend = results.find((r) => r.observationType === "improving_trend");
      expect(trend).toBeDefined();
    });

    it("does not detect trend with fewer than 3 points", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 90,
        previousValue: null,
        target: null,
        history: [80, 90],
      });
      expect(results.find((r) => r.observationType.endsWith("_trend"))).toBeUndefined();
    });

    it("does not detect trend when values are mixed", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 85,
        previousValue: null,
        target: null,
        history: [80, 90, 85],
      });
      expect(results.find((r) => r.observationType.endsWith("_trend"))).toBeUndefined();
    });
  });

  describe("combined", () => {
    it("can detect both threshold crossing and significant change", () => {
      const results = detectObservations({
        metricName: "CSAT",
        direction: "higher_is_better",
        currentValue: 60,
        previousValue: 85,
        target: {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          source: "team",
          priority: 0,
        },
        history: [],
      });
      expect(results.find((r) => r.observationType === "threshold_crossed_below")).toBeDefined();
      expect(results.find((r) => r.observationType === "significant_change")).toBeDefined();
    });
  });
});
