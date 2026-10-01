/** Qualification only. No application imports, publication or write-capable methods. */
import { setTimeout as sleep } from "node:timers/promises";

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}

export function recordMap(value) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), "invalid_record_map");
  return Object.values(value);
}

export function createAssembledReader(apiKey, { fetcher = fetch, pause = sleep } = {}) {
  requireValue(typeof apiKey === "string" && apiKey.startsWith("sk_live_"), "missing_api_key");
  const deadline = Date.now() + 180_000;
  let requests = 0;
  let busy = false;
  const versions = new Set();
  async function get(endpoint, params = {}) {
    requireValue(!busy, "concurrent_read_rejected");
    const allowed = {
      people: ["limit", "offset", "include_deleted"],
      activity_types: [],
      activities: ["start_time", "end_time", "agents", "include_agents", "include_activity_types"],
    };
    requireValue(Object.hasOwn(allowed, endpoint), "endpoint_rejected");
    requireValue(
      Object.keys(params).every((key) => allowed[endpoint].includes(key)),
      "parameter_rejected"
    );
    if (endpoint === "activities") {
      const start = Number(params.start_time);
      const end = Number(params.end_time);
      requireValue(
        Number.isSafeInteger(start) &&
          Number.isSafeInteger(end) &&
          start > 0 &&
          end > start &&
          end - start <= 7 * 86400,
        "invalid_window"
      );
      requireValue(
        typeof params.agents === "string" && /^[a-f0-9-]{36}$/i.test(params.agents),
        "single_agent_required"
      );
    }
    requireValue(requests < 12 && Date.now() + 30_700 < deadline, "request_budget_exhausted");
    busy = true;
    try {
      if (requests) await pause(700);
      requests++;
      const url = new URL(`https://api.assembledhq.com/v0/${endpoint}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
      const response = await fetcher(url, {
        method: "GET",
        redirect: "error",
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
      // Never forward vendor error bodies, request URLs or credentials to logs.
      requireValue(response.ok, `http_${response.status}`);
      const version = response.headers.get("api-version");
      if (version && /^\d{4}-\d{2}-\d{2}$/.test(version)) versions.add(version);
      requireValue(response.headers.get("content-type")?.includes("json"), "invalid_content_type");
      const reader = response.body.getReader();
      const chunks = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          requireValue(bytes <= 8_000_000, "response_budget_exhausted");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      const code = String(error?.message ?? "");
      throw new Error(
        /^(http_\d{3}|invalid_content_type|response_budget_exhausted)$/.test(code)
          ? code
          : "read_failed"
      );
    } finally {
      busy = false;
    }
  }
  return {
    get,
    stats: () => ({ requests, responseVersions: [...versions], retries: 0 }),
  };
}

export async function readPeople(reader) {
  const people = [];
  const ids = new Set();
  let total;
  for (let page = 0; page < 4; page++) {
    const response = await reader.get("people", {
      limit: 500,
      offset: people.length,
      include_deleted: true,
    });
    requireValue(
      Number.isSafeInteger(response.total) && response.total >= 0,
      "invalid_roster_total"
    );
    total ??= response.total;
    requireValue(response.total === total, "roster_changed_during_read");
    const rows = recordMap(response.people);
    requireValue(
      response.offset === people.length && response.limit === 500,
      "invalid_roster_page"
    );
    for (const person of rows) {
      requireValue(
        typeof person.id === "string" && !ids.has(person.id),
        "duplicate_or_missing_person_id"
      );
      requireValue(typeof person.deleted === "boolean", "unknown_deleted_status");
      ids.add(person.id);
      people.push(person);
    }
    requireValue(people.length <= total, "roster_count_overflow");
    if (people.length === total) return people;
    requireValue(rows.length > 0, "premature_roster_end");
  }
  throw new Error("roster_page_budget_exhausted");
}

export function matchRoster(employees, people) {
  const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
  const matches = [];
  const summary = {};
  for (const employee of employees) {
    const team = (summary[employee.team] ??= {
      employees: 0,
      uniqueActiveMatches: 0,
      missing: 0,
      ambiguous: 0,
      missingAgentId: 0,
      sharedAgent: 0,
    });
    team.employees++;
    const email = normalize(employee.email);
    const candidates = email
      ? people.filter((p) => p.deleted === false && normalize(p.email) === email)
      : [];
    if (!candidates.length) {
      team.missing++;
      continue;
    }
    if (
      candidates.length !== 1 ||
      employees.filter((e) => normalize(e.email) === email).length !== 1
    ) {
      team.ambiguous++;
      continue;
    }
    const person = candidates[0];
    if (typeof person.agent_id !== "string" || !/^[a-f0-9-]{36}$/i.test(person.agent_id)) {
      team.missingAgentId++;
      continue;
    }
    if (people.filter((p) => p.deleted === false && p.agent_id === person.agent_id).length !== 1) {
      team.sharedAgent++;
      continue;
    }
    team.uniqueActiveMatches++;
    matches.push({ employee, person });
  }
  return { summary, matches };
}

/** Structural availability only: no scheduled/actual-hour or adherence calculation. */
export function inspectActivities(payload, agentId, start, end, activityTypes) {
  const rows = recordMap(payload.activities);
  const keys = new Set();
  const ids = new Set();
  let invalidIntervals = 0,
    outsideWindow = 0,
    foreignAgent = 0,
    unknownType = 0,
    missingSegmentId = 0,
    duplicateSegments = 0,
    overlaps = 0;
  let latestEnd = -Infinity;
  for (const row of [...rows].sort((a, b) => a.start_time - b.start_time)) {
    if (
      !Number.isSafeInteger(row.start_time) ||
      !Number.isSafeInteger(row.end_time) ||
      row.end_time <= row.start_time
    )
      invalidIntervals++;
    else {
      if (row.start_time >= end || row.end_time <= start) outsideWindow++;
      if (row.start_time < latestEnd) overlaps++;
      latestEnd = Math.max(latestEnd, row.end_time);
    }
    if (row.agent_id !== agentId) foreignAgent++;
    if (!Object.hasOwn(activityTypes, row.type_id)) unknownType++;
    if (typeof row.id_with_timestamps !== "string" || !row.id_with_timestamps) missingSegmentId++;
    else if (keys.has(row.id_with_timestamps)) duplicateSegments++;
    else keys.add(row.id_with_timestamps);
    if (typeof row.id === "string") ids.add(row.id);
  }
  return {
    rows: rows.length,
    uniqueBaseIds: ids.size,
    uniqueSegmentIds: keys.size,
    invalidIntervals,
    outsideWindow,
    foreignAgent,
    unknownType,
    missingSegmentId,
    duplicateSegments,
    overlaps,
    qualified: false,
  };
}
