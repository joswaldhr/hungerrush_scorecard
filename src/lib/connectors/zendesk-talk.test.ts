// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchCompleteTalkWeek, type TalkCall } from "./zendesk-talk";

const call = (
  id: number,
  created_at = "2026-09-14T12:00:00Z",
  updated_at = "2026-09-22T12:00:00Z"
) => ({ id, created_at, updated_at, agent_id: 42, talk_time: 60 });
const page = (calls: TalkCall[], next_page: string | null = "/next") => ({
  calls,
  count: calls.length,
  next_page,
});
const fetchWeek = (get: Parameters<typeof fetchCompleteTalkWeek>[2], budget?: number) =>
  fetchCompleteTalkWeek("2026-09-13", "2026-09-19", get, budget);

describe("Zendesk Talk complete weekly cohort", () => {
  it("filters old-created recently modified calls and uses an exclusive end boundary", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(
        page([
          call(1, "2026-09-12T23:59:59Z"),
          call(2, "2026-09-13T00:00:00Z"),
          call(3, "2026-09-19T23:59:59.999Z"),
          call(4, "2026-09-20T00:00:00Z"),
        ])
      )
      .mockResolvedValueOnce(page([]));
    expect((await fetchWeek(get)).calls.map((c) => c.id)).toEqual([2, 3]);
  });

  it("continues past an entire page created after the week", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(page([call(1, "2026-09-22T00:00:00Z")], "/two"))
      .mockResolvedValueOnce(page([call(2)], "/three"))
      .mockResolvedValueOnce(page([]));
    expect((await fetchWeek(get)).calls.map((c) => c.id)).toEqual([2]);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("deduplicates boundary repeats and retains the newest version regardless of arrival order", async () => {
    const old = call(1);
    const newer = { ...old, updated_at: "2026-09-23T00:00:00Z", talk_time: 120 };
    const get = vi
      .fn()
      .mockResolvedValueOnce(page([old], "/two"))
      .mockResolvedValueOnce(page([old, newer], "/three"))
      .mockResolvedValueOnce(page([old], "/four"))
      .mockResolvedValueOnce(page([]));
    expect((await fetchWeek(get)).calls).toEqual([newer]);
  });

  it("accepts empty exports even when next_page remains populated", async () => {
    expect(await fetchWeek(async () => page([]))).toEqual({ calls: [], pages: 1 });
  });

  it("rejects page-budget exhaustion instead of publishing partial totals", async () => {
    const get = vi.fn().mockResolvedValue(page([call(1)]));
    await expect(fetchWeek(get, 1)).rejects.toThrow("page budget exhausted");
  });

  it("rejects a repeated nonempty cursor", async () => {
    const get = vi.fn().mockResolvedValue(page([call(1)]));
    await expect(fetchWeek(get)).rejects.toThrow("stalled pagination");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("rejects nonempty pages with no continuation", async () => {
    await expect(fetchWeek(async () => page([call(1)], null))).rejects.toThrow(
      "missing continuation"
    );
  });

  it("rejects inconsistent counts", async () => {
    await expect(fetchWeek(async () => ({ ...page([call(1)]), count: 0 }))).rejects.toThrow(
      "inconsistent page count"
    );
  });

  it("rejects ambiguous same-timestamp corrections", async () => {
    await expect(
      fetchWeek(async () => page([call(1), { ...call(1), agent_id: 99 }]))
    ).rejects.toThrow("conflicting versions");
  });

  it.each([
    { ...call(1), id: 0 },
    { ...call(1), created_at: "invalid" },
    { ...call(1), updated_at: "invalid" },
  ])("rejects malformed identity/timestamps %#", async (invalid) => {
    await expect(fetchWeek(async () => page([invalid]))).rejects.toThrow("invalid call identity");
  });

  it("propagates request failures", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(page([call(1)]))
      .mockRejectedValueOnce(new Error("timeout"));
    await expect(fetchWeek(get)).rejects.toThrow("timeout");
  });
});
