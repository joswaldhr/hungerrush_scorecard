interface SearchPage<T> {
  results: T[];
  next_page: string | null;
  count: number;
}

// Search exposes at most 1,000 results. Reject incomplete cohorts before the
// publisher can replace existing facts with partial counts (including backlog).
export async function fetchCompleteSearch<T extends { id: number }>(
  query: string,
  getPage: (path: string) => Promise<SearchPage<T>>
): Promise<T[]> {
  const results: T[] = [];
  const ids = new Set<number>();
  const visited = new Set<string>();
  let expectedCount: number | undefined;
  let path: string | null = `/search.json?query=${encodeURIComponent(query)}`;

  while (path) {
    if (visited.has(path) || visited.size >= 1000) {
      throw new Error("Zendesk Search incomplete: pagination did not terminate");
    }
    visited.add(path);
    const page = await getPage(path);
    if (!Number.isInteger(page.count) || page.count < 0 || page.count > 1000) {
      throw new Error("Zendesk Search incomplete: invalid count or 1,000-result limit exceeded");
    }
    if (expectedCount !== undefined && page.count !== expectedCount) {
      throw new Error("Zendesk Search incomplete: result count changed during pagination");
    }
    expectedCount = page.count;
    for (const result of page.results) {
      if (!Number.isSafeInteger(result.id) || result.id <= 0 || ids.has(result.id)) {
        throw new Error("Zendesk Search incomplete: invalid or repeated ticket ID");
      }
      ids.add(result.id);
      results.push(result);
    }
    if (results.length > expectedCount || (page.next_page && page.results.length === 0)) {
      throw new Error("Zendesk Search incomplete: inconsistent pagination");
    }
    // At the exact cap, Zendesk may still advertise an inaccessible next page.
    // The stable reported count and unique IDs establish completeness here.
    if (results.length === 1000 && expectedCount === 1000) return results;
    path = page.next_page;
  }
  if (results.length !== expectedCount) {
    throw new Error("Zendesk Search incomplete: fetched fewer tickets than reported");
  }
  return results;
}
