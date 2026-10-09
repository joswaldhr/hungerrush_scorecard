import { createHash } from "node:crypto";
import { z } from "zod";
import type { DirectoryEmployee } from "@/lib/connectors/entra-roster";

export const DIRECTORY_RECORD = "entra_roster_check_v1";
export const directoryStateSchema = z.object({
  accountReference: z.string(),
  lastAttemptAt: z.string().datetime(),
  outcome: z.enum(["running", "completed", "failed"]),
  lease: z.object({ token: z.string().uuid(), expiresAt: z.string().datetime() }).nullable(),
  observation: z
    .object({
      observedAt: z.string().datetime(),
      members: z
        .array(
          z.object({
            employeeId: z.string().uuid(),
            identityKey: z.string(),
            status: z.enum(["enabled", "disabled", "not_found", "ambiguous", "missing_email"]),
          })
        )
        .max(100),
    })
    .nullable(),
});
export type DirectoryState = z.infer<typeof directoryStateSchema>;
export const identityKey = (employee: DirectoryEmployee) =>
  createHash("sha256")
    .update(JSON.stringify([employee.id, employee.email?.trim().toLowerCase() ?? ""]))
    .digest("hex");
export const rosterKey = (employees: DirectoryEmployee[]) =>
  createHash("sha256")
    .update(JSON.stringify(employees.map(identityKey).sort()))
    .digest("hex");

export function directoryHealth(state: DirectoryState, now: Date) {
  const observationTime = state.observation ? Date.parse(state.observation.observedAt) : null;
  if (!Number.isFinite(now.getTime()) || Date.parse(state.lastAttemptAt) > now.getTime())
    return "unavailable";
  if (observationTime !== null && observationTime > now.getTime()) return "unavailable";
  if ((state.outcome === "running") !== Boolean(state.lease)) return "unavailable";
  if (state.outcome === "failed") return "failed";
  if (state.lease)
    return Date.parse(state.lease.expiresAt) > now.getTime() ? "running" : "interrupted";
  if (observationTime === null) return "unavailable";
  return now.getTime() - observationTime > 36 * 3600000 ? "stale" : "current";
}
