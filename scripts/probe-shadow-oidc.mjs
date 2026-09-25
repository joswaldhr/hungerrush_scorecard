/** Authentication-only hosted rehearsal; the optional worker check uses a no-ingestion route mode. */
export const audience = "https://vercel.com/cadence-staging-shadow";
const endpoint =
  "https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app/api/cron/action-shadow";

export async function rehearsePreviewProtection(getToken, request = fetch, workerToken) {
  if (
    workerToken !== undefined &&
    (typeof workerToken !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(workerToken))
  )
    throw new Error("Invalid staging worker credential");
  async function probe(token) {
    if (
      token !== undefined &&
      (typeof token !== "string" ||
        token.length > 16_384 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    ) {
      throw new Error("Invalid rehearsal identity token");
    }
    const response = await request(endpoint, {
      headers: token ? { "x-vercel-trusted-oidc-idp-token": token } : {},
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    let appAuthenticationRequired = false;
    if (
      response.status === 401 &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      const body = await response.json();
      appAuthenticationRequired = body?.error === "Unauthorized";
    }
    return { status: response.status, appAuthenticationRequired };
  }
  const anonymous = await probe();
  const wrongAudience = await probe(await getToken(`${audience}/untrusted`));
  for (const result of [anonymous, wrongAudience]) {
    if (
      result.appAuthenticationRequired ||
      ![301, 302, 303, 307, 308, 401, 403].includes(result.status)
    ) {
      throw new Error("Untrusted request did not remain behind deployment protection");
    }
  }
  const trustedToken = await getToken(audience);
  const trusted = await probe(trustedToken);
  if (!trusted.appAuthenticationRequired)
    throw new Error("Trusted identity did not reach application authentication");
  if (workerToken) {
    const response = await request(`${endpoint}?probe=auth`, {
      headers: {
        "x-vercel-trusted-oidc-idp-token": trustedToken,
        authorization: `Bearer ${workerToken}`,
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200) throw new Error("Worker authentication rehearsal failed");
    const body = await response.json();
    if (body?.authenticated !== true || body?.ingestionRequested !== false)
      throw new Error("Worker did not confirm authentication-only mode");
  }
  return {
    status: "preview_identity_verified",
    anonymousStatus: anonymous.status,
    wrongAudienceStatus: wrongAudience.status,
    applicationStatus: trusted.status,
    workerCredentialSent: Boolean(workerToken),
    workerAuthenticated: Boolean(workerToken),
    sourceIngestionStarted: false,
  };
}

/** Explicit manual rehearsal only. One bounded batch; never publishes manager metrics. */
export async function runControlledShadowBatch(getToken, workerToken, request = fetch) {
  if (typeof workerToken !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(workerToken))
    throw new Error("Invalid staging worker credential");
  const token = await getToken(audience);
  if (
    typeof token !== "string" ||
    token.length > 16_384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  )
    throw new Error("Invalid rehearsal identity token");
  const response = await request(endpoint, {
    headers: { "x-vercel-trusted-oidc-idp-token": token, authorization: `Bearer ${workerToken}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(260_000),
  });
  if (response.status !== 200) throw new Error("Controlled shadow batch failed");
  const body = await response.json();
  if (
    body.enabled !== true ||
    body.busy ||
    typeof body.completed !== "boolean" ||
    !Number.isInteger(body.steps) ||
    body.steps < 0 ||
    body.steps > 6 ||
    body.observationId !== null
  )
    throw new Error("Unexpected shadow batch result");
  const validDate = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value) &&
    new Date(value).toISOString() === value;
  if (
    !validDate(body.periodStart) ||
    !validDate(body.periodEndExclusive) ||
    Date.parse(body.periodEndExclusive) - Date.parse(body.periodStart) !== 86_400_000 ||
    Date.parse(body.periodEndExclusive) > Date.now() - 120_000
  )
    throw new Error("Unexpected shadow batch interval");
  const streams = {};
  for (const key of ["tickets", "legs"]) {
    const stream = body.streams?.[key];
    if (
      !stream ||
      !["pending", "waiting", "complete"].includes(stream.status) ||
      !Number.isSafeInteger(stream.pages) ||
      stream.pages < 0 ||
      !(
        stream.notBefore === null ||
        (typeof stream.notBefore === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stream.notBefore) &&
          Number.isFinite(Date.parse(stream.notBefore)))
      )
    )
      throw new Error("Unexpected shadow stream result");
    streams[key] = { status: stream.status, pages: stream.pages, notBefore: stream.notBefore };
  }
  if (body.completed !== Object.values(streams).every((stream) => stream.status === "complete"))
    throw new Error("Inconsistent shadow completion result");
  return {
    status: "controlled_shadow_batch",
    periodStart: body.periodStart,
    periodEndExclusive: body.periodEndExclusive,
    completed: body.completed,
    steps: body.steps,
    streams,
  };
}
