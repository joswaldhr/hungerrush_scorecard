"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCoachingRecord, updateCoachingOutcome } from "./actions";
import { toast } from "sonner";
import { Plus, ChevronDown, Target, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function SubmitButton({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50", className)}
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

interface CoachingRecord {
  id: string;
  topic: string;
  notes: string | null;
  metricName: string | null;
  expectedImprovement: string | null;
  followUpDate: string | null;
  outcome: string | null;
  outcomeNotes: string | null;
  closedAt: Date | null;
  createdAt: Date;
}

interface MetricOption {
  id: string;
  name: string;
}

export function CoachingPanel({
  employeeId,
  records,
  metrics,
}: {
  employeeId: string;
  records: CoachingRecord[];
  metrics: MetricOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const openRecords = records.filter((r) => !r.closedAt);
  const closedRecords = records.filter((r) => r.closedAt);

  async function handleCreate(formData: FormData) {
    try {
      await createCoachingRecord(formData);
      setShowForm(false);
      formRef.current?.reset();
    } catch {
      toast.error("Failed to create coaching record");
    }
  }

  async function handleClose(formData: FormData) {
    try {
      await updateCoachingOutcome(formData);
      setClosingId(null);
    } catch {
      toast.error("Failed to update coaching record");
    }
  }

  return (
    <div className="space-y-3">
      {openRecords.length > 0 && (
        <ul className="space-y-2">
          {openRecords.map((record) => (
            <li
              key={record.id}
              className="p-3 rounded-lg border border-border/60 bg-card space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{record.topic}</span>
                  {record.metricName && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900">
                      <Target className="h-2.5 w-2.5" />
                      {record.metricName}
                    </span>
                  )}
                </div>
                {closingId !== record.id && (
                  <button
                    onClick={() => setClosingId(record.id)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border hover:bg-muted"
                  >
                    Close
                  </button>
                )}
              </div>

              {record.expectedImprovement && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium">Expected:</span> {record.expectedImprovement}
                </p>
              )}

              {record.followUpDate && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium">Follow-up:</span>{" "}
                  {new Date(record.followUpDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}

              {closingId === record.id && (
                <form action={handleClose} className="border-t border-border/60 pt-2 space-y-2">
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <input type="hidden" name="recordId" value={record.id} />
                  <input type="hidden" name="close" value="true" />
                  <select
                    name="outcome"
                    required
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Select outcome...</option>
                    <option value="improved">Improved</option>
                    <option value="no_change">No change</option>
                    <option value="declined">Declined</option>
                    <option value="ongoing">Still ongoing</option>
                  </select>
                  <textarea
                    name="outcomeNotes"
                    placeholder="Outcome notes (optional)..."
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                  <div className="flex gap-2">
                    <SubmitButton
                      label="Close record"
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    />
                    <button
                      type="button"
                      onClick={() => setClosingId(null)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add coaching record
        </button>
      ) : (
        <form
          ref={formRef}
          action={handleCreate}
          className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/30"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <input
            type="text"
            name="topic"
            placeholder="Coaching topic..."
            required
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="metricDefinitionId"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Link metric (optional)</option>
              {metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="followUpDate"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              placeholder="Follow-up date"
            />
          </div>
          <input
            type="text"
            name="expectedImprovement"
            placeholder="Expected improvement (optional)..."
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
          />
          <textarea
            name="notes"
            placeholder="Notes..."
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
          />
          <div className="flex gap-2">
            <SubmitButton
              label="Add record"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {closedRecords.length > 0 && (
        <details>
          <summary className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
            <ChevronDown className="h-3 w-3" />
            {closedRecords.length} closed
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {closedRecords.map((record) => (
              <li
                key={record.id}
                className="flex items-start gap-2 px-2.5 py-1.5 text-xs text-muted-foreground opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">{record.topic}</span>
                  {record.outcome && <span className="ml-1.5 text-[10px]">({record.outcome})</span>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
