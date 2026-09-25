import { z } from "zod";

/** Keep legacy reporting intervals intact; require real, ordered calendar dates. */
export const reconciliationRequestSchema = z
  .object({
    teamId: z.uuid().optional(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    thresholdPct: z.number().finite().min(0).max(100).optional(),
  })
  .refine((request) => request.periodStart <= request.periodEnd, {
    path: ["periodEnd"],
    message: "Period end must be on or after period start",
  });
