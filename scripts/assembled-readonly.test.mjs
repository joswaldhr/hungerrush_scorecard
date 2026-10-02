import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAssembledReader,
  readPeople,
  matchRoster,
  inspectActivities,
} from "./lib/assembled-readonly.mjs";

const agent = "10000000-0000-4000-8000-000000000001";
const person = { id: "p1", agent_id: agent, email: "a@example.test", deleted: false };
const employee = { email: "A@example.test", team: "pos" };
const json = (body) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

test("transport has only allowlisted GET, refuses foreign paths and unknown parameters", async () => {
  const calls = [];
  const reader = createAssembledReader("sk_live_synthetic", {
    pause: async () => {},
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return json({});
    },
  });
  await assert.rejects(reader.get("https://example.test"), /endpoint_rejected/);
  await assert.rejects(reader.get("reports/adherence"), /endpoint_rejected/);
  await assert.rejects(reader.get("people", { method: "POST" }), /parameter_rejected/);
  await reader.get("people", { limit: 500 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "https://api.assembledhq.com");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers["API-Version"], undefined);
});

test("429 stops without retry or leaking vendor response", async () => {
  const reader = createAssembledReader("sk_live_synthetic", {
    fetcher: async () => new Response("private vendor detail", { status: 429 }),
  });
  await assert.rejects(reader.get("people"), { message: "http_429" });
  assert.equal(reader.stats().requests, 1);
});

test("concurrency and total request budget are bounded", async () => {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const reader = createAssembledReader("sk_live_synthetic", {
    pause: async () => {},
    fetcher: async () => {
      await waiting;
      return json({});
    },
  });
  const first = reader.get("people");
  await assert.rejects(reader.get("people"), /concurrent_read_rejected/);
  release();
  await first;
  for (let n = 1; n < 12; n++) await reader.get("people");
  await assert.rejects(reader.get("people"), /request_budget_exhausted/);
});

test("activity requests require one agent and at most one week", async () => {
  const reader = createAssembledReader("sk_live_synthetic");
  await assert.rejects(
    reader.get("activities", { start_time: 1, end_time: 1 + 8 * 86400, agents: agent }),
    /invalid_window/
  );
  await assert.rejects(
    reader.get("activities", { start_time: 1, end_time: 2 }),
    /single_agent_required/
  );
  assert.equal(reader.stats().requests, 0);
});

test("transport redacts thrown private errors and rejects oversized bodies", async () => {
  const failed = createAssembledReader("sk_live_synthetic", {
    fetcher: async () => {
      throw new Error("private request credential");
    },
  });
  await assert.rejects(failed.get("people"), { message: "read_failed" });
  const huge = createAssembledReader("sk_live_synthetic", {
    fetcher: async () =>
      new Response("x".repeat(8_000_001), { headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(huge.get("people"), { message: "response_budget_exhausted" });
});

test("complete roster pagination rejects truncation, drift and duplicates", async () => {
  const page = (people, total, offset) => ({ people, total, offset, limit: 500 });
  let pages = [page({ p1: person }, 2, 0), page({ p2: { ...person, id: "p2" } }, 2, 1)];
  assert.equal((await readPeople({ get: async () => pages.shift() })).length, 2);
  for (const last of [page({}, 2, 1), page({ p1: person }, 2, 1), page({}, 3, 1)]) {
    pages = [page({ p1: person }, 2, 0), last];
    await assert.rejects(readPeople({ get: async () => pages.shift() }));
  }
});

test("identity matching refuses deleted, ambiguous, blank and shared agents", () => {
  assert.equal(matchRoster([employee], [person]).matches.length, 1);
  assert.equal(matchRoster([employee], [{ ...person, deleted: true }]).summary.pos.missing, 1);
  assert.equal(matchRoster([employee], [person, { ...person, id: "p2" }]).summary.pos.ambiguous, 1);
  assert.equal(matchRoster([employee, employee], [person]).matches.length, 0);
  assert.equal(matchRoster([{ ...employee, email: null }], [person]).matches.length, 0);
  assert.equal(
    matchRoster([employee], [{ ...person, agent_id: null }]).summary.pos.missingAgentId,
    1
  );
  assert.equal(
    matchRoster([employee], [person, { ...person, id: "p2", email: "b@example.test" }]).summary.pos
      .sharedAgent,
    1
  );
});

test("schedule segments retain repeated base IDs and flag structural gaps without certification", () => {
  const first = {
    id: "base",
    id_with_timestamps: "base-1",
    start_time: 10,
    end_time: 20,
    agent_id: agent,
    type_id: "work",
  };
  const second = { ...first, id_with_timestamps: "base-2", start_time: 20, end_time: 30 };
  const report = inspectActivities({ activities: { first, second } }, agent, 10, 40, { work: {} });
  assert.equal(report.rows, 2);
  assert.equal(report.uniqueBaseIds, 1);
  assert.equal(report.uniqueSegmentIds, 2);
  assert.equal(report.overlaps, 0);
  assert.equal(report.qualified, false);
  const bad = inspectActivities(
    {
      activities: {
        first,
        second: { ...second, start_time: 15, agent_id: "wrong", type_id: "unknown" },
      },
    },
    agent,
    10,
    40,
    { work: {} }
  );
  assert.equal(bad.overlaps, 1);
  assert.equal(bad.foreignAgent, 1);
  assert.equal(bad.unknownType, 1);
});
