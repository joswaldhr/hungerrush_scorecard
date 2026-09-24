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

it("can verify authentication explicitly while ingestion remains disabled", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ enabled: false }));
  expect(await triggerActionShadow({ ...settings, probe: "true" }, request)).toEqual({
    status: "authenticated_disabled",
  });
  await expect(
    triggerActionShadow(
      { ...settings, probe: "true" },
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    )
  ).rejects.toThrow("401");
});
