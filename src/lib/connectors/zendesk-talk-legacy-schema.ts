import { z } from "zod";

// A separate storage contract: the participation call schema deliberately omits
// whole-call attribution and average-duration inputs consumed by the legacy job.
const seconds = z.number().finite().nonnegative().nullable().optional();
export const legacyTalkCallSchema = z.object({
  id: z.number().int().positive().safe(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  agent_id: z.number().int().positive().safe().nullable().optional(),
  direction: z.string().min(1).max(80),
  completion_status: z.string().min(1).max(80),
  duration: seconds,
  talk_time: seconds,
  hold_time: seconds,
  consultation_time: seconds,
});
export type LegacyTalkCall = z.infer<typeof legacyTalkCallSchema>;
