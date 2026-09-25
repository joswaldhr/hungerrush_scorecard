import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audience,
  rehearsePreviewProtection,
  runControlledShadowBatch,
} from "./probe-shadow-oidc.mjs";

test("keeps credentials on the fixed Preview endpoint and distinguishes both auth layers", async () => {
  const calls = [];
  const responses = [
    new Response(null, { status: 302 }),
    new Response(null, { status: 403 }),
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  ];
  const report = await rehearsePreviewProtection(
    async (aud) => (aud === audience ? "valid.payload.signature" : "wrong.payload.signature"),
    async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    }
  );
  assert.equal(report.status, "preview_identity_verified");
  assert.equal(report.sourceIngestionStarted, false);
  assert.equal(calls.length, 3);
  for (const { url, options } of calls) {
    assert.equal(
      new URL(url).hostname,
      "hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app"
    );
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.authorization, undefined);
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.doesNotMatch(JSON.stringify(report), /payload|signature/);
});

const batchFixture = () => ({
  enabled: true,
  completed: false,
  steps: 6,
  observationId: null,
  periodStart: "2026-09-20T00:00:00.000Z",
  periodEndExclusive: "2026-09-21T00:00:00.000Z",
  streams: {
    tickets: { status: "pending", pages: 3, notBefore: null },
    legs: { status: "pending", pages: 3, notBefore: null },
  },
});
const workerFixture = "synthetic-worker-credential-32characters";
test("manual ingestion uses one bounded fixed-origin request and emits only selected evidence", async () => {
  let calls = 0;
  const result = await runControlledShadowBatch(
    async () => "a.b.c",
    workerFixture,
    async (url, options) => {
      calls++;
      assert.equal(new URL(url).search, "");
      assert.equal(
        new URL(url).origin,
        "https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app"
      );
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({
        ...batchFixture(),
        secret: workerFixture,
        arbitraryVendorPayload: "private",
      });
    }
  );
  assert.equal(calls, 1);
  assert.equal(result.steps, 6);
  assert.doesNotMatch(JSON.stringify(result), /private|synthetic-worker|arbitraryVendorPayload/);
});
test("manual ingestion refuses disabled, busy, malformed and inconsistent worker responses", async () => {
  for (const body of [
    { enabled: false },
    { enabled: true, busy: true },
    { ...batchFixture(), steps: 7 },
    { ...batchFixture(), completed: true },
    { ...batchFixture(), periodEndExclusive: "2026-09-22T00:00:00.000Z" },
    { ...batchFixture(), streams: {} },
  ])
    await assert.rejects(
      runControlledShadowBatch(
        async () => "a.b.c",
        workerFixture,
        async () => Response.json(body)
      )
    );
  await assert.rejects(
    runControlledShadowBatch(
      async () => "a.b.c",
      workerFixture,
      async () => new Response(null, { status: 401 })
    )
  );
});
test("manual ingestion validates both credentials before requesting work", async () => {
  const never = async () => {
    assert.fail("Must not send a request");
  };
  await assert.rejects(runControlledShadowBatch(async () => "a.b.c", "", never));
  await assert.rejects(
    runControlledShadowBatch(async () => "unsafe\r\nheader", workerFixture, never)
  );
});
test("fails if protection is absent or a trusted token is still blocked", async () => {
  await assert.rejects(
    rehearsePreviewProtection(
      async () => "a.b.c",
      async () => Response.json({ error: "Unauthorized" }, { status: 401 })
    ),
    /Untrusted/
  );
  await assert.rejects(
    rehearsePreviewProtection(
      async () => "a.b.c",
      async () => new Response(null, { status: 302 })
    ),
    /Trusted/
  );
});
test("rejects malformed identity headers without sending them", async () => {
  let calls = 0;
  await assert.rejects(
    rehearsePreviewProtection(
      async () => "unsafe\r\nheader",
      async () => {
        calls++;
        return new Response(null, { status: 302 });
      }
    ),
    /Invalid/
  );
  assert.equal(calls, 1);
});
test("authenticates a worker only through the explicit no-ingestion mode", async () => {
  const calls = [];
  const responses = [
    new Response(null, { status: 302 }),
    new Response(null, { status: 302 }),
    Response.json({ error: "Unauthorized" }, { status: 401 }),
    Response.json({ authenticated: true, ingestionRequested: false }),
  ];
  const token = "synthetic-worker-credential-32characters";
  const result = await rehearsePreviewProtection(
    async () => "a.b.c",
    async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    },
    token
  );
  assert.equal(result.workerAuthenticated, true);
  assert.equal(result.sourceIngestionStarted, false);
  assert.equal(new URL(calls[3].url).search, "?probe=auth");
  assert.equal(calls[3].options.redirect, "error");
  assert.equal(calls[3].options.headers.authorization, `Bearer ${token}`);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-worker/);
});
