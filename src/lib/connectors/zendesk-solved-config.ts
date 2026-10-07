import { z } from "zod";
import { env } from "@/lib/env";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { parseSolvedRelease } from "./zendesk-solved-publication-record";
const collectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    dataSourceId: z.uuid(),
    accountReference: z.string(),
    bootstrapDate: z.iso.date(),
  })
  .strict();
function parseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw Error("Invalid solved-report configuration JSON");
  }
}
export function parseReportEventCollectionPolicy(
  raw: string | undefined,
  subdomain: string,
  now = Date.now()
) {
  if (!raw) return null;
  const result = collectionSchema.safeParse(parseJson(raw));
  if (!result.success) throw Error("Invalid report-event collection policy");
  const { organizationId, dataSourceId, accountReference, bootstrapDate } = result.data;
  assertZendeskAccountBinding(accountReference, subdomain);
  const bootstrapStart = Date.parse(`${bootstrapDate}T00:00:00Z`) / 1000;
  if (bootstrapStart < 0 || bootstrapStart > Math.floor(now / 1000) - 120)
    throw Error("Report-event bootstrap must precede source cutoff");
  return { scope: { organizationId, dataSourceId, accountReference }, bootstrapStart };
}
export function parseSolvedReportReleases(raw: string | undefined, subdomain: string) {
  if (!raw) return [];
  const items = z.array(z.unknown()).min(1).max(2).parse(parseJson(raw));
  const releases = items.map(parseSolvedRelease);
  if (
    new Set(releases.map((p) => p.kind)).size !== releases.length ||
    new Set(releases.map((p) => p.teamId)).size !== releases.length
  )
    throw Error("Duplicate solved-report release scope");
  for (const policy of releases) assertZendeskAccountBinding(policy.accountReference, subdomain);
  return releases;
}
export function configuredReportEventCollectionPolicy() {
  return parseReportEventCollectionPolicy(
    env.ZENDESK_REPORT_EVENT_COLLECTION_POLICY,
    env.ZENDESK_SUBDOMAIN ?? ""
  );
}
export function configuredSolvedReportReleases() {
  return parseSolvedReportReleases(env.ZENDESK_SOLVED_REPORT_RELEASES, env.ZENDESK_SUBDOMAIN ?? "");
}
