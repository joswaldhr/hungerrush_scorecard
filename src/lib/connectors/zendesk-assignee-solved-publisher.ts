import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { fetchAssigneeSolvedReportCandidate } from "./zendesk-assignee-solved-collector";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { createSolvedPublisher } from "./zendesk-solved-publisher";
import { parseSolvedRelease, type SolvedRelease } from "./zendesk-solved-publication-record";

/** GET-only live collector wired to the same atomic publisher used by rehearsal. */
export function createLiveAssigneeSolvedPublisher(
  input: SolvedRelease,
  credentials: { subdomain: string; email: string; apiKey: string }
) {
  const policy = parseSolvedRelease(input);
  if (policy.kind !== "assignee-solved")
    throw Error("Assignee collector cannot publish updater credits");
  assertZendeskAccountBinding(policy.accountReference, credentials.subdomain);
  return createSolvedPublisher(policy, async (_config, periodStart, periodEnd, externalIds) => {
    const observationStartedAt = new Date().toISOString();
    // One bounded transport covers staff census, search pagination and parent joins.
    const reader = createBoundedCsatReader(credentials, {
      elapsedMs: 240000,
      requestBudget: 100,
      spacingMs: 1000,
    });
    const { identities } = await resolveCsatStaffIdentities(externalIds, reader.read);
    const snapshot = await fetchAssigneeSolvedReportCandidate(
      {
        periodStart,
        periodEnd,
        timeZone: policy.timeZone,
        agentIds: [...identities.values()],
        groupIds: policy.groupIds,
        brandIds: policy.brandIds,
        dateBasis: "latest-solved",
        attribution: "current-assignee",
      },
      reader.read,
      { requestBudget: 80, allowCurrentPeriod: true }
    );
    return { snapshot, identities, observationStartedAt };
  });
}
