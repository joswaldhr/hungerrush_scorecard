"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { setVisibilityOverride, getManagerScorecardCount } from "./actions";

interface MetricOption {
  id: string;
  name: string;
  category: string | null;
}

interface ManagerOption {
  userId: string;
  displayName: string;
}

interface EmployeeOption {
  id: string;
  displayName: string;
}

interface VisibilityEditorProps {
  metrics: MetricOption[];
  managers: ManagerOption[];
  employeesList: EmployeeOption[];
  menufyTeamId: string;
  posTeamId: string;
}

type Scope = "scorecard_override" | "manager_override" | "global_default";
type BrandTop = "menufy" | "pos" | "both";
type BrandSecond = "restaurant" | "consumer" | "both";

export function VisibilityEditor({
  metrics,
  managers,
  employeesList,
  menufyTeamId,
  posTeamId,
}: VisibilityEditorProps) {
  const [metricDefinitionId, setMetricDefinitionId] = useState("");
  const [scope, setScope] = useState<Scope>("scorecard_override");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [brandTop, setBrandTop] = useState<BrandTop | "">("");
  const [brandSecond, setBrandSecond] = useState<BrandSecond | "">("");
  const [hidden, setHidden] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scorecardCount, setScorecardCount] = useState<number | null>(null);

  const categories = new Map<string, MetricOption[]>();
  for (const m of metrics) {
    const key = m.category ?? "Other";
    categories.set(key, [...(categories.get(key) ?? []), m]);
  }

  const needsSecondTier = brandTop === "menufy" || brandTop === "both";
  const isValid =
    metricDefinitionId !== "" &&
    brandTop !== "" &&
    (!needsSecondTier || brandSecond !== "") &&
    (scope !== "scorecard_override" || targetEmployeeId !== "") &&
    (scope !== "manager_override" || managerUserId !== "");

  function buildTeamLinePairs(): { teamId: string; line: string | null }[] {
    const pairs: { teamId: string; line: string | null }[] = [];
    if (brandTop === "menufy" || brandTop === "both") {
      if (brandSecond === "both") {
        pairs.push({ teamId: menufyTeamId, line: "restaurant" });
        pairs.push({ teamId: menufyTeamId, line: "consumer" });
      } else if (brandSecond) {
        pairs.push({ teamId: menufyTeamId, line: brandSecond });
      }
    }
    if (brandTop === "pos" || brandTop === "both") {
      pairs.push({ teamId: posTeamId, line: null });
    }
    return pairs;
  }

  async function commit() {
    setSubmitting(true);
    try {
      const pairs = buildTeamLinePairs();
      for (const pair of pairs) {
        await setVisibilityOverride({
          scope,
          managerUserId: scope === "manager_override" ? managerUserId : null,
          targetEmployeeId: scope === "scorecard_override" ? targetEmployeeId : null,
          metricDefinitionId,
          teamId: pair.teamId,
          line: pair.line,
          hidden,
        });
      }
      setMetricDefinitionId("");
      setBrandTop("");
      setBrandSecond("");
      setTargetEmployeeId("");
      setManagerUserId("");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  async function handleSubmit() {
    if (!isValid) return;
    if (scope === "manager_override") {
      const count = await getManagerScorecardCount(managerUserId);
      setScorecardCount(count);
      setConfirmOpen(true);
      return;
    }
    await commit();
  }

  const selectedManager = managers.find((m) => m.userId === managerUserId);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Metric</label>
        <select
          value={metricDefinitionId}
          onChange={(e) => setMetricDefinitionId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Select a metric...</option>
          {[...categories.entries()].map(([category, opts]) => (
            <optgroup key={category} label={category}>
              {opts.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Scope</label>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <RadioGroupItem value="scorecard_override">This scorecard only</RadioGroupItem>
          <RadioGroupItem value="manager_override">All scorecards under a manager</RadioGroupItem>
          <RadioGroupItem value="global_default">Global default</RadioGroupItem>
        </RadioGroup>
      </div>

      {scope === "scorecard_override" && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Employee</label>
          <select
            value={targetEmployeeId}
            onChange={(e) => setTargetEmployeeId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Select an employee...</option>
            {employeesList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === "manager_override" && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Manager</label>
          <select
            value={managerUserId}
            onChange={(e) => setManagerUserId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Select a manager...</option>
            {managers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Brand</label>
        <RadioGroup value={brandTop} onValueChange={(v) => setBrandTop(v as BrandTop)}>
          <RadioGroupItem value="menufy">Menufy</RadioGroupItem>
          <RadioGroupItem value="pos">POS</RadioGroupItem>
          <RadioGroupItem value="both">Both</RadioGroupItem>
        </RadioGroup>
      </div>

      {needsSecondTier && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Menufy line
          </label>
          <RadioGroup value={brandSecond} onValueChange={(v) => setBrandSecond(v as BrandSecond)}>
            <RadioGroupItem value="restaurant">Restaurant</RadioGroupItem>
            <RadioGroupItem value="consumer">Consumer</RadioGroupItem>
            <RadioGroupItem value="both">Both</RadioGroupItem>
          </RadioGroup>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Hide this row (uncheck to show it again)
      </label>

      <button
        type="button"
        disabled={!isValid || submitting}
        onClick={handleSubmit}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
      >
        {submitting ? "Saving..." : "Save"}
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>
            {hidden ? "Hide" : "Show"} this metric for every scorecard under{" "}
            {selectedManager?.displayName ?? "this manager"}?
          </DialogTitle>
          <DialogDescription>
            This will affect {scorecardCount ?? "…"} scorecard
            {scorecardCount === 1 ? "" : "s"} currently assigned to{" "}
            {selectedManager?.displayName ?? "this manager"}.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={submitting}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
            >
              {submitting ? "Saving..." : "Confirm"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
