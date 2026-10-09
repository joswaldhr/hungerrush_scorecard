import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Call only after actual publication (and durable acknowledgment when queued). */
export async function pingSyncHeartbeat() {
  if (!env.SYNC_HEARTBEAT_URL) return;
  try {
    await fetch(env.SYNC_HEARTBEAT_URL, { method: "GET", signal: AbortSignal.timeout(5000) });
  } catch (error) {
    logger.warn("Sync heartbeat ping failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
