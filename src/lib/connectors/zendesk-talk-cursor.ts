import { createHash } from "node:crypto";
import { z } from "zod";
import { talkParticipationLegSchema } from "./zendesk-talk-participation";
import { outboundCallSchema } from "./zendesk-outbound";

type Resource = "calls" | "legs";
export type TalkRecordValue =
  z.infer<typeof outboundCallSchema> | z.infer<typeof talkParticipationLegSchema>;
export interface TalkCursor {
  version: 1;
  origin: string;
  resource: Resource;
  initialStartTime: number;
  path: string;
  watermark: number;
  pages: number;
  status: "pending" | "exhausted";
  visited: string[];
}
export interface TalkStoredVersion {
  id: number;
  updatedAt: string;
  digest: string;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const key = (value: { id: number; updated_at: string }) => `${value.id}:${value.updated_at}`;

function sourcePath(origin: string, resource: Resource, path: string) {
  const url = new URL(path, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== `/api/v2/channels/voice/stats/incremental/${resource}.json` ||
    !/^\d+$/.test(url.searchParams.get("start_time") ?? "") ||
    [...url.searchParams.keys()].some((name) => name !== "start_time") ||
    url.searchParams.getAll("start_time").length !== 1
  )
    throw new Error("Invalid Talk cursor destination");
  return url.href;
}

export function initialTalkCursor(
  origin: string,
  resource: Resource,
  startTime: number
): TalkCursor {
  if (
    !/^https:\/\/[a-z0-9][a-z0-9-]*\.zendesk\.com$/.test(origin) ||
    !["calls", "legs"].includes(resource) ||
    !Number.isSafeInteger(startTime) ||
    startTime < 0
  )
    throw new Error("Invalid Talk cursor scope");
  return {
    version: 1,
    origin,
    resource,
    initialStartTime: startTime,
    path: `${origin}/api/v2/channels/voice/stats/incremental/${resource}.json?start_time=${startTime}`,
    watermark: startTime,
    pages: 0,
    status: "pending",
    visited: [],
  };
}

/**
 * Pure one-page transition for resumable collection. The storage adapter must read
 * latest rows AND all existing (ID, updated_at) versions for this page, then commit
 * returned records, revisions and cursor in one compare-and-swap transaction.
 * A rejected page leaves the input untouched. "Exhausted" is one export's boundary,
 * not an atomic joined snapshot or authorization to publish an employee value.
 */
export function advanceTalkCursor(
  before: TalkCursor,
  response: unknown,
  storedLatest: TalkRecordValue[],
  storedVersions: TalkStoredVersion[]
) {
  const initial = initialTalkCursor(before.origin, before.resource, before.initialStartTime);
  if (
    before.version !== 1 ||
    before.status !== "pending" ||
    !Number.isSafeInteger(before.pages) ||
    before.pages < 0 ||
    before.pages >= 10000 ||
    !Number.isSafeInteger(before.watermark) ||
    before.watermark < initial.watermark ||
    before.visited.length !== before.pages ||
    new Set(before.visited).size !== before.visited.length
  )
    throw new Error("Invalid or exhausted Talk cursor");
  const path = sourcePath(before.origin, before.resource, before.path);
  const requestDigest = digest(path);
  if (before.visited.includes(requestDigest) && before.visited.at(-1) !== requestDigest)
    throw new Error("Talk cursor cycle");
  const envelope = z
    .object({
      count: z.number().int().nonnegative(),
      end_time: z.number().int().nonnegative().safe(),
      next_page: z.string().nullable(),
      calls: z.array(z.unknown()).optional(),
      legs: z.array(z.unknown()).optional(),
    })
    .safeParse(response);
  if (!envelope.success) throw new Error("Invalid Talk export envelope");
  const page = envelope.data;
  const schema = before.resource === "calls" ? outboundCallSchema : talkParticipationLegSchema;
  const parsed = z.array(schema).safeParse(page[before.resource]);
  if (!parsed.success || parsed.data.length !== page.count || page.end_time < before.watermark)
    throw new Error("Invalid Talk export count, records or watermark");
  const continuation =
    page.next_page === null ? null : sourcePath(before.origin, before.resource, page.next_page);
  if (page.count > 0 && continuation === null) throw new Error("Missing Talk continuation");
  const latest = new Map<number, TalkRecordValue>();
  const versions = new Map<string, string>();
  for (const version of storedVersions) {
    const versionKey = `${version.id}:${version.updatedAt}`;
    if (versions.has(versionKey) && versions.get(versionKey) !== version.digest)
      throw new Error("Conflicting stored Talk version");
    versions.set(versionKey, version.digest);
  }
  const parsedStored = z.array(schema).safeParse(storedLatest);
  if (!parsedStored.success) throw new Error("Invalid stored Talk records");
  for (const row of parsedStored.data) {
    if (latest.has(row.id)) throw new Error("Duplicate stored Talk record");
    latest.set(row.id, row);
    const previousHash = versions.get(key(row));
    if (previousHash && previousHash !== digest(row))
      throw new Error("Conflicting stored Talk version");
    versions.set(key(row), digest(row));
  }
  const changed = new Map<number, TalkRecordValue>();
  const revisions = new Map<string, { record: TalkRecordValue; digest: string }>();
  let identicalBoundary = before.pages > 0;
  for (const row of parsed.data) {
    if (Date.parse(row.updated_at) < Date.parse(row.created_at))
      throw new Error("Invalid Talk chronology");
    const rowDigest = digest(row),
      rowKey = key(row);
    const known = versions.get(rowKey);
    if (known && known !== rowDigest) throw new Error("Conflicting Talk source version");
    if (!known) revisions.set(rowKey, { record: row, digest: rowDigest });
    versions.set(rowKey, rowDigest);
    const previous = latest.get(row.id);
    if (!previous || digest(previous) !== rowDigest) identicalBoundary = false;
    if (!previous || Date.parse(row.updated_at) > Date.parse(previous.updated_at)) {
      latest.set(row.id, row);
      changed.set(row.id, row);
    }
  }
  const exhausted =
    page.count === 0 ||
    (identicalBoundary && continuation === path && page.end_time === before.watermark);
  const visited = [...before.visited, requestDigest];
  // A first request at the current terminal timestamp can contain new records
  // without advancing its cursor. Persist that page, then require an identical
  // repeat; a second changing page at the same cursor is never completion.
  if (
    !exhausted &&
    continuation &&
    visited.includes(digest(continuation)) &&
    !(continuation === path && !before.visited.includes(requestDigest))
  )
    throw new Error("Talk cursor cycle or changing terminal boundary");
  return {
    cursor: {
      ...before,
      path: continuation ?? path,
      watermark: page.end_time,
      pages: before.pages + 1,
      status: exhausted ? ("exhausted" as const) : ("pending" as const),
      visited,
    },
    records: [...changed.values()],
    revisions: [...revisions.values()],
  };
}
