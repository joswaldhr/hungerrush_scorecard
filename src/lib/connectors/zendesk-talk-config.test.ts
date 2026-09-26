// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { outboundObservationFixture } from "@/__tests__/fixtures/outbound-observation";
const runtime = vi.hoisted(() => ({
  ZENDESK_SUBDOMAIN: "synthetic",
  ZENDESK_TALK_COLLECTION_POLICY: undefined as string | undefined,
  ZENDESK_OUTBOUND_POLICY: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env: runtime }));
import {
  configuredOutboundPolicy,
  configuredTalkCollectionPolicy,
  parseTalkCollectionPolicy,
} from "./zendesk-talk-config";
const collection = {
  schemaVersion: 1,
  organizationId: "00000000-0000-4000-8000-000000000001",
  dataSourceId: "00000000-0000-4000-8000-000000000002",
  accountReference: "zendesk-account:synthetic",
  bootstrapDate: "2026-09-19",
};
const now = Date.parse("2026-09-25T12:00:00Z");
const parse = (value: unknown) =>
  parseTalkCollectionPolicy(JSON.stringify(value), "synthetic", now);
afterEach(() => {
  runtime.ZENDESK_TALK_COLLECTION_POLICY = undefined;
  runtime.ZENDESK_OUTBOUND_POLICY = undefined;
});
it("binds collection to one account/source and fixes the bootstrap across resumptions", () => {
  expect(parse(collection)).toEqual({
    scope: {
      organizationId: collection.organizationId,
      dataSourceId: collection.dataSourceId,
      accountReference: collection.accountReference,
    },
    bootstrapStart: Date.parse("2026-09-19T00:00:00Z") / 1000,
  });
  expect(() => parse({ ...collection, accountReference: "zendesk-account:other" })).toThrow(
    /binding/
  );
  expect(() => parse({ ...collection, dataSourceId: "bad" })).toThrow();
  expect(() => parse({ ...collection, bootstrapDate: "2026-09-26" })).toThrow(/cutoff/);
  expect(() => parse({ ...collection, bootstrapDate: "1969-12-31" })).toThrow(/cutoff/);
  expect(() => parse({ ...collection, bootstrapDate: "2026-02-30" })).toThrow();
  expect(() => parse({ ...collection, publish: true })).toThrow();
  expect(() => parseTalkCollectionPolicy("bad", "synthetic", now)).toThrow(/JSON/);
});
it("keeps collection and publication independent and rejects mixed metric families", () => {
  expect(configuredTalkCollectionPolicy()).toBeNull();
  expect(configuredOutboundPolicy()).toBeNull();
  runtime.ZENDESK_TALK_COLLECTION_POLICY = JSON.stringify(collection);
  expect(configuredTalkCollectionPolicy()).not.toBeNull();
  expect(configuredOutboundPolicy()).toBeNull();
  runtime.ZENDESK_TALK_COLLECTION_POLICY = undefined;
  const { policy } = outboundObservationFixture();
  runtime.ZENDESK_OUTBOUND_POLICY = JSON.stringify(policy);
  expect(configuredOutboundPolicy()).toEqual(policy);
  expect(configuredTalkCollectionPolicy()).toBeNull();
  runtime.ZENDESK_OUTBOUND_POLICY = JSON.stringify({
    ...policy,
    teams: policy.teams.map((t) => ({
      ...t,
      inbound: {
        dateBasis: "call-created",
        groupIds: [7],
        phoneNumbers: null,
        metricKeys: ["missed_calls"],
      },
    })),
  });
  expect(() => configuredOutboundPolicy()).toThrow(/exclusively outbound/);
});
