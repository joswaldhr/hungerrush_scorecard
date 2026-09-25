import { createHash } from "node:crypto";
import { z } from "zod";

/** Offline-only interval; preserve daily fixture IDs and isolate multi-day observations. */
export function actionRehearsalScope(day: string, inclusiveEndDay = day, now = Date.now()) {
  z.iso.date().parse(day);
  z.iso.date().parse(inclusiveEndDay);
  const start = new Date(`${day}T00:00:00Z`);
  const endExclusive = new Date(Date.parse(`${inclusiveEndDay}T00:00:00Z`) + 86_400_000);
  const days = (endExclusive.getTime() - start.getTime()) / 86_400_000;
  if (days < 1 || days > 7 || endExclusive.getTime() > now - 120_000)
    throw new Error("Require one to seven closed days");
  const key = day === inclusiveEndDay ? day : `${day}/${inclusiveEndDay}`;
  const id = (kind: string) => {
    const hex = createHash("sha256").update(`local-action-rehearsal:${key}:${kind}`).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
  return {
    start,
    endExclusive,
    days,
    organizationId: id("organization"),
    dataSourceId: id("source"),
  };
}
