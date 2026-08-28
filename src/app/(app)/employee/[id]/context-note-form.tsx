"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addContextNote } from "./actions";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

const CONTEXT_TYPES = [
  { value: "coaching", label: "Coaching" },
  { value: "quality_review", label: "Quality review" },
  { value: "attendance", label: "Attendance" },
  { value: "note", label: "Note" },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save note"}
    </button>
  );
}

export function ContextNoteForm({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData) {
    try {
      await addContextNote(formData);
      toast.success("Note added");
      formRef.current?.reset();
      setOpen(false);
    } catch {
      toast.error("Failed to add note");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-accent hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add context note
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="space-y-2.5 rounded-md border border-border p-3"
    >
      <input type="hidden" name="employeeId" value={employeeId} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Add context note</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <select
        name="contextType"
        defaultValue="note"
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      >
        {CONTEXT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="title"
        placeholder="Title"
        required
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <textarea
        name="summary"
        placeholder="Details (optional)"
        rows={2}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
      />

      <SaveButton />
    </form>
  );
}
