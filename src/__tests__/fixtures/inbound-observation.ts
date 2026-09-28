import { outboundObservationFixture } from "./outbound-observation";
import { inboundTalkKeys } from "@/lib/connectors/zendesk-talk-policy";

export function inboundObservationFixture(...args: Parameters<typeof outboundObservationFixture>) {
  const f = outboundObservationFixture(...args);
  f.policy.teams[0]!.outbound = null;
  f.policy.teams[0]!.inbound = {
    scopeMeaning: "current-parent-call-group-and-number",
    dateBasis: "call-created",
    offeredDefinition: "accepted-declined-missed-unreachable",
    legCompletionStatuses: null,
    groupIds: [99],
    phoneNumbers: ["synthetic-line"],
    metricKeys: [...inboundTalkKeys],
  };
  f.snapshot.calls.forEach((c) => {
    c.direction = "inbound";
    c.phone_number = "synthetic-line";
  });
  f.snapshot.calls[1]!.completion_status = "abandoned_on_hold";
  // Two accepted legs, one missed leg with reported zero, and one other employee.
  f.snapshot.legs[2]!.completion_status = "agent_missed";
  f.snapshot.legs.push({
    ...f.snapshot.legs[2]!,
    id: 5,
    completion_status: "agent_unreachable",
    talk_time: 900,
  });
  return f;
}
