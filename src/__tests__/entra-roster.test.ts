// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { readEntraRoster } from "@/lib/connectors/entra-roster";

const credentials = {
  tenantId: randomUUID(),
  clientId: randomUUID(),
  clientSecret: "synthetic-secret",
};
const employee = { id: randomUUID(), email: "person@example.invalid" };
const user = {
  id: randomUUID(),
  mail: employee.email,
  userPrincipalName: employee.email,
  accountEnabled: false,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const reader = (pages: unknown[]) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: "synthetic-token" }))
    .mockImplementation(async () => json(pages.shift()));

it("reads exact email/UPN account state without inferring employment or changing the directory", async () => {
  const fetcher = reader([{ value: [user] }]);
  expect(await readEntraRoster([employee], credentials, fetcher)).toEqual([
    { employeeId: employee.id, status: "disabled" },
  ]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [url, options] = fetcher.mock.calls[1]!;
  expect(new URL(String(url)).origin).toBe("https://graph.microsoft.com");
  expect(new URL(String(url)).searchParams.get("$select")).toBe(
    "id,mail,userPrincipalName,accountEnabled"
  );
  expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
  expect(fetcher.mock.calls[0]![1]?.signal).toBe(options?.signal);
});
it("separates missing, ambiguous and enabled matches", async () => {
  expect((await readEntraRoster([employee], credentials, reader([{ value: [] }])))[0]!.status).toBe(
    "not_found"
  );
  expect(
    (
      await readEntraRoster(
        [employee],
        credentials,
        reader([{ value: [user, { ...user, id: randomUUID() }] }])
      )
    )[0]!.status
  ).toBe("ambiguous");
  expect(
    (
      await readEntraRoster(
        [employee],
        credentials,
        reader([{ value: [{ ...user, mail: null, accountEnabled: true }] }])
      )
    )[0]!.status
  ).toBe("enabled");
  expect(
    (await readEntraRoster([{ ...employee, email: null }], credentials, reader([])))[0]!.status
  ).toBe("missing_email");
});
it("does not map one account to two employee identities", async () => {
  const second = { id: randomUUID(), email: "alias@example.invalid" };
  const results = await readEntraRoster(
    [employee, second],
    credentials,
    reader([{ value: [{ ...user, userPrincipalName: second.email }] }])
  );
  expect(results.every((r) => r.status === "ambiguous")).toBe(true);
});
it.each([
  { value: [user], "@odata.nextLink": "https://foreign.invalid/steal" },
  { value: [{ ...user, accountEnabled: undefined }] },
  {
    value: [{ ...user, mail: "other@example.invalid", userPrincipalName: "other@example.invalid" }],
  },
])("fails the observation for truncated, malformed or out-of-scope evidence", async (page) => {
  const fetcher = reader([page]);
  await expect(readEntraRoster([employee], credentials, fetcher)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("stops on throttling without retries, partial success or source error leakage", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json({ access_token: "synthetic-token" }))
    .mockResolvedValueOnce(json({ error: "private source payload" }, 429));
  await expect(readEntraRoster([employee], credentials, fetcher)).rejects.toThrow(
    "Directory read failed"
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("bounds the cohort before authentication and rejects invalid tenant paths", async () => {
  const fetcher = vi.fn<typeof fetch>();
  await expect(
    readEntraRoster(
      Array.from({ length: 101 }, () => ({ id: randomUUID(), email: employee.email })),
      credentials,
      fetcher
    )
  ).rejects.toThrow();
  await expect(
    readEntraRoster([employee], { ...credentials, tenantId: "../other" }, fetcher)
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("escapes OData strings and splits the 100-person cap into fifteen bounded queries", async () => {
  const members = Array.from({ length: 100 }, (_, i) => ({
    id: randomUUID(),
    email: `person${i}'x@example.invalid`,
  }));
  const fetcher = reader(Array.from({ length: 15 }, () => ({ value: [] })));
  await readEntraRoster(members, credentials, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(16);
  expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("$filter")).toContain(
    "person0''x@example.invalid"
  );
});
