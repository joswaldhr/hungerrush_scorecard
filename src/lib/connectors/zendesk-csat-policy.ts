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
              .array(z.enum(["csat_score", "csat_response_rate"]))
              .min(1)
              .max(2)
              .refine((keys) => new Set(keys).size === keys.length),
          })
          .strict()
      )
      .min(1)
      .max(20)
      .refine((teams) => new Set(teams.map((t) => t.teamId)).size === teams.length),
  })
  .strict();
export type ZendeskCsatPolicy = z.infer<typeof policySchema>;

/** Optional configuration is inert until a dedicated collector consumes this policy. */
export function parseZendeskCsatPolicy(
  raw: string | undefined,
  configuredSubdomain: string
): ZendeskCsatPolicy | null {
  if (raw === undefined || raw === "") return null;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error("Invalid CSAT source policy JSON");
  }
  const result = policySchema.safeParse(input);
  if (!result.success) throw new Error("Invalid CSAT source policy");
  const policy = result.data;
  assertZendeskAccountBinding(policy.accountReference, configuredSubdomain);
  if (policy.teams.some((team) => team.groupIds.length + (team.brandIds?.length ?? 0) >= 60))
    throw new Error("CSAT team policy leaves no employee search capacity");
  return {
    ...policy,
    reportingTimeZone: new Intl.DateTimeFormat("en", {
      timeZone: policy.reportingTimeZone,
    }).resolvedOptions().timeZone,
  };
}

/** A cutover applies prospectively; earlier intervals continue to use their recorded contract. */
export function csatPolicyForPeriod(
  policy: ZendeskCsatPolicy | null,
  config: ConnectorConfig,
  periodStart: string
): ZendeskCsatPolicy | null {
  if (!week.safeParse(periodStart).success)
    throw new Error("CSAT requires a Sunday reporting period");
  if (!policy || policy.dataSourceId !== config.dataSourceId) return null;
  if (policy.organizationId !== config.organizationId)
    throw new Error("CSAT policy organization mismatch");
  return periodStart >= policy.effectivePeriodStart ? policy : null;
}
