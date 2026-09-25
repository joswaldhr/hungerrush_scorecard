// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn, error: mocks.error } }));
vi.mock("@/lib/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.read }) }) }) },
}));
import { isPlatformAdmin } from "@/lib/auth/authorization";

const interrupted = () =>
  Object.assign(new Error("private SQL and user@example.test"), {
    query: "private query",
    params: ["private identity"],
    cause: Object.assign(new Error("private connection"), { code: "ECONNRESET" }),
  });
beforeEach(() => {
  vi.resetAllMocks();
});

it.each([true, false])(
  "recovers one reset with a fresh lookup and returns actual admin=%s",
  async (admin) => {
    mocks.read
      .mockRejectedValueOnce(interrupted())
      .mockResolvedValueOnce([{ isPlatformAdmin: admin }]);
    expect(await isPlatformAdmin("private@example.test")).toBe(admin);
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenCalledWith("Retrying interrupted account lookup", {
      code: "ECONNRESET",
      attempt: 1,
    });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("private");
  }
);

it("does not retry a missing/inactive account or grant access", async () => {
  mocks.read.mockResolvedValue([]);
  expect(await isPlatformAdmin("private@example.test")).toBe(false);
  expect(mocks.read).toHaveBeenCalledOnce();
});

it("fails closed after one retry and exposes no driver properties or cause", async () => {
  mocks.read.mockRejectedValue(interrupted());
  const error = await isPlatformAdmin("private@example.test").catch((error) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe("Unable to verify account access. Please retry.");
  expect(error.cause).toBeUndefined();
  expect(Object.keys(error)).toEqual([]);
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(JSON.stringify([...mocks.error.mock.calls, ...mocks.warn.mock.calls])).not.toContain(
    "private"
  );
});

it.each(["28P01", "42501", "42P01", "23505"])(
  "does not retry non-transport database failure %s",
  async (code) => {
    mocks.read.mockRejectedValue(
      Object.assign(new Error("private query"), { code, params: ["private"] })
    );
    await expect(isPlatformAdmin("private@example.test")).rejects.toThrow(
      "Unable to verify account access"
    );
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.warn).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Account lookup failed", {
      code: "unclassified",
      attempt: 1,
    });
  }
);

it("handles cyclic unknown causes without retrying or leaking them", async () => {
  const error: { cause?: unknown; message: string } = { message: "private" };
  error.cause = error;
  mocks.read.mockRejectedValue(error);
  await expect(isPlatformAdmin("private@example.test")).rejects.toThrow(
    "Unable to verify account access"
  );
  expect(mocks.read).toHaveBeenCalledOnce();
});
