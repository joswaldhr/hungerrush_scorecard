// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createReportJoinReader } from "./zendesk-report-join-reader";
const credentials = {
  subdomain: "synthetic",
  email: "source@example.invalid",
  apiKey: "synthetic-token",
};
const account = "zendesk-account:synthetic";
const users =
  "/users.json?role%5B%5D=agent&role%5B%5D=admin&page%5Bsize%5D=100&include_boundary_indicators=true";
const tickets = "/tickets/show_many.json?ids=1,2&include=metric_sets";
const deletions = "/deleted_tickets.json?per_page=100&sort_by=deleted_at&sort_order=desc";
it("limits authenticated requests to exact GET joins and query shapes", async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}"));
  const read = createReportJoinReader(credentials, account, { request, spacingMs: 0 });
  for (const path of [
    users,
    tickets,
    deletions,
    users + "&page%5Bafter%5D=opaque",
    deletions + "&page=2",
  ])
    await read(path);
  expect(
    request.mock.calls.every(
      ([, options]) => options?.method === "GET" && options.redirect === "error"
    )
  ).toBe(true);
  for (const path of [
    "https://other.zendesk.com/api/v2" + tickets,
    users + "&include=comments",
    users + "&role%5B%5D=end-user",
    tickets + "&ids=3",
    tickets.replace("1,2", "1,1"),
    deletions.replace("desc", "asc"),
    "/tickets.json",
    tickets + "#fragment",
  ])
    await expect(read(path)).rejects.toThrow("allowlist");
  expect(request).toHaveBeenCalledTimes(5);
});
it("stops after a failure and never retries a 429 in the join invocation", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("PRIVATE", { status: 429, headers: { "retry-after": "120" } }));
  const read = createReportJoinReader(credentials, account, { request, spacingMs: 0 });
  await expect(read(tickets)).rejects.toThrow(/^Report join source request failed: HTTP 429$/);
  await expect(read(tickets)).rejects.toThrow("stopped");
  expect(request).toHaveBeenCalledTimes(1);
});
it("enforces shared request and account quota budgets across endpoints", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const read = createReportJoinReader(credentials, account, {
    request,
    requestBudget: 1,
    spacingMs: 0,
  });
  await read(users);
  await expect(read(tickets)).rejects.toThrow("budget");
  expect(request).toHaveBeenCalledTimes(1);
  const exhausted = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response("{}", { headers: { "ratelimit-remaining": "0", "ratelimit-reset": "300" } })
    );
  const quotaRead = createReportJoinReader(credentials, account, {
    request: exhausted,
    spacingMs: 0,
  });
  await quotaRead(tickets);
  await expect(quotaRead(deletions)).rejects.toThrow("quota exceeds");
  expect(exhausted).toHaveBeenCalledTimes(1);
});
it("rejects wrong-account credentials and sanitizes transport failure", async () => {
  expect(() => createReportJoinReader(credentials, "zendesk-account:other")).toThrow();
  const request = vi.fn<typeof fetch>().mockRejectedValue(Error("private credential"));
  await expect(
    createReportJoinReader(credentials, account, { request, spacingMs: 0 })(tickets)
  ).rejects.toThrow(/^Report join source request failed$/);
});
