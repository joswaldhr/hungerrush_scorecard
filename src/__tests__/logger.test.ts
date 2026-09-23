// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { safeErrorMessage } from "@/lib/error-summary";

afterEach(() => vi.restoreAllMocks());

describe("safe operational errors", () => {
  it("omits query values and driver details from logs and persisted messages", () => {
    const sink = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error("private-person@example.test"), {
      code: "23505",
      detail: "Key contains private-person@example.test",
    });
    const error = new DrizzleQueryError(
      "insert private row",
      ["private-person@example.test"],
      cause
    );
    logger.error("Publication failed", { syncRunId: "run-123", error });
    expect(sink).toHaveBeenCalledOnce();
    const output = String(sink.mock.calls[0]?.[0]);
    expect(output).not.toContain("private-person");
    expect(output).not.toContain("insert private row");
    expect(JSON.parse(output).context).toEqual({
      syncRunId: "run-123",
      error: { name: "DatabaseError", message: "Database operation failed", code: "23505" },
    });
    expect(safeErrorMessage(error)).toBe("Database operation failed (23505)");
  });

  it("retains ordinary failure reasons and handles cyclic database causes", () => {
    expect(safeErrorMessage(new Error("Source export incomplete"))).toBe(
      "Source export incomplete"
    );
    const error = Object.assign(new Error("sensitive SQL"), { query: "private", cause: {} });
    error.cause = error;
    expect(safeErrorMessage(error)).toBe("Database operation failed");
  });
});
