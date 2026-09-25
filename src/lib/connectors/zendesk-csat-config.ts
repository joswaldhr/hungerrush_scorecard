import { env } from "@/lib/env";
import { parseZendeskCsatPolicy } from "./zendesk-csat-policy";

export function configuredCsatPolicy() {
  return parseZendeskCsatPolicy(env.ZENDESK_CSAT_POLICY, env.ZENDESK_SUBDOMAIN ?? "");
}
