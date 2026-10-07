// @vitest-environment node
import { describe, expect, it } from "vitest";
import { planBaselineAdoption } from "../../scripts/migration-baseline";

const entries = ["0008_previous", "0009_fact_identity", "0010_next"].map((tag, index) => ({
  tag,
  when: 100 + index,
  lfHash: `lf-${index}`,
  crlfHash: `crlf-${index}`,
}));
const applied = entries.map((entry) => ({ hash: entry.lfHash, created_at: entry.when }));
describe("known fact-identity baseline adoption", () => {
  it("recognizes only the documented missing middle entry", () => {
    expect(planBaselineAdoption(entries, [applied[0]!, applied[2]!])).toEqual(entries[1]);
  });
  it("accepts known Windows hashes without rewriting them", () => {
    expect(
      planBaselineAdoption(
        entries,
        applied.map((row, index) => ({
          ...row,
          hash: entries[index]!.crlfHash,
        }))
      )
    ).toBeNull();
  });
  it("does not adopt a legitimately pending migration", () => {
    expect(planBaselineAdoption(entries, [applied[0]!])).toBeNull();
  });
  it("rejects unknown hashes, timestamps and duplicates", () => {
    for (const rows of [
      [{ ...applied[0]!, hash: "changed" }],
      [{ ...applied[0]!, created_at: 999 }],
      [applied[0]!, applied[0]!],
    ])
      expect(() => planBaselineAdoption(entries, rows)).toThrow();
  });
  it("rejects any other missing baseline or multiple gaps", () => {
    expect(() => planBaselineAdoption(entries, [applied[1]!, applied[2]!])).toThrow();
    expect(() => planBaselineAdoption(entries, [applied[2]!])).toThrow();
  });
  it("rejects empty or ambiguous candidate inventories", () => {
    expect(() => planBaselineAdoption(entries, [])).toThrow();
    expect(() => planBaselineAdoption([...entries, entries[0]!], applied)).toThrow();
  });
});
