import { z } from "zod";
import { safeErrorMessage } from "@/lib/error-summary";

const count = z.number().int().nonnegative().safe();
const diagnosticsSchema = z.object({
  family: z.enum(["csat", "legacy_talk"]),
  requests: count,
  elapsedMs: count,
  requestBudget: count.optional(),
  elapsedBudgetMs: count,
  rateLimitRetries: count.optional(),
  backoffWaitMs: count.optional(),
  pacingWaitMs: count.optional(),
  endpoint: z.enum(["users", "search/export", "tickets/show_many", "calls"]).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  retryAfterMs: count.nullable().optional(),
  retryStoppedBy: z
    .enum([
      "disabled",
      "invalid_delay",
      "delay_too_long",
      "retry_allowance",
      "request_budget",
      "time_budget",
    ])
    .optional(),
});

/** Only bounded operational fields may survive a failed source fetch. */
export class SourceFetchError extends Error {
  readonly diagnostics: z.infer<typeof diagnosticsSchema>;
  constructor(error: unknown, diagnostics: z.infer<typeof diagnosticsSchema>) {
    super(safeErrorMessage(error));
    this.name = "SourceFetchError";
    this.diagnostics = diagnosticsSchema.parse(diagnostics);
  }
}

export function sourceFailureDiagnostics(error: unknown) {
  if (!(error instanceof SourceFetchError)) return undefined;
  const parsed = diagnosticsSchema.safeParse(error.diagnostics);
  return parsed.success ? parsed.data : undefined;
}
