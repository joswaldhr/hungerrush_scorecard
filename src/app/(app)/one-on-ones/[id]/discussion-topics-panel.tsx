"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createDiscussionTopic, markTopicDiscussed, dismissTopic } from "./actions";
import { toast } from "sonner";
import { Plus, Check, X, Users } from "lucide-react";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
      aria-label={label}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

interface DiscussionTopic {
  id: string;
  title: string;
  notes: string | null;
  source: string;
  status: string;
  teamId: string | null;
  employeeId: string | null;
  createdAt: Date;
}

export function DiscussionTopicsPanel({
  employeeId,
  topics,
}: {
  employeeId: string;
  topics: DiscussionTopic[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = topics.filter((t) => t.status === "pending");
  const discussed = topics.filter((t) => t.status === "discussed");

  async function handleAdd(formData: FormData) {
    try {
      await createDiscussionTopic(formData);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      toast.error("Failed to add topic");
    }
  }

  async function handleDiscussed(formData: FormData) {
    try {
      await markTopicDiscussed(formData);
    } catch {
      toast.error("Failed to update topic");
    }
  }

  async function handleDismiss(formData: FormData) {
    try {
      await dismissTopic(formData);
    } catch {
      toast.error("Failed to dismiss topic");
    }
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((topic) => (
            <li
              key={topic.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {topic.teamId && !topic.employeeId && (
                    <Users className="h-3 w-3 text-blue-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-foreground">{topic.title}</span>
                </div>
                {topic.notes && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {topic.notes}
                  </p>
                )}
                {topic.source !== "manager" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900 mt-1">
                    {topic.source}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <form action={handleDiscussed}>
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <button
                    type="submit"
                    className="flex h-6 w-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    aria-label="Mark discussed"
                    title="Mark as discussed"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </form>
                <form action={handleDismiss}>
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <button
                    type="submit"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    aria-label="Defer topic"
                    title="Defer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No pending topics. Add one below.</p>
      )}

      <form action={handleAdd} className="flex items-center gap-2">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input
          ref={inputRef}
          type="text"
          name="title"
          placeholder="Add a discussion topic..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <SubmitButton label="Add discussion topic" />
      </form>

      {discussed.length > 0 && (
        <details>
          <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
            {discussed.length} discussed
          </summary>
          <ul className="mt-1.5 space-y-1 opacity-60">
            {discussed.map((topic) => (
              <li
                key={topic.id}
                className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground"
              >
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="line-through">{topic.title}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
