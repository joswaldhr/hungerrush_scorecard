import { expect, it } from "vitest";
import {
  assertZendeskAccountBinding,
  zendeskAccountReference,
} from "@/lib/connectors/zendesk-account-binding";

it("requires an exact explicit source account, without guessing from names", () => {
  expect(assertZendeskAccountBinding("zendesk-account:synthetic-1", "synthetic-1")).toBe(
    "zendesk-account:synthetic-1"
  );
  expect(() => assertZendeskAccountBinding(null, "synthetic-1")).toThrow("binding");
  expect(() => assertZendeskAccountBinding("zendesk-account:another", "synthetic-1")).toThrow(
    "binding"
  );
});
it.each([
  "",
  "another.zendesk.com",
  "another/path",
  "user@another",
  " another",
  "another?x=y",
  "-another",
  "another-",
  "a".repeat(64),
])("rejects malformed account subdomain %s", (subdomain) => {
  expect(() => zendeskAccountReference(subdomain)).toThrow("subdomain");
});
