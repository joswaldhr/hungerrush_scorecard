"use client";

import { useState } from "react";

const CHECKLIST_ITEMS = [
  { key: "review-summary", label: "Review performance summary" },
  { key: "review-context", label: "Review previous context" },
  { key: "review-actions", label: "Review action items from last meeting" },
  { key: "talking-points", label: "Add your own talking points" },
];

function storageKey(employeeId: string) {
  return `cadence:prep-checklist:${employeeId}`;
}

function loadChecked(employeeId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(storageKey(employeeId));
    if (stored) return JSON.parse(stored);
  } catch {
    // localStorage unavailable or corrupt — start fresh
  }
  return {};
}

export function MeetingPrepChecklist({ employeeId }: { employeeId: string }) {
  const [checked, setChecked] = useState(() => loadChecked(employeeId));

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(storageKey(employeeId), JSON.stringify(next));
      } catch {
        // localStorage full or unavailable
      }
      return next;
    });
  }

  return (
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
            className={checked[item.key] ? "text-muted-foreground line-through" : "text-foreground"}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
