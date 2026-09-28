import { z } from "zod";
import { env } from "@/lib/env";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { parseZendeskTalkPolicy } from "./zendesk-talk-policy";

const collectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    dataSourceId: z.uuid(),
    accountReference: z.string(),
    // Fixed UTC day retained across resumptions. Collection alone never publishes metrics.
    bootstrapDate: z.iso.date(),
  })
  .strict();

export function parseTalkCollectionPolicy(
  raw: string | undefined,
  subdomain: string,
  now = Date.now()
) {
  if (!raw) return null;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw Error("Invalid Talk collection policy JSON");
  }
  const result = collectionSchema.safeParse(input);
  if (!result.success) throw Error("Invalid Talk collection policy");
  assertZendeskAccountBinding(result.data.accountReference, subdomain);
  const bootstrapStart = Date.parse(`${result.data.bootstrapDate}T00:00:00Z`) / 1000;
  if (bootstrapStart < 0 || bootstrapStart > Math.floor(now / 1000) - 120)
    throw Error("Talk bootstrap must precede the source cutoff");
  const { organizationId, dataSourceId, accountReference } = result.data;
  return { scope: { organizationId, dataSourceId, accountReference }, bootstrapStart };
}

export function configuredTalkCollectionPolicy() {
  return parseTalkCollectionPolicy(env.ZENDESK_TALK_COLLECTION_POLICY, env.ZENDESK_SUBDOMAIN ?? "");
}

export function configuredOutboundPolicy() {
  const policy = parseZendeskTalkPolicy(env.ZENDESK_OUTBOUND_POLICY, env.ZENDESK_SUBDOMAIN ?? "");
  if (policy?.teams.some((team) => team.inbound !== null || team.outbound === null))
    throw Error("Outbound publisher requires an exclusively outbound policy");
  return policy;
}
