/** Fixture seeding resets tables and must never inherit a hosted application URL. */
export function assertLocalFixtureDatabase(connectionString: string): void {
  let allowed = false;
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.slice(1));
    allowed =
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      (database === "cadence" || /^[a-z0-9_]+_test$/.test(database)) &&
      !url.search &&
      !url.hash;
  } catch {
    /* Invalid URLs are rejected without including credentials in the error. */
  }
  if (!allowed)
    throw new Error(
      "Fixture reset requires a loopback cadence or *_test database without connection overrides"
    );
}
