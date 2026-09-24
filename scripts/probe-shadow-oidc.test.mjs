import { test } from "node:test";
import assert from "node:assert/strict";
import { audience, rehearsePreviewProtection } from "./probe-shadow-oidc.mjs";

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
