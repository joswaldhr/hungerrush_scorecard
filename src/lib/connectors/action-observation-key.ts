import { z } from "zod";

/** Explicit re-observations never overwrite the initial fixed interval. */
export function actionObservationKey(start: string, endExclusive: string, observationId?: string) {
  const interval = `${start}/${endExclusive}`;
  return observationId === undefined
    ? interval
    : `${interval}/observation/${z.string().uuid().parse(observationId)}`;
}
