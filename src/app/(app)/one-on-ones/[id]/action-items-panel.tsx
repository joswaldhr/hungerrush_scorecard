"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addActionItem, toggleActionItem } from "./actions";
import { toast } from "sonner";
import { Plus, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
      aria-label="Add action item"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
  normal:
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800",
  low: "bg-slate-50/50 text-slate-400 border-slate-100 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-800/50",
};

const OWNER_STYLES: Record<string, string> = {
  manager:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  employee:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900",
};

interface ActionItem {
  id: string;
  title: string;
  status: string;
  owner: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
}

export function ActionItemsPanel({
  employeeId,
  items,
}: {
  employeeId: string;
  items: ActionItem[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showOptions, setShowOptions] = useState(false);

  const openItems = items.filter((i) => i.status === "open");
  const doneItems = items.filter((i) => i.status === "done");

  async function handleAdd(formData: FormData) {
    try {
      await addActionItem(formData);
      if (inputRef.current) inputRef.current.value = "";
      setShowOptions(false);
    } catch {
      toast.error("Failed to add action item");
    }
  }

  async function handleToggle(formData: FormData) {
    try {
      await toggleActionItem(formData);
    } catch {
      toast.error("Failed to update action item");
    }
  }

  function formatDueDate(date: Date) {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function renderItem(item: ActionItem) {
    const isDone = item.status === "done";
    const isOverdue = !isDone && item.dueDate && new Date(item.dueDate) < new Date();
    return (
      <li key={item.id} className="group flex items-start gap-2.5 py-1.5">
        <form action={handleToggle}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit" className="mt-0.5">
            <input
              type="checkbox"
              checked={isDone}
              readOnly
              tabIndex={-1}
              className="pointer-events-none h-4 w-4 rounded border-border accent-accent"
              aria-label={`Mark "${item.title}" as ${isDone ? "open" : "done"}`}
            />
          </button>
        </form>
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-sm",
              isDone ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {item.title}
          </span>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.owner !== "employee" && (
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                  OWNER_STYLES[item.owner] ?? OWNER_STYLES.employee
                )}
              >
                {item.owner}
              </span>
            )}
            {item.priority !== "normal" && (
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                  PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.normal
                )}
              >
                {item.priority}
              </span>
            )}
            {item.dueDate && !isDone && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-medium",
                  isOverdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {formatDueDate(new Date(item.dueDate))}
              </span>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-3">
      {openItems.length > 0 && <ul className="space-y-1">{openItems.map(renderItem)}</ul>}

      {doneItems.length > 0 && (
        <details className="group/done">
          <summary className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
            <ChevronDown className="h-3 w-3 transition-transform group-open/done:rotate-180" />
            {doneItems.length} completed
          </summary>
          <ul className="mt-1 space-y-1 opacity-60">{doneItems.map(renderItem)}</ul>
        </details>
      )}

      <form action={handleAdd} className="space-y-2">
        <input type="hidden" name="employeeId" value={employeeId} />
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            name="title"
            placeholder="Add action item..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
            onFocus={() => setShowOptions(true)}
          />
          <AddButton />
        </div>
        {showOptions && (
          <div className="flex items-center gap-3 pl-1">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">Owner</span>
              <select
                name="owner"
                defaultValue="employee"
                className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">Priority</span>
              <select
                name="priority"
                defaultValue="normal"
                className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">Due</span>
              <input
                type="date"
                name="dueDate"
                className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
              />
            </label>
          </div>
        )}
      </form>
    </div>
  );
}
