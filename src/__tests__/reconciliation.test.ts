import { describe, it, expect } from "vitest";
import { compareValues, aggregateSourceValues } from "@/lib/domain/reconciliation/compare";

describe("compareValues", () => {
  it("returns match when values are within threshold", () => {
    const result = compareValues(100, 98, 5);
    expect(result.status).toBe("match");
    expect(result.absoluteDelta).toBeCloseTo(2);
    expect(result.relativeDeltaPct).toBeCloseTo(2.04, 1);
  });

  it("returns mismatch when values exceed threshold", () => {
    const result = compareValues(100, 80, 5);
    expect(result.status).toBe("mismatch");
    expect(result.absoluteDelta).toBe(20);
    expect(result.relativeDeltaPct).toBe(25);
  });

  it("returns source_missing when source is null", () => {
    const result = compareValues(42, null, 5);
    expect(result.status).toBe("source_missing");
    expect(result.cadenceValue).toBe(42);
    expect(result.sourceValue).toBeNull();
    expect(result.absoluteDelta).toBeNull();
  });

  it("returns cadence_missing when cadence is null", () => {
    const result = compareValues(null, 42, 5);
    expect(result.status).toBe("cadence_missing");
    expect(result.sourceValue).toBe(42);
    expect(result.cadenceValue).toBeNull();
  });

  it("returns source_missing when both are null", () => {
    const result = compareValues(null, null, 5);
    expect(result.status).toBe("source_missing");
  });

  it("handles exact match", () => {
    const result = compareValues(50, 50, 5);
    expect(result.status).toBe("match");
    expect(result.absoluteDelta).toBe(0);
    expect(result.relativeDeltaPct).toBe(0);
  });

  it("handles zero source value without division error", () => {
    const result = compareValues(5, 0, 5);
    expect(result.status).toBe("mismatch");
    expect(result.relativeDeltaPct).toBe(100);
  });

  it("handles both values zero", () => {
    const result = compareValues(0, 0, 5);
    expect(result.status).toBe("match");
    expect(result.absoluteDelta).toBe(0);
    expect(result.relativeDeltaPct).toBe(0);
  });

  it("handles exact threshold boundary as match", () => {
    const result = compareValues(105, 100, 5);
    expect(result.status).toBe("match");
    expect(result.relativeDeltaPct).toBe(5);
  });

  it("handles threshold boundary just above as mismatch", () => {
    const result = compareValues(105.1, 100, 5);
    expect(result.status).toBe("mismatch");
  });

  it("handles negative values", () => {
    const result = compareValues(-10, -12, 20);
    expect(result.status).toBe("match");
    expect(result.absoluteDelta).toBeCloseTo(2);
  });
});

describe("aggregateSourceValues", () => {
  it("returns null for empty array", () => {
    expect(aggregateSourceValues([], "sum")).toBeNull();
  });

  it("sums values for sum type", () => {
    expect(aggregateSourceValues([10, 20, 30], "sum")).toBe(60);
  });

  it("averages values for average type", () => {
    expect(aggregateSourceValues([10, 20, 30], "average")).toBe(20);
  });

  it("returns min for min type", () => {
    expect(aggregateSourceValues([10, 5, 20], "min")).toBe(5);
  });

  it("returns max for max type", () => {
    expect(aggregateSourceValues([10, 5, 20], "max")).toBe(20);
  });

  it("returns count for count type", () => {
    expect(aggregateSourceValues([10, 20, 30], "count")).toBe(3);
  });

  it("returns last value for latest type", () => {
    expect(aggregateSourceValues([10, 20, 30], "latest")).toBe(30);
  });

  it("handles single value", () => {
    expect(aggregateSourceValues([42], "average")).toBe(42);
    expect(aggregateSourceValues([42], "sum")).toBe(42);
    expect(aggregateSourceValues([42], "latest")).toBe(42);
  });
});
