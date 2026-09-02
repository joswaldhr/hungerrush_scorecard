"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAttendanceEvent } from "./actions";
import { toast } from "sonner";
import { Plus, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Log event"}
    </button>
  );
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  tardy: "Tardy",
  absent: "Absent",
  early_departure: "Early departure",
  no_call_no_show: "No call / no show",
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  tardy:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  absent:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
  early_departure:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  no_call_no_show:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
};

interface AttendanceSummaryData {
  totalEvents: number;
  totalPoints: number;
  unexcusedCount: number;
  recentEvents: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    minutesLate: number | null;
    pointsAssigned: number | null;
    excused: boolean;
  }>;
}

export function AttendanceSection({
  employeeId,
  summary,
}: {
  employeeId: string;
  summary: AttendanceSummaryData;
}) {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleCreate(formData: FormData) {
    try {
      await createAttendanceEvent(formData);
      setShowForm(false);
      formRef.current?.reset();
    } catch {
      toast.error("Failed to log attendance event");
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{summary.totalPoints}</p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Points (90-day)</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{summary.unexcusedCount}</p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Unexcused</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-xl font-bold text-foreground tabular-nums">{summary.totalEvents}</p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Total events</p>
        </div>
      </div>

      {/* Recent events */}
      {summary.recentEvents.length > 0 && (
        <ul className="space-y-1.5">
          {summary.recentEvents.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/40 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                    EVENT_TYPE_STYLES[event.eventType] ?? EVENT_TYPE_STYLES.tardy
                  )}
                >
                  {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                </span>
                {event.minutesLate !== null && event.minutesLate > 0 && (
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {event.minutesLate}m late
                  </span>
                )}
                {event.excused && (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Shield className="h-2.5 w-2.5" />
                    Excused
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                {event.pointsAssigned !== null && (
                  <span className="font-semibold tabular-nums">
                    {event.pointsAssigned > 0 ? "+" : ""}
                    {event.pointsAssigned} pts
                  </span>
                )}
                <span>
                  {new Date(event.occurredAt + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {summary.recentEvents.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 text-center">
          No attendance events in the last 90 days.
        </p>
      )}

      {/* Add event form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Log attendance event
        </button>
      ) : (
        <form
          ref={formRef}
          action={handleCreate}
          className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/30"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="eventType"
              required
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Event type...</option>
              <option value="tardy">Tardy</option>
              <option value="absent">Absent</option>
              <option value="early_departure">Early departure</option>
              <option value="no_call_no_show">No call / no show</option>
            </select>
            <input
              type="date"
              name="occurredAt"
              required
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              name="minutesLate"
              placeholder="Minutes late"
              min="0"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
            />
            <input
              type="number"
              name="pointsAssigned"
              placeholder="Points"
              step="0.5"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" name="excused" value="true" className="rounded" />
              Excused
            </label>
          </div>
          <textarea
            name="notes"
            placeholder="Notes (optional)..."
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
          />
          <div className="flex gap-2">
            <SubmitButton />
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
    </div>
  );
}
