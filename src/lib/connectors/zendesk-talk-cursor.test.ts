// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceTalkCursor, initialTalkCursor } from "./zendesk-talk-cursor";

const origin = "https://synthetic.zendesk.com";
const start = 1;
const call = {
  id: 1,
  created_at: "2026-09-13T12:00:00Z",
  updated_at: "2026-09-13T13:00:00Z",
  direction: "inbound" as const,
  call_group_id: 10,
  phone_number: null,
  completion_status: "completed" as const,
};
const path = (n: number) =>
  `${origin}/api/v2/channels/voice/stats/incremental/calls.json?start_time=${n}`;
const page = (calls = [call], end_time = 2, next_page: string | null = path(end_time)) => ({
  calls,
  count: calls.length,
  end_time,
  next_page,
});

describe("resumable Talk cursor transitions", () => {
  it("resumes a serialized checkpoint and only completes an identical terminal boundary", () => {
    const first = advanceTalkCursor(initialTalkCursor(origin, "calls", start), page(), [], []);
    expect(first.cursor.status).toBe("pending");
    expect(first.records).toEqual([call]);
    const second = advanceTalkCursor(
      JSON.parse(JSON.stringify(first.cursor)),
      page(),
      first.records,
      first.revisions.map(({ record, digest }) => ({
        id: record.id,
        updatedAt: record.updated_at,
        digest,
      }))
    );
    expect(second.cursor.status).toBe("exhausted");
    expect(second.records).toEqual([]);
    expect(second.revisions).toEqual([]);
  });

  it("does not advance or mutate a checkpoint on malformed or conflicting source pages", () => {
    const first = advanceTalkCursor(initialTalkCursor(origin, "calls", start), page(), [], []);
    const saved = JSON.stringify(first);
    expect(() =>
      advanceTalkCursor(first.cursor, page([{ ...call, call_group_id: 11 }]), first.records, [])
    ).toThrow("Conflicting");
    expect(() =>
      advanceTalkCursor(first.cursor, { ...page(), count: 0 }, first.records, [])
    ).toThrow("count");
    expect(JSON.stringify(first)).toBe(saved);
  });

  it("retains later corrections and detects conflicts in an older retained revision", () => {
    const first = advanceTalkCursor(initialTalkCursor(origin, "calls", start), page(), [], []);
    const corrected = { ...call, updated_at: "2026-09-14T00:00:00Z", call_group_id: 11 };
    const second = advanceTalkCursor(first.cursor, page([corrected], 3), first.records, []);
    expect(second.records).toEqual([corrected]);
    const versions = first.revisions.map(({ record, digest }) => ({
      id: record.id,
      updatedAt: record.updated_at,
      digest,
    }));
    expect(() =>
      advanceTalkCursor(
        second.cursor,
        page([{ ...call, call_group_id: 12 }], 4),
        second.records,
        versions
      )
    ).toThrow("Conflicting");
    const old = advanceTalkCursor(second.cursor, page([call], 4), second.records, versions);
    expect(old.records).toEqual([]);
    expect(old.cursor.status).toBe("pending");
  });

  it.each([
    "https://evil.example/api/v2/channels/voice/stats/incremental/calls.json?start_time=2",
    `${origin}/api/v2/users.json?start_time=2`,
    `${origin}/api/v2/channels/voice/stats/incremental/legs.json?start_time=2`,
    path(2) + "&start_time=3",
  ])("rejects unexpected continuation destinations", (next) => {
    expect(() =>
      advanceTalkCursor(initialTalkCursor(origin, "calls", start), page([call], 2, next), [], [])
    ).toThrow("destination");
  });

  it("rejects cursor cycles, regressing watermarks and changed terminal boundaries", () => {
    const first = advanceTalkCursor(initialTalkCursor(origin, "calls", start), page(), [], []);
    expect(() => advanceTalkCursor(first.cursor, page([], 1), first.records, [])).toThrow(
      "watermark"
    );
    const boundary = advanceTalkCursor(
      first.cursor,
      page([{ ...call, id: 2 }], 2),
      first.records,
      []
    );
    expect(boundary.cursor.status).toBe("pending");
    expect(() =>
      advanceTalkCursor(boundary.cursor, page([{ ...call, id: 3 }], 2), boundary.records, [])
    ).toThrow("cycle");
    expect(() =>
      advanceTalkCursor(first.cursor, page([call], 3, path(1)), first.records, [])
    ).toThrow("cycle");
  });

  it("can resume an unchanged initial timestamp after persisting its first boundary page", () => {
    const first = advanceTalkCursor(initialTalkCursor(origin, "calls", 2), page(), [], []);
    expect(first.cursor.status).toBe("pending");
    const second = advanceTalkCursor(
      JSON.parse(JSON.stringify(first.cursor)),
      page(),
      first.records,
      []
    );
    expect(second.cursor.status).toBe("exhausted");
    expect(second.records).toEqual([]);
  });

  it("permits an empty export without confusing it with a complete joined metric cohort", () => {
    const result = advanceTalkCursor(
      initialTalkCursor(origin, "calls", start),
      page([], 1, null),
      [],
      []
    );
    expect(result.cursor.status).toBe("exhausted");
    expect(result).not.toHaveProperty("complete");
    expect(() => advanceTalkCursor(result.cursor, page(), [], [])).toThrow("exhausted");
  });
});
