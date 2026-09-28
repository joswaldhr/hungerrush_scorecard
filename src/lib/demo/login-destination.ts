/** Always returns a local constant; a callback query can never become an open redirect. */
export function loginDestination(destination?: string | string[], callbackUrl?: string | string[]) {
  if (destination === "demo") return "/demo/one-on-ones";
  if (typeof callbackUrl === "string") {
    try {
      const path = new URL(callbackUrl, "https://cadence.invalid").pathname;
      if (path === "/demo" || path.startsWith("/demo/")) return "/demo/one-on-ones";
    } catch {
      /* Malformed input keeps the ordinary application destination. */
    }
  }
  return "/";
}
