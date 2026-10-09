/** Synthetic visual fixture, generated only after the isolated Preview build. Never a product route. */
import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RecoveryHealth } from "../src/lib/domain/metrics/report-recovery-health";

async function main() {
  await import("./assert-main-preview.mjs");
  // tsx's standalone JSX transform uses React; the app build uses Next's transform.
  Object.assign(globalThis, { React });
  const { ReportRecoveryHealth } = await import("../src/components/report-recovery-health");
  const { DirectoryReview } = await import("../src/components/directory-review");
  const cases = [
    ["complete", "Request completed"],
    ["queued", "Refresh pending"],
    ["deferred", "Deferred until retry"],
    ["failed", "Failed; retry pending"],
    ["interrupted", "Interrupted; awaiting retry"],
    ["running", "Running"],
    ["waiting", "Awaiting scheduler"],
    ["unknown", "Status unavailable"],
  ] as const;
  const families = [
    { team: "Synthetic support team", metric: "Tickets solved (Zendesk credit)" },
    { team: "Synthetic support team", metric: "CSAT (shared import)" },
    { team: "Synthetic support team", metric: "First reply (shared import)" },
    { team: "Shared source import", metric: "Legacy metrics (shared import)" },
  ];
  const health: RecoveryHealth = {
    state: "enabled",
    rows: cases.map(([status, label], index) => ({
      key: `synthetic-${index}`,
      ...families[index % families.length]!,
      periodStart: "2026-09-27",
      periodEnd: "2026-10-03",
      status,
      label,
      lastAttemptAt: status === "waiting" ? null : "2026-10-08T18:00:00.000Z",
      retryAt: status === "deferred" || status === "failed" ? "2026-10-08T18:15:00.000Z" : null,
    })),
  };
  const markup =
    renderToStaticMarkup(React.createElement(ReportRecoveryHealth, { health })) +
    renderToStaticMarkup(
      React.createElement(DirectoryReview, {
        review: {
          health: "failed",
          observedAt: "2026-10-08T18:00:00.000Z",
          checked: 3,
          total: 4,
          rows: [
            { employeeId: "synthetic-one", name: "Synthetic One", status: "disabled" },
            { employeeId: "synthetic-two", name: "Synthetic Two", status: "ambiguous" },
            { employeeId: "synthetic-three", name: "Synthetic Three", status: "not_found" },
            { employeeId: "synthetic-four", name: "Synthetic Four", status: "not_checked" },
          ],
        },
      })
    );
  assert(markup.includes("Request completed") && markup.includes("Interrupted; awaiting retry"));
  for (const family of families) assert(markup.includes(family.metric));
  const css = (await readdir(".next/static", { recursive: true })).filter((f) =>
    f.endsWith(".css")
  );
  assert(css.length > 0);
  await mkdir("public/__rehearsal", { recursive: true });
  await writeFile(
    "public/__rehearsal/report-recovery.html",
    `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic recovery display rehearsal</title>${css.map((f) => `<link rel="stylesheet" href="/_next/static/${f.replaceAll("\\", "/")}">`).join("")}</head><body class="bg-background text-foreground"><main class="max-w-5xl mx-auto p-6 space-y-6"><h1 class="text-xl font-semibold">Synthetic Data Health rehearsal</h1><button class="rounded border border-border p-2" onclick="document.documentElement.classList.toggle('dark')">Toggle light/dark</button>${markup}</main></body></html>`
  );
  console.log(
    "Synthetic recovery display generated; no database, vendor requests or production route."
  );
}
main().catch(() => {
  console.error("Synthetic recovery display rehearsal failed");
  process.exitCode = 1;
});
