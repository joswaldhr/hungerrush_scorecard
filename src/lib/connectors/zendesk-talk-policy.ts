import { z } from "zod";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import type { ConnectorConfig } from "./types";

export const inboundTalkKeys = [
  "inbound_calls_offered",
  "inbound_calls_accepted",
  "inbound_calls_abandoned_on_hold",
  "missed_calls",
  "declined_calls",
  "avg_talk_time_inbound",
  "avg_hold_time_inbound",
  "avg_call_duration_inbound",
  "avg_consultation_time_inbound",
] as const;
export const outboundTalkKeys = [
  "outbound_calls",
  "outbound_calls_completed",
  "outbound_calls_non_answered",
  "avg_talk_time_outbound",
  "avg_hold_time_outbound",
] as const;
export type InboundTalkKey = (typeof inboundTalkKeys)[number];
export type OutboundTalkKey = (typeof outboundTalkKeys)[number];

const identifiers = z
  .array(z.number().int().positive().safe())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length);
const week = z.iso.date().refine((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0);
const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    dataSourceId: z.uuid(),
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
    observationLimits: z
      .object({
        maxAgeMs: z
          .number()
          .int()
          .min(1)
          .max(26 * 3600000),
        maxSpanMs: z.number().int().min(1).max(3600000),
      })
      .strict(),
    teams: z
      .array(
        z
          .object({
            teamId: z.uuid(),
            inbound: z
              .object({
                dateBasis: z.enum(["call-created", "leg-created"]),
                groupIds: identifiers,
                phoneNumbers: z
                  .array(
                    z
                      .string()
                      .min(1)
                      .max(100)
                      .refine((s) => s.trim() === s)
                  )
                  .min(1)
                  .max(100)
                  .refine((numbers) => new Set(numbers).size === numbers.length)
                  .nullable(),
                metricKeys: z
                  .array(z.enum(inboundTalkKeys))
                  .min(1)
                  .max(inboundTalkKeys.length)
                  .refine((keys) => new Set(keys).size === keys.length),
              })
              .strict()
              .nullable(),
            outbound: z
              .object({
                dateBasis: z.literal("call-created"),
                scopeMeaning: z.literal("current-linked-ticket-group"),
                ticketGroupIds: identifiers,
                metricKeys: z
                  .array(z.enum(outboundTalkKeys))
                  .min(1)
                  .max(outboundTalkKeys.length)
                  .refine((keys) => new Set(keys).size === keys.length),
              })
              .strict()
              .nullable(),
          })
          .strict()
          .refine((t) => t.inbound !== null || t.outbound !== null)
      )
      .min(1)
      .max(20)
      .refine((teams) => new Set(teams.map((t) => t.teamId)).size === teams.length),
  })
  .strict();

export type ZendeskTalkPolicy = z.infer<typeof policySchema>;

/** Strict source policy; runtime publication additionally rejects inbound configuration. */
export function parseZendeskTalkPolicy(
  raw: string | undefined,
  configuredSubdomain: string
): ZendeskTalkPolicy | null {
  if (raw === undefined || raw === "") return null;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw Error("Invalid Talk source policy JSON");
  }
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) throw Error("Invalid Talk source policy");
  assertZendeskAccountBinding(parsed.data.accountReference, configuredSubdomain);
  return {
    ...parsed.data,
    reportingTimeZone: new Intl.DateTimeFormat("en", {
      timeZone: parsed.data.reportingTimeZone,
    }).resolvedOptions().timeZone,
  };
}

/** Prospective ownership; absent configuration cannot claim legacy observations. */
export function talkPolicyForPeriod(
  policy: ZendeskTalkPolicy | null,
  config: ConnectorConfig,
  periodStart: string
) {
  if (!week.safeParse(periodStart).success) throw Error("Talk requires a Sunday reporting period");
  if (!policy || policy.dataSourceId !== config.dataSourceId) return null;
  if (policy.organizationId !== config.organizationId)
    throw Error("Talk policy organization mismatch");
  return periodStart >= policy.effectivePeriodStart ? policy : null;
}
