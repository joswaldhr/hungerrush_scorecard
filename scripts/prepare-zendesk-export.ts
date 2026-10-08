/** Offline only: reads a private normalized manifest; has no database/vendor access. */
import fs from "node:fs";
import path from "node:path";
import { prepareZendeskExport } from "../src/lib/connectors/zendesk-export-intake";
const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output))
  throw Error(
    "Usage: prepare-zendesk-export.ts <private-manifest.json> <new-private-candidate.json>"
  );
const result = prepareZendeskExport(JSON.parse(fs.readFileSync(input, "utf8")));
fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: "wx" });
console.log(
  JSON.stringify({
    publicationEligible: false,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    values: result.values.length,
    zeroValues: result.values.filter((v) => v.value === 0).length,
    blankValues: result.values.filter((v) => v.value === null).length,
    coverage: result.coverage,
  })
);
