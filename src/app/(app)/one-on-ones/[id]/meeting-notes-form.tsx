"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { saveMeetingNote } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OUTCOMES = [
  { value: "", label: "No outcome set" },
  { value: "productive", label: "Productive" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "concern_raised", label: "Concern raised" },
  { value: "skipped", label: "Skipped / Cancelled" },
];

const AUTOSAVE_DELAY = 2000;

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function MeetingNotesForm({
  employeeId,
  meetingReferenceId,
  existing,
}: {
  employeeId: string;
  meetingReferenceId: string | null;
  existing: {
    id: string;
    outcome: string | null;
    body: string | null;
    lifeCheckIn: string | null;
  } | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const autosave = useCallback(async () => {
    if (!formRef.current || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const formData = new FormData(formRef.current);
      await saveMeetingNote(formData);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  function scheduleAutosave() {
    setSaveStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(autosave, AUTOSAVE_DELAY);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleSubmit(formData: FormData) {
    if (timerRef.current) clearTimeout(timerRef.current);
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      await saveMeetingNote(formData);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
      toast.success("Notes saved");
    } catch {
      setSaveStatus("error");
      toast.error("Failed to save notes");
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
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
          onChange={scheduleAutosave}
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
        <label
          htmlFor="lifeCheckIn"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Life check-in
        </label>
        <textarea
          id="lifeCheckIn"
          name="lifeCheckIn"
          defaultValue={existing?.lifeCheckIn ?? ""}
          onChange={scheduleAutosave}
          rows={2}
          placeholder="How are they doing outside of work? Family, hobbies, energy level..."
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-xs font-medium text-muted-foreground mb-1">
          Meeting notes
        </label>
        <textarea
          id="body"
          name="body"
          defaultValue={existing?.body ?? ""}
          onChange={scheduleAutosave}
          rows={4}
          placeholder="Key takeaways, decisions, follow-ups..."
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saveStatus === "saving"}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Saving…" : "Save notes"}
        </button>
        {saveStatus !== "idle" && (
          <span
            className={cn(
              "text-[11px] font-medium transition-opacity",
              saveStatus === "saving" && "text-muted-foreground",
              saveStatus === "saved" && "text-emerald-600 dark:text-emerald-400",
              saveStatus === "dirty" && "text-amber-600 dark:text-amber-400",
              saveStatus === "error" && "text-rose-600 dark:text-rose-400"
            )}
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "dirty" && "Unsaved changes"}
            {saveStatus === "error" && "Save failed"}
          </span>
        )}
      </div>
    </form>
  );
}
