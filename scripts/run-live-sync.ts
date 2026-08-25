import { runSync } from "@/lib/connectors/sync-engine";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { AssembledConnector } from "@/lib/connectors/assembled";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";

const ORG_ID = "10000000-0000-4000-8000-000000000001";
const DS = {
  zendesk: "50000000-0000-4000-8000-000000000001",
  assembled: "50000000-0000-4000-8000-000000000002",
};

async function main() {
  console.log("Running live Zendesk sync...");
  const zendeskResult = await runSync(new ZendeskConnector(), {
    dataSourceId: DS.zendesk,
    organizationId: ORG_ID,
  });
  console.log("Zendesk:", zendeskResult);

  console.log("Running live Assembled sync...");
  const assembledResult = await runSync(new AssembledConnector(), {
    dataSourceId: DS.assembled,
    organizationId: ORG_ID,
  });
  console.log("Assembled:", assembledResult);

  console.log("Computing metric values from normalized facts...");
  const zendeskValues = await computeMetricValuesFromFacts(ORG_ID, "zendesk");
  const assembledValues = await computeMetricValuesFromFacts(ORG_ID, "assembled");
  console.log(
    `Wrote ${zendeskValues} zendesk-sourced + ${assembledValues} assembled-sourced metric values`
  );
}

main().catch((err) => {
  console.error("Live sync failed:", err);
  process.exit(1);
});
