import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DirectoryReview } from "@/components/directory-review";
import type { DirectoryReview as Review } from "@/lib/domain/roster/directory-check";
const base: Review = {
  health: "current",
  observedAt: "2026-10-08T18:00:00.000Z",
  checked: 1,
  total: 1,
  rows: [],
};
it("reports account-check coverage without presenting it as employment certification", () => {
  const html = renderToStaticMarkup(<DirectoryReview review={base} />);
  expect(html).toContain("1 of 1 current employee identities checked");
  expect(html).toContain("not proof of employment");
  expect(html).toContain("2026-10-08 18:00:00 UTC");
  expect(html).toContain("No directory account conflicts found");
  expect(html).not.toContain("<button");
});
it.each([
  "failed",
  "stale",
  "running",
  "interrupted",
  "unavailable",
  "not_checked",
  "not_configured",
] as const)("never shows an all-clear for %s", (health) => {
  const html = renderToStaticMarkup(<DirectoryReview review={{ ...base, health }} />);
  expect(html).not.toContain("No directory account conflicts found");
});
it("keeps prior conflicts visible on failure and provides review guidance", () => {
  const html = renderToStaticMarkup(
    <DirectoryReview
      review={{
        ...base,
        health: "failed",
        rows: [{ employeeId: "synthetic", name: "Synthetic Person", status: "disabled" }],
      }}
    />
  );
  expect(html).toContain("previous observation");
  expect(html).toContain("Synthetic Person");
  expect(html).toContain("confirm team membership");
});
