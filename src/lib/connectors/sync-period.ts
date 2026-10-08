import { z } from "zod";
import { weekBoundsForDate } from "@/lib/utils";

const periodSchema = z.object({ periodStart: z.iso.date(), periodEnd: z.iso.date() }).strict();
export type SyncPeriod = z.infer<typeof periodSchema>;

/** Validate an immutable UTC Sunday–Saturday selection; vendor timezones stay separate. */
export function parseSyncPeriod(input: unknown, now = new Date()): SyncPeriod {
  const period = periodSchema.parse(input);
  const bounds = weekBoundsForDate(period.periodStart);
  if (
    bounds.periodStart !== period.periodStart ||
    bounds.periodEnd !== period.periodEnd ||
    period.periodStart > weekBoundsForDate(now.toISOString().slice(0, 10)).periodStart
  )
    throw Error("Sync period must be a current or completed Sunday–Saturday week");
  return Object.freeze(period);
}
