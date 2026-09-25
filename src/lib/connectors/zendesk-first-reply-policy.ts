import { z } from "zod";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import type { ConnectorConfig } from "./types";

const identifier = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const identifiers = z
  .array(identifier)
  .min(1)
  .max(60)
  .refine((ids) => new Set(ids).size === ids.length);
const week = z.iso.date().refine((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0);
const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    dataSourceId: z.uuid(),
    organizationId: z.uuid(),
    accountReference: z.string(),
    reportingTimeZone: z.string().refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }),
    effectivePeriodStart: week,
    teams: z
      .array(
        z
          .object({
            teamId: z.uuid(),
            groupIds: identifiers,
            brandIds: identifiers.nullable(),
            metricKeys: z
              .array(z.enum(["avg_response_time"]))
              .min(1)
              .max(1)
              .refine((keys) => new Set(keys).size === keys.length),
          })
          .strict()
      )
      .min(1)
      .max(20)
      .refine((teams) => new Set(teams.map((t) => t.teamId)).size === teams.length),
  })
  .strict();
export type ZendeskFirstReplyPolicy = z.infer<typeof policySchema>;

/** Optional configuration is inert until a dedicated collector consumes this policy. */
export function parseZendeskFirstReplyPolicy(
  raw: string | undefined,
  configuredSubdomain: string
): ZendeskFirstReplyPolicy | null {
  if (raw === undefined || raw === "") return null;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error("Invalid First-reply source policy JSON");
  }
  const result = policySchema.safeParse(input);
  if (!result.success) throw new Error("Invalid First-reply source policy");
  const policy = result.data;
  assertZendeskAccountBinding(policy.accountReference, configuredSubdomain);
  if (policy.teams.some((team) => team.groupIds.length + (team.brandIds?.length ?? 0) >= 60))
    throw new Error("First-reply team policy leaves no employee search capacity");
  return {
    ...policy,
    reportingTimeZone: new Intl.DateTimeFormat("en", {
      timeZone: policy.reportingTimeZone,
    }).resolvedOptions().timeZone,
  };
}

/** A cutover applies prospectively; earlier intervals continue to use their recorded contract. */
export function firstReplyPolicyForPeriod(
  policy: ZendeskFirstReplyPolicy | null,
  config: ConnectorConfig,
  periodStart: string
): ZendeskFirstReplyPolicy | null {
  if (!week.safeParse(periodStart).success)
    throw new Error("First-reply requires a Sunday reporting period");
  if (!policy || policy.dataSourceId !== config.dataSourceId) return null;
  if (policy.organizationId !== config.organizationId)
    throw new Error("First-reply policy organization mismatch");
  return periodStart >= policy.effectivePeriodStart ? policy : null;
}
