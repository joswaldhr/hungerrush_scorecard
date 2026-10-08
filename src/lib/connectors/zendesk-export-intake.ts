import { createHash } from "node:crypto";
import { z } from "zod";

export const EXPORT_CANDIDATE_CONTRACT = "zendesk-explore-export-candidate-v1";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z
  .object({
    organizationId: z.uuid(),
    teamId: z.uuid(),
    accountReference: z.literal("zendesk:hungerrush"),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    timeZone: z.literal("America/Chicago"),
    observedAt: z.iso.datetime({ offset: true }),
    archiveSha256: sha,
    // A file name / download date is never evidence of its reporting period.
    viewerEvidenceSha256: sha,
    reports: z
      .array(
        z
          .object({
            kind: z.enum([
              "menufy-updates",
              "menufy-inbound",
              "menufy-outbound",
              "menufy-csat",
              "menufy-state",
            ]),
            fileSha256: sha,
            scopeEvidenceSha256: sha,
            headers: z.array(z.string()),
            rows: z.array(z.array(z.string().max(1000))).max(49999),
          })
          .strict()
      )
      .min(1)
      .max(5),
    identities: z
      .array(
        z
          .object({
            employeeId: z.uuid(),
            sourceName: z.string().trim().min(1).max(320),
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();
export type ExportIntake = z.infer<typeof schema>;
const layouts = {
  "menufy-updates": ["Agent", "Agent updates", "Solved", "% Solved"],
  "menufy-inbound": [
    "Name",
    "Offered",
    "Accepted",
    "Declined",
    "Missed",
    "unreachable",
    "% answered",
    "Abandoned on hold",
    "transferred to",
    "Talk time",
    "Max Hold time",
  ],
  "menufy-outbound": ["Leg agent name", "Complete", "NA", "Total", "Talk"],
  "menufy-csat": ["Agent", "CSAT", "Good", "Bad", "Sent", "Return %"],
  "menufy-state": ["Agent name", "State", "Total"],
} as const;
type Field = {
  column: number;
  key: string;
  label: string;
  unit: "count" | "seconds" | "percent";
  ratio?: boolean;
};
const fields: Record<Exclude<ExportIntake["reports"][number]["kind"], "menufy-state">, Field[]> = {
  "menufy-updates": [
    {
      column: 1,
      key: "zendesk_agent_update_events",
      label: "Agent update events (report)",
      unit: "count",
    },
    {
      column: 2,
      key: "zendesk_tickets_solved_credits",
      label: "Tickets solved (Zendesk credit)",
      unit: "count",
    },
  ],
  "menufy-inbound": [
    { column: 1, key: "inbound_calls_offered", label: "Inbound offers", unit: "count" },
    { column: 2, key: "inbound_calls_accepted", label: "Inbound accepted", unit: "count" },
    { column: 3, key: "declined_calls", label: "Inbound declined", unit: "count" },
    { column: 4, key: "missed_calls", label: "Inbound missed", unit: "count" },
    { column: 5, key: "inbound_calls_unreachable", label: "Inbound unreachable", unit: "count" },
    {
      column: 6,
      key: "inbound_calls_answer_rate",
      label: "Inbound answer rate",
      unit: "percent",
      ratio: true,
    },
    { column: 7, key: "abandoned_on_hold", label: "Abandoned on hold", unit: "count" },
    {
      column: 9,
      key: "total_talk_time_inbound",
      label: "Inbound total talk time",
      unit: "seconds",
    },
    {
      column: 10,
      key: "max_hold_time_inbound",
      label: "Inbound maximum hold time",
      unit: "seconds",
    },
  ],
  "menufy-outbound": [
    { column: 1, key: "outbound_calls_completed", label: "Outbound completed", unit: "count" },
    {
      column: 2,
      key: "outbound_calls_non_answered",
      label: "Outbound non-answered",
      unit: "count",
    },
    { column: 3, key: "outbound_calls", label: "Outbound total calls", unit: "count" },
    {
      column: 4,
      key: "total_talk_time_outbound",
      label: "Outbound total talk time",
      unit: "seconds",
    },
  ],
  "menufy-csat": [
    { column: 1, key: "csat_score", label: "CSAT score", unit: "percent", ratio: true },
    { column: 2, key: "csat_good", label: "Good ratings", unit: "count" },
    { column: 3, key: "csat_bad", label: "Bad ratings", unit: "count" },
    { column: 4, key: "csat_sent", label: "Surveys sent", unit: "count" },
    {
      column: 5,
      key: "csat_response_rate",
      label: "CSAT response rate",
      unit: "percent",
      ratio: true,
    },
  ],
};
function numeric(raw: string, field: Field) {
  if (raw.trim() === "") return null;
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw Error("Export contains a non-numeric metric cell");
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value > Number.MAX_SAFE_INTEGER ||
    (field.unit === "count" && !Number.isSafeInteger(value)) ||
    (field.ratio && value > 1)
  )
    throw Error("Export metric is outside its permitted unit range");
  return field.ratio ? value * 100 : value;
}

/** Read-only intake. Report parity is not human authorship or publication approval. */
export function prepareZendeskExport(input: unknown, now = new Date()) {
  const value = schema.parse(input);
  const start = Date.parse(value.periodStart),
    end = Date.parse(value.periodEnd);
  if (
    new Date(start).getUTCDay() !== 0 ||
    end - start !== 6 * 86400000 ||
    Date.parse(value.observedAt) > now.getTime() ||
    start > Date.parse(value.observedAt)
  )
    throw Error("Export period or observation is invalid");
  const names = new Map<string, string>();
  const employeeIds = new Set<string>();
  for (const identity of value.identities) {
    if (names.has(identity.sourceName) || employeeIds.has(identity.employeeId))
      throw Error("Export identity is ambiguous");
    names.set(identity.sourceName, identity.employeeId);
    employeeIds.add(identity.employeeId);
  }
  const kinds = new Set<string>();
  const values: Array<{
    employeeId: string;
    key: string;
    label: string;
    unit: string;
    value: number | null;
    report: string;
    sourceRow: number;
    raw: string;
    fileSha256: string;
    scopeEvidenceSha256: string;
  }> = [];
  const coverage: Array<{
    report: string;
    matchedEmployees: number;
    absentEmployees: number;
    excludedRows: number;
    unnamedRows: number;
  }> = [];
  for (const report of value.reports) {
    if (kinds.has(report.kind)) throw Error("Duplicate report kind");
    kinds.add(report.kind);
    if (JSON.stringify(report.headers) !== JSON.stringify(layouts[report.kind]))
      throw Error("Export headers differ from the supported report definition");
    const rows = new Set<string>(),
      matched = new Set<string>();
    let excludedRows = 0,
      unnamedRows = 0;
    for (const [index, row] of report.rows.entries()) {
      if (row.length !== report.headers.length)
        throw Error("Export row width differs from its header");
      const name = row[0]!.trim();
      if (!name) {
        unnamedRows++;
        continue;
      }
      const rowKey = report.kind === "menufy-state" ? JSON.stringify([name, row[1]]) : name;
      if (rows.has(rowKey)) throw Error("Duplicate employee/report row");
      rows.add(rowKey);
      const employeeId = names.get(name);
      if (!employeeId) {
        excludedRows++;
        continue;
      }
      matched.add(employeeId);
      let selected: Field[];
      if (report.kind === "menufy-state") {
        const state = row[1];
        if (!["Away", "Online", "Transfers only", "SUM"].includes(state!))
          throw Error("Unknown state in report");
        // SUM includes Online and is not Away + Transfers only. Never substitute it.
        if (state === "SUM") continue;
        selected = [
          {
            column: 2,
            key: `report_state_${state!.toLowerCase().replaceAll(" ", "_")}`,
            label: `${state} time (report)`,
            unit: "seconds",
          },
        ];
      } else selected = fields[report.kind];
      for (const field of selected)
        values.push({
          employeeId,
          key: field.key,
          label: field.label,
          unit: field.unit,
          value: numeric(row[field.column]!, field),
          raw: row[field.column]!,
          report: report.kind,
          sourceRow: index + 2,
          fileSha256: report.fileSha256,
          scopeEvidenceSha256: report.scopeEvidenceSha256,
        });
    }
    coverage.push({
      report: report.kind,
      matchedEmployees: matched.size,
      absentEmployees: names.size - matched.size,
      excludedRows,
      unnamedRows,
    });
  }
  return {
    sourceContract: EXPORT_CANDIDATE_CONTRACT,
    publicationEligible: false as const,
    organizationId: value.organizationId,
    teamId: value.teamId,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    timeZone: value.timeZone,
    observedAt: value.observedAt,
    archiveSha256: value.archiveSha256,
    viewerEvidenceSha256: value.viewerEvidenceSha256,
    batchFingerprint: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    values,
    coverage,
  };
}
