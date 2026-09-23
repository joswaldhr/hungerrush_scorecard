// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchCompleteSearch } from "./zendesk-search";

const ticket = (id: number) => ({ id });

describe("complete Zendesk Search cohorts", () => {
  it("collects distinct tickets across all pages", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ results: [ticket(1)], count: 2, next_page: "/page2" })
      .mockResolvedValueOnce({ results: [ticket(2)], count: 2, next_page: null });
    await expect(fetchCompleteSearch("type:ticket", get)).resolves.toEqual([ticket(1), ticket(2)]);
    expect(get).toHaveBeenNthCalledWith(2, "/page2");
  });

  it("accepts an explicitly empty cohort", async () => {
    await expect(
      fetchCompleteSearch("empty", async () => ({ results: [], count: 0, next_page: null }))
    ).resolves.toEqual([]);
  });

  it("rejects over-cap cohorts before requesting an inaccessible page", async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ results: [ticket(1)], count: 1001, next_page: "/page2" });
    await expect(fetchCompleteSearch("large", get)).rejects.toThrow("limit exceeded");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("accepts exactly 1,000 unique results without requesting page 11", async () => {
    let page = 0;
    const get = vi.fn(async () => ({
      results: Array.from({ length: 100 }, (_, i) => ticket(page * 100 + i + 1)),
      count: 1000,
      next_page: `/page${++page + 1}`,
    }));
    await expect(fetchCompleteSearch("at cap", get)).resolves.toHaveLength(1000);
    expect(get).toHaveBeenCalledTimes(10);
  });

  it("rejects missing results on a terminal page", async () => {
    await expect(
      fetchCompleteSearch("short", async () => ({
        results: [ticket(1)],
        count: 2,
        next_page: null,
      }))
    ).rejects.toThrow("fewer tickets");
  });

  it("rejects repeated IDs instead of counting them twice", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ results: [ticket(1)], count: 2, next_page: "/page2" })
      .mockResolvedValueOnce({ results: [ticket(1)], count: 2, next_page: null });
    await expect(fetchCompleteSearch("duplicates", get)).rejects.toThrow("repeated ticket ID");
  });

  it("rejects changing totals during pagination", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ results: [ticket(1)], count: 2, next_page: "/page2" })
      .mockResolvedValueOnce({ results: [ticket(2)], count: 3, next_page: null });
    await expect(fetchCompleteSearch("moving", get)).rejects.toThrow("count changed");
  });

  it("rejects cyclic page links", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ results: [ticket(1)], count: 3, next_page: "/page2" })
      .mockResolvedValueOnce({ results: [ticket(2)], count: 3, next_page: "/page2" });
    await expect(fetchCompleteSearch("loop", get)).rejects.toThrow("did not terminate");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("rejects empty nonterminal pages", async () => {
    await expect(
      fetchCompleteSearch("empty page", async () => ({
        results: [],
        count: 1,
        next_page: "/page2",
      }))
    ).rejects.toThrow("inconsistent pagination");
  });

  it("propagates vendor failures without returning collected tickets", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ results: [ticket(1)], count: 2, next_page: "/page2" })
      .mockRejectedValueOnce(new Error("rate limit exhausted"));
    await expect(fetchCompleteSearch("failure", get)).rejects.toThrow("rate limit exhausted");
  });
});
