import { runSync } from "@/lib/connectors/sync-engine";
import { ZendeskConnector } from "@/lib/connectors/zendesk";

const ORG_ID = "10000000-0000-4000-8000-000000000001";
const DS = {
  zendesk: "50000000-0000-4000-8000-000000000001",
};

async function main() {
  console.log("Running live Zendesk sync...");
  const zendeskResult = await runSync(new ZendeskConnector(), {
    dataSourceId: DS.zendesk,
    organizationId: ORG_ID,
  });
  console.log("Zendesk:", zendeskResult);

  if (!zendeskResult.success) throw new Error("Zendesk sync failed");
  console.log(`Wrote ${zendeskResult.valuesWritten} metric values`);
}

main().catch((err) => {
  console.error("Live sync failed:", err);
  process.exit(1);
});
