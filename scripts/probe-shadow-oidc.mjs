/** Authentication-only hosted rehearsal. Never sends a worker credential or starts ingestion. */
export const audience = "https://vercel.com/cadence-staging-shadow";
const endpoint =
  "https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app/api/cron/action-shadow";

export async function rehearsePreviewProtection(getToken, request = fetch) {
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
  const trusted = await probe(await getToken(audience));
  if (!trusted.appAuthenticationRequired)
    throw new Error("Trusted identity did not reach application authentication");
  return {
    status: "preview_identity_verified",
    anonymousStatus: anonymous.status,
    wrongAudienceStatus: wrongAudience.status,
    applicationStatus: trusted.status,
    workerCredentialSent: false,
    sourceIngestionStarted: false,
  };
}
