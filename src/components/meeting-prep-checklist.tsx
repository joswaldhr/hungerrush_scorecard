"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

const CHECKLIST_ITEMS = [
  { key: "review-summary", label: "Review performance summary" },
  { key: "review-context", label: "Review previous context" },
  { key: "review-actions", label: "Review action items from last meeting" },
  { key: "talking-points", label: "Add your own talking points" },
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
  return {};
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

  const hasState = Object.values(checked).some(Boolean) || notes.length > 0;

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5 text-sm">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={!!checked[item.key]}
              onChange={() => toggle(item.key)}
              className="h-4 w-4 rounded border-border accent-accent"
              aria-label={item.label}
            />
            <span
              className={
                checked[item.key] ? "text-muted-foreground line-through" : "text-foreground"
              }
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <textarea
        value={notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Your talking points and notes..."
        rows={3}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {hasState && (
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset checklist
        </button>
      )}
    </div>
  );
}
