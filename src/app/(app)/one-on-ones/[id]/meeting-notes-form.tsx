"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { saveMeetingNote } from "./actions";
import { toast } from "sonner";

const OUTCOMES = [
  { value: "", label: "No outcome set" },
  { value: "productive", label: "Productive" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "concern_raised", label: "Concern raised" },
  { value: "skipped", label: "Skipped / Cancelled" },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save notes"}
    </button>
  );
}

export function MeetingNotesForm({
  employeeId,
  meetingReferenceId,
  existing,
}: {
  employeeId: string;
  meetingReferenceId: string | null;
  existing: { id: string; outcome: string | null; body: string | null } | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData) {
    try {
      await saveMeetingNote(formData);
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    }
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {existing?.id && <input type="hidden" name="noteId" value={existing.id} />}
      {meetingReferenceId && (
        <input type="hidden" name="meetingReferenceId" value={meetingReferenceId} />
      )}

      <div>
        <label htmlFor="outcome" className="block text-xs font-medium text-muted-foreground mb-1">
          Meeting outcome
        </label>
        <select
          id="outcome"
          name="outcome"
          defaultValue={existing?.outcome ?? ""}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="body" className="block text-xs font-medium text-muted-foreground mb-1">
          Notes
        </label>
        <textarea
          id="body"
          name="body"
          defaultValue={existing?.body ?? ""}
          rows={4}
          placeholder="Key takeaways, decisions, follow-ups..."
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <SaveButton />
    </form>
  );
}
