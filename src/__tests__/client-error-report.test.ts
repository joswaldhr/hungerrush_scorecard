// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { clientErrorReport } from "@/lib/client-error-report";
import { POST } from "@/app/api/client-error/route";
afterEach(() => vi.restoreAllMocks());
it("retains a route template and digest without identity, URL parameters, or arbitrary error text", async () => {
  const sink = vi.spyOn(console, "error").mockImplementation(() => {});
  const report = {
    digest: "2443972009",
    boundary: "scorecard",
    message: "private@example.test",
    stack: "secret-token",
    url: "https://cadence.test/one-on-ones/private-employee?token=private-secret#private",
  };
  await POST(
    new Request("https://cadence.test/api/client-error", {
      method: "POST",
      body: JSON.stringify(report),
    })
  );
  expect(sink).toHaveBeenCalledOnce();
  const logged = String(sink.mock.calls[0]?.[0]);
  expect(logged).not.toContain("private");
  expect(logged).not.toContain("secret");
  expect(JSON.parse(logged).context).toEqual({
    boundary: "scorecard",
    route: "/one-on-ones/[id]",
    digest: "2443972009",
  });
  expect(clientErrorReport(report)).toEqual(JSON.parse(logged).context);
});
it.each(["null", "[]", "invalid-json", JSON.stringify({ message: "x".repeat(5000) })])(
  "ignores malformed or oversized telemetry without causing another error",
  async (body) => {
    const sink = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(
      new Request("https://cadence.test/api/client-error", { method: "POST", body })
    );
    expect(response.status).toBe(200);
    expect(sink).not.toHaveBeenCalled();
  }
);
it("restricts diagnostic fields and never logs unknown route segments", () => {
  expect(
    clientErrorReport({
      url: "/private@example.test?token=secret",
      digest: "private@example.test",
      boundary: "private@example.test",
    })
  ).toEqual({ route: "unknown", boundary: "application" });
  expect(clientErrorReport({ route: "/one-on-ones/person/history" }).route).toBe(
    "/one-on-ones/[id]/history"
  );
});
