"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addActionItem, toggleActionItem } from "./actions";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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

export function ActionItemsPanel({
  employeeId,
  items,
}: {
  employeeId: string;
  items: Array<{ id: string; title: string; status: string; completedAt: Date | null }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(formData: FormData) {
    try {
      await addActionItem(formData);
      if (inputRef.current) inputRef.current.value = "";
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

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <form action={handleToggle}>
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={item.status === "done"}
                    readOnly
                    tabIndex={-1}
                    className="pointer-events-none h-4 w-4 rounded border-border accent-accent"
                    aria-label={`Mark "${item.title}" as ${item.status === "done" ? "open" : "done"}`}
                  />
                </button>
              </form>
              <span
                className={`text-sm ${item.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={handleAdd} className="flex items-center gap-2">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input
          ref={inputRef}
          type="text"
          name="title"
          placeholder="Add action item..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <AddButton />
      </form>
    </div>
  );
}
