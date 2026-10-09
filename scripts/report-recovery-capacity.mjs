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
const recoveryCrons = configured.crons.filter(({ path }) =>
  path.startsWith("/api/cron/report-recovery")
);
assert(recoveryCrons.length <= 1, "Only one recovery dispatcher schedule is supported");
for (const cron of recoveryCrons) {
  assert.equal(cron.path, "/api/cron/report-recovery?slot=0");
  assert.equal(cron.schedule, "*/15 * * * *");
}
const schedules = configured.crons
  .filter(({ path }) => !path.startsWith("/api/cron/report-recovery"))
  .flatMap(({ schedule }) => {
    const [minute, hour, ...rest] = schedule.split(" ");
    assert(
      rest.every((v) => v === "*"),
      "Model only accepts daily schedules"
    );
    assert(/^\d+$/.test(minute) && (/^\d+$/.test(hour) || hour === "*/6"));
    return (hour === "*/6" ? [0, 6, 12, 18] : [Number(hour)]).map((h) => ({ minute: Number(minute), hour: h }));
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
// around each existing invocation (including directory's four daily slots)
// and an entire six-hour scheduler outage.
// This is a planning bound; actual requests, quota, delivery and executions still
// require live measurement. Runtime remains one bounded job per invocation.
const preciseRemaining = 96 - schedules.length * 2 - 24;
const stressedDailyWork = publications + stressedCollectionBatches + missedWindowBatches;
assert(preciseRemaining > stressedDailyWork);
// CSAT is a separate opt-in: include its four fixed-period publications before
// enabling it. This does not model unimplemented recovery for other families.
const csatPublications = 4;
const stressedDailyWorkWithCsat = stressedDailyWork + csatPublications;
assert(preciseRemaining > stressedDailyWorkWithCsat);
// Legacy recovery still runs one fixed week per tick. Conservatively keep its
// former cron slots in the collision allowance even when they only enqueue.
const legacyPublications = 4;
const stressedDailyWorkWithLegacy = stressedDailyWorkWithCsat + legacyPublications;
assert(preciseRemaining > stressedDailyWorkWithLegacy);
console.log(
  JSON.stringify(
    {
      modelVersion: 3,
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
        path: "/api/cron/report-recovery?slot=0",
        schedule: "*/15 * * * *",
        dailyTicks: 96,
        ticksAfterModeledCollisionsAndSixHourOutage: preciseRemaining,
        modeledSpareTicks: preciseRemaining - stressedDailyWork,
        capacityArithmeticPasses: true,
        scheduledOperationVerified: false,
        requiresPreciseSchedulerPlan: true,
      },
      optionalCsatRecovery: {
        additionalDailyPublications: csatPublications,
        stressedDailyWork: stressedDailyWorkWithCsat,
        modeledSpareTicks: preciseRemaining - stressedDailyWorkWithCsat,
        capacityArithmeticPasses: true,
        activationVerified: false,
      },
      optionalLegacyRecoveryWithCsat: {
        additionalDailyPublications: legacyPublications,
        stressedDailyWork: stressedDailyWorkWithLegacy,
        modeledSpareTicks: preciseRemaining - stressedDailyWorkWithLegacy,
        capacityArithmeticPasses: true,
        activationVerified: false,
      },
      limits: [
        "A 15-minute wake-up is not a promise that every metric refreshes every 15 minutes.",
        "This model covers report-event collection, solved credits, optional CSAT and legacy weekly sync recovery; it does not qualify outbound or first-reply recurrence.",
        "Four legacy attempts is a lower bound: multiple retained Talk pages or repeated throttling require extra ticks; measured invocation duration and recovery still gate activation.",
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
