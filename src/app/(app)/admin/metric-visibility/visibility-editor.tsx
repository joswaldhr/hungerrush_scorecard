"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { setVisibilityOverrides, getManagerScorecardCount } from "./actions";
import {
  buildTeamLinePairs,
  isValidVisibilitySelection,
  type Scope,
  type BrandTop,
  type BrandSecond,
} from "./visibility-logic";

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

export function VisibilityEditor({
  metrics,
  managers,
  employeesList,
  menufyTeamId,
  posTeamId,
}: VisibilityEditorProps) {
  const formId = useId();
  const [metricDefinitionId, setMetricDefinitionId] = useState("");
  const [scope, setScope] = useState<Scope>("scorecard_override");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [brandTop, setBrandTop] = useState<BrandTop | "">("");
  const [brandSecond, setBrandSecond] = useState<BrandSecond | "">("");
  const [hidden, setHidden] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingScope, setCheckingScope] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scorecardCount, setScorecardCount] = useState<number | null>(null);

  const categories = new Map<string, MetricOption[]>();
  for (const m of metrics) {
    const key = m.category ?? "Other";
    categories.set(key, [...(categories.get(key) ?? []), m]);
  }

  const needsSecondTier = brandTop === "menufy" || brandTop === "both";
  const isValid = isValidVisibilitySelection({
    metricDefinitionId,
    brandTop,
    brandSecond,
    scope,
    targetEmployeeId,
    managerUserId,
  });

  async function commit() {
    setSubmitting(true);
    try {
      const pairs = buildTeamLinePairs(brandTop, brandSecond, menufyTeamId, posTeamId);
      await setVisibilityOverrides(
        pairs.map((pair) => ({
          scope,
          managerUserId: scope === "manager_override" ? managerUserId : null,
          targetEmployeeId: scope === "scorecard_override" ? targetEmployeeId : null,
          metricDefinitionId,
          teamId: pair.teamId,
          line: pair.line,
          hidden,
        }))
      );
      setConfirmOpen(false);
      toast.success("Visibility updated");
      setMetricDefinitionId("");
      setBrandTop("");
      setBrandSecond("");
      setTargetEmployeeId("");
      setManagerUserId("");
    } catch {
      toast.error("Could not confirm that visibility changes were saved. Refresh before retrying.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!isValid) return;
    if (scope === "manager_override") {
      setCheckingScope(true);
      try {
        const count = await getManagerScorecardCount(managerUserId);
        setScorecardCount(count);
        setConfirmOpen(true);
      } catch {
        toast.error("Could not load the affected scorecards. Please retry.");
      } finally {
        setCheckingScope(false);
      }
      return;
    }
    await commit();
  }

  const selectedManager = managers.find((m) => m.userId === managerUserId);

  return (
    <fieldset
      disabled={submitting || checkingScope}
      aria-label="Metric visibility"
      className="min-w-0 space-y-4 rounded-lg border border-border p-4"
    >
      <div>
        <label
          htmlFor={`${formId}-metric`}
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Metric
        </label>
        <select
          id={`${formId}-metric`}
          value={metricDefinitionId}
          onChange={(e) => setMetricDefinitionId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
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
        <p id={`${formId}-scope`} className="block text-xs font-medium text-muted-foreground mb-2">
          Scope
        </p>
        <RadioGroup
          aria-labelledby={`${formId}-scope`}
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
        >
          <RadioGroupItem value="scorecard_override">This scorecard only</RadioGroupItem>
          <RadioGroupItem value="manager_override">All scorecards under a manager</RadioGroupItem>
          <RadioGroupItem value="global_default">Global default</RadioGroupItem>
        </RadioGroup>
      </div>

      {scope === "scorecard_override" && (
        <div>
          <label
            htmlFor={`${formId}-employee`}
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Employee
          </label>
          <select
            id={`${formId}-employee`}
            value={targetEmployeeId}
            onChange={(e) => setTargetEmployeeId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
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
          <label
            htmlFor={`${formId}-manager`}
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Manager
          </label>
          <select
            id={`${formId}-manager`}
            value={managerUserId}
            onChange={(e) => setManagerUserId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
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
        <p id={`${formId}-brand`} className="block text-xs font-medium text-muted-foreground mb-2">
          Brand
        </p>
        <RadioGroup
          aria-labelledby={`${formId}-brand`}
          value={brandTop}
          onValueChange={(v) => setBrandTop(v as BrandTop)}
        >
          <RadioGroupItem value="menufy">Menufy</RadioGroupItem>
          <RadioGroupItem value="pos">POS</RadioGroupItem>
          <RadioGroupItem value="both">Both</RadioGroupItem>
        </RadioGroup>
      </div>

      {needsSecondTier && (
        <div>
          <p id={`${formId}-line`} className="block text-xs font-medium text-muted-foreground mb-2">
            Menufy line
          </p>
          <RadioGroup
            aria-labelledby={`${formId}-line`}
            value={brandSecond}
            onValueChange={(v) => setBrandSecond(v as BrandSecond)}
          >
            <RadioGroupItem value="restaurant">Restaurant</RadioGroupItem>
            <RadioGroupItem value="consumer">Consumer</RadioGroupItem>
            <RadioGroupItem value="both">Restaurant + Consumer</RadioGroupItem>
            <RadioGroupItem value="all">
              All lines (also covers employees not yet tagged with a line)
            </RadioGroupItem>
          </RadioGroup>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Hide this row (uncheck to show it again)
      </label>

      <button
        type="button"
        disabled={!isValid || submitting}
        onClick={handleSubmit}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
      >
        {checkingScope ? "Checking scope..." : submitting ? "Saving..." : "Save"}
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
    </fieldset>
  );
}
