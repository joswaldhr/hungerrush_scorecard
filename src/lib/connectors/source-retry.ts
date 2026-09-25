/** A resumable worker should persist this delay and return, rather than sleep. */
export class SourceRetryLaterError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Source rate limit requires a later attempt");
    this.name = "SourceRetryLaterError";
    if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) throw new Error("Invalid retry delay");
  }
}
