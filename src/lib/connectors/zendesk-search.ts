export interface SearchExportPage<T> {
  results: T[];
  meta: { has_more: boolean };
  links: { next: string | null };
}

// Cursor export avoids offset Search's 1,000-result ceiling. Only an explicit
// has_more=false completes a cohort; request failures or budgets never publish.
export async function fetchCompleteSearch<T extends { id: number }>(
  query: string,
  getPage: (path: string) => Promise<SearchExportPage<T>>,
  pageBudget = 100
): Promise<T[]> {
  const results: T[] = [];
  const ids = new Set<number>();
  const visited = new Set<string>();
  // The exporter requires type as a separate filter, not in the query string.
  if (!query.startsWith("type:ticket ")) throw new Error("Expected a ticket search query");
  const params = new URLSearchParams({
    "filter[type]": "ticket",
    "page[size]": "100",
    query: query.slice("type:ticket ".length),
  });
  let path = `/search/export.json?${params}`;
  for (let pageNumber = 0; pageNumber < pageBudget; pageNumber++) {
    if (visited.has(path)) throw new Error("Zendesk Search incomplete: pagination loop");
    visited.add(path);
    const page = await getPage(path);
    if (typeof page.meta?.has_more !== "boolean") {
      throw new Error("Zendesk Search incomplete: missing completion indicator");
    }
    for (const result of page.results) {
      if (!Number.isSafeInteger(result.id) || result.id <= 0 || ids.has(result.id)) {
        throw new Error("Zendesk Search incomplete: invalid or repeated ticket ID");
      }
      ids.add(result.id);
      results.push(result);
    }
    if (!page.meta.has_more) return results;
    if (!page.links?.next || page.results.length === 0) {
      throw new Error("Zendesk Search incomplete: missing continuation or empty nonterminal page");
    }
    path = page.links.next;
  }
  throw new Error("Zendesk Search incomplete: page budget exhausted");
}
