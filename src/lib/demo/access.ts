/** Fail closed. An enabled demo is still unavailable on the production deployment. */
export function canAccessDemo(
  email: string | null | undefined,
  config: { enabled?: string; allowedEmails?: string; deployment?: string }
) {
  if (config.enabled !== "true" || config.deployment === "production" || !email) return false;
  const allowed = (config.allowedEmails ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
