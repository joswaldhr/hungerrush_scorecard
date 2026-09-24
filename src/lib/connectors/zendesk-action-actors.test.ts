import { expect, it } from "vitest";
import { ActionActorLookupError, inspectActionActorBatch } from "./zendesk-action-actors";

it("accepts reordered exact coverage and only returns current agent/admin IDs", () => {
  const result = inspectActionActorBatch([1, 2, 3], {
    users: [
      { id: 3, role: "admin", email: "private@example.com" },
      { id: 1, role: "end-user" },
      { id: 2, role: "agent" },
    ],
  });
  expect(result.status).toBe("complete");
  expect(result.eligibleActorIds).toEqual(new Set([3, 2]));
  expect(JSON.stringify(result)).not.toContain("private");
});

it("withholds an eligible set and reports missing accounts without inventing a cause", () => {
  const result = inspectActionActorBatch([1, 2], { users: [{ id: 1, role: "agent" }] });
  expect(result).toEqual({
    status: "incomplete",
    counts: { requested: 2, returned: 1, missing: 1, duplicate: 0, unexpected: 0 },
    eligibleActorIds: null,
  });
  const error = new ActionActorLookupError(result.counts);
  expect(error.message).toBe("Actor lookup incomplete or inconsistent");
  expect(error.counts.missing).toBe(1);
});

it("detects duplicate and unexpected results even when response length matches", () => {
  const result = inspectActionActorBatch([1, 2, 3], {
    users: [
      { id: 1, role: "agent" },
      { id: 1, role: "end-user" },
      { id: 99, role: "admin" },
    ],
  });
  expect(result.status).toBe("inconsistent");
  expect(result.counts).toEqual({
    requested: 3,
    returned: 3,
    missing: 2,
    duplicate: 1,
    unexpected: 1,
  });
  expect(result.eligibleActorIds).toBeNull();
});

it("rejects malformed roles, unsafe IDs, duplicate requests and oversized batches", () => {
  expect(() => inspectActionActorBatch([1], { users: [{ id: 1, role: "unknown" }] })).toThrow();
  expect(() => inspectActionActorBatch([Number.MAX_SAFE_INTEGER + 1], { users: [] })).toThrow();
  expect(() => inspectActionActorBatch([1, 1], { users: [] })).toThrow("Duplicate actor request");
  expect(() => inspectActionActorBatch([], { users: [] })).toThrow();
  expect(() =>
    inspectActionActorBatch(
      Array.from({ length: 101 }, (_, i) => i + 1),
      { users: [] }
    )
  ).toThrow();
});
