import { env } from "@/lib/env";
import { parseZendeskFirstReplyPolicy } from "./zendesk-first-reply-policy";

export function configuredFirstReplyPolicy() {
  return parseZendeskFirstReplyPolicy(env.ZENDESK_FIRST_REPLY_POLICY, env.ZENDESK_SUBDOMAIN ?? "");
}
