"use client";

import { useState } from "react";
import { RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CHECKLIST_ITEMS = [
  { key: "review-metrics", label: "Review weekly performance metrics" },
  { key: "review-actions", label: "Check open action items from previous 1:1" },
  { key: "note-recognition", label: "Note specific achievements to recognize" },
  { key: "talking-points", label: "Review coaching notes and prepare talking points" },
];

function checklistKey(employeeId: string) {
  return `cadence:prep-checklist:${employeeId}`;
}

function notesKey(employeeId: string) {
  return `cadence:prep-notes:${employeeId}`;
}

function loadChecked(employeeId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(checklistKey(employeeId));
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    "review-metrics": true,
    "review-actions": true,
    "note-recognition": true,
  };
}

function loadNotes(employeeId: string): string {
  try {
    return localStorage.getItem(notesKey(employeeId)) ?? "";
  } catch {}
  return "";
}

export function MeetingPrepChecklist({ employeeId }: { employeeId: string }) {
  const [checked, setChecked] = useState(() => loadChecked(employeeId));
  const [notes, setNotes] = useState(() => loadNotes(employeeId));

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(checklistKey(employeeId), JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    try {
      localStorage.setItem(notesKey(employeeId), value);
    } catch {}
  }

  function reset() {
    setChecked({});
    setNotes("");
    try {
      localStorage.removeItem(checklistKey(employeeId));
      localStorage.removeItem(notesKey(employeeId));
    } catch {}
  }

  const completedCount = CHECKLIST_ITEMS.filter((i) => checked[i.key]).length;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Prep Items
        </span>
        <span className="text-xs font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
          {completedCount} / {CHECKLIST_ITEMS.length} completed
        </span>
      </div>

      <ul className="space-y-2 text-xs">
        {CHECKLIST_ITEMS.map((item) => {
          const isDone = !!checked[item.key];
          return (
            <li
              key={item.key}
              onClick={() => toggle(item.key)}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all select-none",
                isDone
                  ? "bg-slate-50/50 border-border/60 text-muted-foreground dark:bg-slate-900/30"
                  : "bg-card border-border hover:border-border/80 text-foreground shadow-2xs"
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors",
                  isDone ? "bg-[#009ca6] text-white" : "border border-border/80 bg-background"
                )}
              >
                {isDone && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <span className={cn("font-medium", isDone && "line-through opacity-80")}>
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="pt-2">
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Additional prep notes or talking points..."
          rows={2}
          className="w-full resize-none rounded-lg border border-border/80 bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#009ca6]"
        />
      </div>

      {completedCount > 0 && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset checklist</span>
        </button>
      )}
    </div>
  );
}
