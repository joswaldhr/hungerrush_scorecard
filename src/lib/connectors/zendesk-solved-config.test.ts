// @vitest-environment node
import { expect, it } from "vitest";
import {
  parseReportEventCollectionPolicy,
  parseSolvedReportReleases,
} from "./zendesk-solved-config";
const id = "00000000-0000-4000-8000-000000000001";
const collection = {
  schemaVersion: 1,
  organizationId: id,
  dataSourceId: id,
  accountReference: "zendesk-account:synthetic",
  bootstrapDate: "2026-09-27",
};
const release = {
  kind: "updater",
  organizationId: id,
  dataSourceId: id,
  teamId: id,
  accountReference: "zendesk-account:synthetic",
  subdomain: "synthetic",
  timeZone: "America/Chicago",
  groupIds: [10],
  brandIds: null,
  effectivePeriodStart: "2026-09-27",
  maxObservationAgeSeconds: 3600,
  releaseEvidenceSha256: "a".repeat(64),
};
it("keeps collection and publication independently absent until explicitly configured", () => {
  expect(parseReportEventCollectionPolicy(undefined, "")).toBeNull();
  expect(parseSolvedReportReleases(undefined, "")).toEqual([]);
  expect(
    parseReportEventCollectionPolicy(
      JSON.stringify(collection),
      "synthetic",
      Date.parse("2026-10-07")
    )?.bootstrapStart
  ).toBe(Date.parse("2026-09-27") / 1000);
  expect(parseSolvedReportReleases(JSON.stringify([release]), "synthetic")).toHaveLength(1);
});
it("rejects malformed, foreign, duplicate and ambiguous release configurations", () => {
  for (const input of [
    "{",
    JSON.stringify([]),
    JSON.stringify([release, release]),
    JSON.stringify([{ ...release, kind: "human" }]),
    JSON.stringify([{ ...release, effectivePeriodStart: "2026-09-28" }]),
    JSON.stringify([{ ...release, extra: true }]),
  ])
    expect(() => parseSolvedReportReleases(input, "synthetic")).toThrow();
  expect(() => parseSolvedReportReleases(JSON.stringify([release]), "other")).toThrow();
});
it("rejects future collection starts and hidden activation controls", () => {
  for (const input of [
    { ...collection, bootstrapDate: "2026-10-07" },
    { ...collection, publish: true },
    { ...collection, schemaVersion: 2 },
  ])
    expect(() =>
      parseReportEventCollectionPolicy(JSON.stringify(input), "synthetic", Date.parse("2026-10-07"))
    ).toThrow();
  expect(() => parseReportEventCollectionPolicy(JSON.stringify(collection), "other")).toThrow();
});
