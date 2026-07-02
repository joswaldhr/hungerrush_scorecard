// Paginated fetch for direct Supabase reads. PostgREST silently caps any select at
// 1,000 rows (defect L7 in docs/refactor-plan.md) — every read that can exceed that
// must go through here. The factory receives an inclusive range and must apply a
// stable .order() so pages don't shuffle between requests.
//
// Error semantics match a plain single query: on any page error the partial data is
// discarded and { data: null, error } is returned.

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllPages<T>(
  makePage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makePage(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) return { data: all, error: null };
  }
}
