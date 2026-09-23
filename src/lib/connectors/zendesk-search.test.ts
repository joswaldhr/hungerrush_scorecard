// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchCompleteSearch } from "./zendesk-search";
const query = "type:ticket assignee:synthetic@example.test status<solved";
const page = (ids: number[], more = false, next: string | null = null) => ({
  results: ids.map((id) => ({ id })),
  meta: { has_more: more },
  links: { next },
});
describe("Zendesk cursor search export", () => {
  it("retrieves more than 1,000 tickets and separates the required type filter", async () => {
    let index = 0;
    const get = vi.fn(async (_path: string) => {
      const ids = Array.from({ length: 100 }, (_, n) => index * 100 + n + 1);
      index++;
      return page(ids, index < 12, `/page${index + 1}`);
    });
    expect(await fetchCompleteSearch(query, get)).toHaveLength(1200);
    const url = new URL(get.mock.calls[0]![0]!, "https://example.test");
    expect(url.searchParams.get("filter[type]")).toBe("ticket");
    expect(url.searchParams.get("query")).toBe("assignee:synthetic@example.test status<solved");
    expect(get).toHaveBeenCalledTimes(12);
  });
  it("accepts an explicitly empty export", async () => {
    expect(await fetchCompleteSearch(query, async () => page([]))).toEqual([]);
  });
  it("rejects duplicate IDs", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(page([1], true, "/two"))
      .mockResolvedValueOnce(page([1]));
    await expect(fetchCompleteSearch(query, get)).rejects.toThrow("repeated ticket ID");
  });
  it("rejects cursor loops", async () => {
    let id = 0;
    await expect(
      fetchCompleteSearch(query, async () => page([++id], true, "/same"))
    ).rejects.toThrow("pagination loop");
  });
  it.each([page([], true, "/next"), page([1], true, null)])(
    "rejects broken continuation %#",
    async (response) => {
      await expect(fetchCompleteSearch(query, async () => response)).rejects.toThrow(
        "missing continuation"
      );
    }
  );
  it("rejects exhausted budgets", async () => {
    await expect(
      fetchCompleteSearch(query, async () => page([1], true, "/next"), 1)
    ).rejects.toThrow("page budget");
  });
  it("rejects missing completion metadata", async () => {
    const get = vi.fn().mockResolvedValue({ results: [], meta: {}, links: {} });
    await expect(fetchCompleteSearch(query, get)).rejects.toThrow("completion indicator");
  });
  it("propagates vendor errors", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(page([1], true, "/two"))
      .mockRejectedValueOnce(new Error("timeout"));
    await expect(fetchCompleteSearch(query, get)).rejects.toThrow("timeout");
  });
});
