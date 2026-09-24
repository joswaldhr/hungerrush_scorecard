/** Single-file Railway cron function. Deploy this file verbatim; no npm dependencies. */
const PREVIEW_ORIGIN =
  "https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app";

export async function triggerActionShadow(
  settings: {
    enabled?: string;
    token?: string;
    origin?: string;
    probe?: string;
    previewCookie?: string;
  },
  request: typeof fetch = fetch
) {
  if (settings.enabled !== "true") return { status: "disabled" as const };
  if (!settings.token || settings.token.length < 32)
    throw new Error("Scheduler credential missing");
  // A credential cannot be redirected to another deployment or vendor-controlled pagination URL.
  if (settings.origin !== PREVIEW_ORIGIN)
    throw new Error("Scheduler destination is not the staging deployment");
  // Temporary, alias-scoped access for the hosted rehearsal only. Never use a
  // human's browser session or a project-wide protection bypass credential here.
  if (
    settings.previewCookie &&
    (settings.probe !== "true" || !/^_vercel_jwt=[A-Za-z0-9._~-]+$/.test(settings.previewCookie))
  )
    throw new Error("Preview session is only permitted for an explicit rehearsal");
  const response = await request(`${PREVIEW_ORIGIN}/api/cron/action-shadow`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${settings.token}`,
      ...(settings.previewCookie ? { cookie: settings.previewCookie } : {}),
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(260_000),
  });
  if (!response.ok) throw new Error(`Worker returned HTTP ${response.status}`);
  const body = await response.json();
  if (body?.enabled === false && settings.probe === "true")
    return { status: "authenticated_disabled" as const };
  if (body?.enabled !== true) throw new Error("Worker is not enabled");
  if (body.busy === true) {
    if (typeof body.retryAt !== "string" || !Number.isFinite(Date.parse(body.retryAt)))
      throw new Error("Invalid lease response");
    return { status: "busy" as const, retryAt: new Date(body.retryAt).toISOString() };
  }
  if (
    typeof body.completed !== "boolean" ||
    !Number.isInteger(body.steps) ||
    body.steps < 0 ||
    body.steps > 20 ||
    typeof body.periodStart !== "string" ||
    !Number.isFinite(Date.parse(body.periodStart))
  )
    throw new Error("Invalid worker response");
  return {
    status: body.completed ? ("complete" as const) : ("pending" as const),
    periodStart: new Date(body.periodStart).toISOString(),
    steps: body.steps as number,
  };
}

if (process.env.RAILWAY_SERVICE_ID || process.env.ACTION_SHADOW_SCHEDULER_RUN === "true") {
  triggerActionShadow({
    enabled: process.env.ACTION_SHADOW_SCHEDULER_ENABLED,
    token: process.env.ACTION_SHADOW_SECRET,
    origin: process.env.ACTION_SHADOW_ORIGIN,
    probe: process.env.ACTION_SHADOW_SCHEDULER_PROBE,
    previewCookie: process.env.ACTION_SHADOW_PREVIEW_COOKIE,
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      // Never log tokens, URLs, response bodies, or arbitrary network exception text.
      console.error(
        "Shadow worker trigger failed; inspect its authenticated configuration and checkpoint health."
      );
      process.exitCode = 1;
    });
}
