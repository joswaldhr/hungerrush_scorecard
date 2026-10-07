// @vitest-environment node
import { expect, it } from "vitest";
import { SourceFetchError, sourceFailureDiagnostics } from "./source-fetch-error";

const stats = { family: "csat" as const, requests: 3, elapsedMs: 100, elapsedBudgetMs: 240000 };
it("does not trust diagnostics attached to arbitrary errors", () => {
  expect(
    sourceFailureDiagnostics(Object.assign(Error("failed"), { diagnostics: stats }))
  ).toBeUndefined();
});
it("strips unapproved fields and suppresses invalid telemetry", () => {
  const error = new SourceFetchError(Error("failed"), {
    ...stats,
    ...{ privatePayload: "secret" },
  });
  expect(sourceFailureDiagnostics(error)).toEqual(stats);
  Object.assign(error.diagnostics, { requests: Infinity });
  expect(sourceFailureDiagnostics(error)).toBeUndefined();
});
