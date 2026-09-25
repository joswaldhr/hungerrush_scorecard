// @vitest-environment node
import { expect, it, vi } from "vitest";
import { triggerActionShadow } from "../../scripts/action-shadow-scheduler";

const settings = {
  enabled: "true",
  token: "synthetic-secret-".repeat(3),
  origin: "https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app",
};
it("stays disabled until explicitly configured and rejects a different destination before sending credentials", async () => {
  const request = vi.fn();
  expect(await triggerActionShadow({}, request)).toEqual({ status: "disabled" });
  await expect(
    triggerActionShadow({ ...settings, origin: "https://untrusted.invalid" }, request)
  ).rejects.toThrow("destination");
  expect(request).not.toHaveBeenCalled();
});
it("uses a bounded request with redirects disabled and logs only validated result fields", async () => {
  const request = vi.fn().mockResolvedValue(
    Response.json({
      enabled: true,
      completed: false,
      steps: 6,
      periodStart: "2026-09-23T00:00:00Z",
      private: "do not log",
    })
  );
  expect(await triggerActionShadow(settings, request)).toEqual({
    status: "pending",
    steps: 6,
    periodStart: "2026-09-23T00:00:00.000Z",
  });
  expect(request).toHaveBeenCalledWith(
    `${settings.origin}/api/cron/action-shadow`,
    expect.objectContaining({
      redirect: "error",
      cache: "no-store",
      signal: expect.any(AbortSignal),
      headers: { authorization: `Bearer ${settings.token}` },
    })
  );
});
it("reports disabled workers, authentication failures, and malformed results as failures", async () => {
  for (const response of [
    Response.json({ enabled: false }),
    new Response("private body", { status: 401 }),
    Response.json({ enabled: true, completed: true, steps: -1 }),
  ])
    await expect(
      triggerActionShadow(settings, vi.fn().mockResolvedValue(response))
    ).rejects.toThrow();
});
it("reports an active lease without treating overlap as a source failure", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json({ enabled: true, busy: true, retryAt: "2026-09-24T15:00:00Z" })
    );
  expect(await triggerActionShadow(settings, request)).toEqual({
    status: "busy",
    retryAt: "2026-09-24T15:00:00.000Z",
  });
});

it("uses the non-ingesting authentication route even if source configuration changes", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(Response.json({ authenticated: true, ingestionRequested: false }));
  expect(await triggerActionShadow({ ...settings, probe: "true" }, request)).toEqual({
    status: "authenticated",
  });
  expect(request.mock.calls[0]?.[0]).toBe(`${settings.origin}/api/cron/action-shadow?probe=auth`);
  await expect(
    triggerActionShadow(
      { ...settings, probe: "true" },
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    )
  ).rejects.toThrow("401");
});

it("rejects ingestion responses in authentication-only mode", async () => {
  for (const body of [
    { enabled: false },
    { enabled: true, completed: true, steps: 6, periodStart: "2026-09-23T00:00:00Z" },
    { authenticated: true, ingestionRequested: true },
    { authenticated: false, ingestionRequested: false },
  ]) {
    await expect(
      triggerActionShadow(
        { ...settings, probe: "true" },
        vi.fn().mockResolvedValue(Response.json(body))
      )
    ).rejects.toThrow("authentication-only");
  }
});

it("restricts temporary alias-session access to explicit rehearsals and one cookie", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(Response.json({ authenticated: true, ingestionRequested: false }));
  const previewCookie = "_vercel_jwt=synthetic.temporary.session";
  expect(await triggerActionShadow({ ...settings, probe: "true", previewCookie }, request)).toEqual(
    { status: "authenticated" }
  );
  expect(request).toHaveBeenCalledWith(
    `${settings.origin}/api/cron/action-shadow?probe=auth`,
    expect.objectContaining({
      headers: { authorization: `Bearer ${settings.token}`, cookie: previewCookie },
      redirect: "error",
    })
  );
  request.mockClear();
  await expect(triggerActionShadow({ ...settings, previewCookie }, request)).rejects.toThrow(
    "rehearsal"
  );
  await expect(
    triggerActionShadow(
      { ...settings, probe: "true", previewCookie: `${previewCookie}; other=private` },
      request
    )
  ).rejects.toThrow("rehearsal");
  expect(request).not.toHaveBeenCalled();
});
