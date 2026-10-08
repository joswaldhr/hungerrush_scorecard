/** Offline scheduling counterexample, not an observed scheduler run or a quota guarantee. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const configured = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const observed = JSON.parse(
  readFileSync(
    new URL("../docs/audits/2026-10-07-report-recovery-capacity.json", import.meta.url),
    "utf8"
  )
);
const schedules = configured.crons.map(({ schedule }) => {
  const [minute, hour, ...rest] = schedule.split(" ");
  assert(
    rest.every((v) => v === "*"),
    "Model only accepts daily schedules"
  );
  assert(/^\d+$/.test(minute) && /^\d+$/.test(hour));
  return { minute: Number(minute), hour: Number(hour) };
});
const occupiedHours = [...new Set(schedules.map((s) => s.hour))].sort((a, b) => a - b);
const publications = 2 * 4; // Both approved definitions, current plus three earlier weeks.
const collections = 24 / 6;
const minimumDailyWork = publications + collections;
const hobbyRemainingOpportunities = 24 - occupiedHours.length;
// Hourly jitter permits a recovery tick to arrive during the source cooldown in
// every occupied hour. Give every other tick full success: this is an optimistic
// upper bound for that admissible collision pattern, not a prediction of frequency.
assert(minimumDailyWork > hobbyRemainingOpportunities);
const observedBatchEvents = 9988;
const lateArrivalAndOverlapAllowance = 0.25; // Stress assumption, not a measured percentile.
const sixHourStressEvents = Math.ceil(observed.peakSixHours * (1 + lateArrivalAndOverlapAllowance));
const stressedCollectionBatches =
  Math.ceil(sixHourStressEvents / observedBatchEvents) * collections;
const missedWindowBatches = Math.ceil(
  (observed.peakTwelveHours * (1 + lateArrivalAndOverlapAllowance)) / observedBatchEvents
);
// A precise 15-minute scheduler has 96 opportunities. Pessimistically discard two
// around each of the 16 existing jobs and an entire six-hour scheduler outage.
// This is a planning bound; actual requests, quota, delivery and executions still
// require live measurement. Runtime remains one bounded job per invocation.
const preciseRemaining = 96 - schedules.length * 2 - 24;
const stressedDailyWork = publications + stressedCollectionBatches + missedWindowBatches;
assert(preciseRemaining > stressedDailyWork);
console.log(
  JSON.stringify(
    {
      modelVersion: 1,
      sourceEvidenceObservedAt: observed.observedAt,
      productionChanges: false,
      existingDailyJobs: schedules.length,
      occupiedHours,
      proposedHourlyHobby: {
        dailyTicks: 24,
        minimumDailyWork,
        successfulOpportunitiesInAdmissibleCollisionPattern: hobbyRemainingOpportunities,
        dailyShortfall: minimumDailyWork - hobbyRemainingOpportunities,
        qualified: false,
        reason:
          "A permitted recurring collision pattern cannot service even minimum full-horizon demand.",
      },
      stressAssumptions: {
        observedBatchEvents,
        lateArrivalAndOverlapAllowance,
        sixHourStressEvents,
        stressedCollectionBatches,
        missedWindowBatches,
        stressedDailyWork,
      },
      preciseFifteenMinuteCandidate: {
        schedule: "*/15 * * * *",
        dailyTicks: 96,
        ticksAfterModeledCollisionsAndSixHourOutage: preciseRemaining,
        modeledSpareTicks: preciseRemaining - stressedDailyWork,
        capacityArithmeticPasses: true,
        scheduledOperationVerified: false,
        availableOnCurrentHobbyPlan: false,
      },
      limits: [
        "Creation-time density does not prove source delivery timing or future quota.",
        "25 percent overlap/late-arrival allowance is an explicit stress assumption.",
        "Existing jobs conservatively treated as conflicting source work; this is not a log-derived collision count.",
        "A scheduler with adequate cadence and actual ongoing operation must be verified before activation.",
      ],
    },
    null,
    2
  )
);
