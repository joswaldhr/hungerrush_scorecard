export interface TalkCall {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface TalkPage<T> {
  calls: T[];
  count: number;
  next_page: string | null;
}

// Talk uses modified-since pagination, not creation-date ordering. Its next_page
// remains populated at exhaustion; do not use Support's end_of_stream contract.
// Until a short-page threshold is verified, require an explicitly empty page.
export async function fetchCompleteTalkWeek<T extends TalkCall>(
  periodStart: string,
  periodEnd: string,
  getPage: (path: string) => Promise<TalkPage<T>>,
  pageBudget = 50
): Promise<{ calls: T[]; pages: number }> {
  const start = Date.parse(`${periodStart}T00:00:00Z`);
  const endExclusive = Date.parse(`${periodEnd}T00:00:00Z`) + 86_400_000;
  if (!Number.isFinite(start) || !Number.isFinite(endExclusive) || start >= endExclusive) {
    throw new Error("Zendesk Talk invalid reporting period");
  }
  let path: string = `/channels/voice/stats/incremental/calls.json?start_time=${start / 1000}`;
  const visited = new Set<string>();
  const latest = new Map<number, T>();
  for (let pages = 1; pages <= pageBudget; pages++) {
    if (visited.has(path)) throw new Error("Zendesk Talk incomplete: stalled pagination");
    visited.add(path);
    const page = await getPage(path);
    if (!Number.isInteger(page.count) || page.count < 0 || page.count !== page.calls.length) {
      throw new Error("Zendesk Talk incomplete: inconsistent page count");
    }
    if (page.count === 0) {
      return {
        calls: [...latest.values()].filter((call) => {
          const created = Date.parse(call.created_at);
          return created >= start && created < endExclusive;
        }),
        pages,
      };
    }
    for (const call of page.calls) {
      const updated = Date.parse(call.updated_at);
      if (
        !Number.isSafeInteger(call.id) ||
        call.id <= 0 ||
        !Number.isFinite(updated) ||
        !Number.isFinite(Date.parse(call.created_at))
      ) {
        throw new Error("Zendesk Talk incomplete: invalid call identity or timestamps");
      }
      const previous = latest.get(call.id);
      if (!previous || updated > Date.parse(previous.updated_at)) latest.set(call.id, call);
      else if (updated === Date.parse(previous.updated_at)) {
        // Ignore identical boundary repeats, but do not guess between conflicting
        // versions when the vendor timestamp cannot order them.
        const keys = new Set([...Object.keys(previous), ...Object.keys(call)]);
        if (
          [...keys].some(
            (key) =>
              JSON.stringify(previous[key as keyof T]) !== JSON.stringify(call[key as keyof T])
          )
        ) {
          throw new Error("Zendesk Talk incomplete: conflicting versions of a call");
        }
      }
    }
    if (!page.next_page) throw new Error("Zendesk Talk incomplete: missing continuation");
    path = page.next_page;
  }
  throw new Error("Zendesk Talk incomplete: page budget exhausted");
}
