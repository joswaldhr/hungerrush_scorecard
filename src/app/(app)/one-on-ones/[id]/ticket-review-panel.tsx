"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTicketReview } from "./actions";
import { toast } from "sonner";
import { Plus, ExternalLink, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Log review"}
    </button>
  );
}

const CATEGORIES = [
  { value: "exemplary", label: "Exemplary" },
  { value: "needs_improvement", label: "Needs improvement" },
  { value: "coaching_opportunity", label: "Coaching opportunity" },
  { value: "escalation", label: "Escalation" },
  { value: "general", label: "General" },
];

const CATEGORY_STYLES: Record<string, string> = {
  exemplary:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  needs_improvement:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  coaching_opportunity:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  escalation:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900",
  general:
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800",
};

interface TicketReviewItem {
  id: string;
  ticketId: string;
  ticketUrl: string | null;
  category: string;
  notes: string | null;
  reviewedAt: Date;
}

export function TicketReviewPanel({
  employeeId,
  reviews,
}: {
  employeeId: string;
  reviews: TicketReviewItem[];
}) {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleCreate(formData: FormData) {
    try {
      await createTicketReview(formData);
      setShowForm(false);
      formRef.current?.reset();
    } catch {
      toast.error("Failed to log ticket review");
    }
  }

  return (
    <div className="space-y-3">
      {reviews.length > 0 && (
        <ul className="space-y-2">
          {reviews.slice(0, 5).map((review) => (
            <li
              key={review.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-card"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground font-mono">
                    #{review.ticketId}
                  </span>
                  {review.ticketUrl && (
                    <a
                      href={review.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                      CATEGORY_STYLES[review.category] ?? CATEGORY_STYLES.general
                    )}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {CATEGORIES.find((c) => c.value === review.category)?.label ?? review.category}
                  </span>
                </div>
                {review.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{review.notes}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(review.reviewedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Log ticket review
        </button>
      ) : (
        <form
          ref={formRef}
          action={handleCreate}
          className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/30"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              name="ticketId"
              placeholder="Ticket # or ID"
              required
              className="rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <select
              name="category"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="url"
            name="ticketUrl"
            placeholder="Ticket URL (optional)"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
          />
          <textarea
            name="notes"
            placeholder="Notes..."
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
