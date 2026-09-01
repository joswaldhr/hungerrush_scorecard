"use client";

import { ChevronDown, CheckSquare, Target, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingHistoryEntry {
  meetingNote: {
    id: string;
    outcome: string | null;
    body: string | null;
    lifeCheckIn: string | null;
    createdAt: Date;
  };
  meetingReference: {
    id: string;
    scheduledStart: Date;
    meetingType: string;
    status: string;
  } | null;
  actionItemCount: number;
  coachingRecordCount: number;
  ticketReviewCount: number;
}

const OUTCOME_STYLES: Record<string, string> = {
  productive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  follow_up_needed: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  concern_raised: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  skipped: "bg-slate-100 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400",
};

const OUTCOME_LABELS: Record<string, string> = {
  productive: "Productive",
  follow_up_needed: "Follow-up needed",
  concern_raised: "Concern raised",
  skipped: "Skipped",
};

export function MeetingHistory({ entries }: { entries: MeetingHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">No meeting history yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const date = entry.meetingReference?.scheduledStart ?? entry.meetingNote.createdAt;
        const dateObj = new Date(date);

        return (
          <details key={entry.meetingNote.id} className="group">
            <summary className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-card cursor-pointer select-none hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                <span className="text-xs font-semibold text-foreground">
                  {dateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {entry.meetingNote.outcome && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                      OUTCOME_STYLES[entry.meetingNote.outcome] ?? ""
                    )}
                  >
                    {OUTCOME_LABELS[entry.meetingNote.outcome] ?? entry.meetingNote.outcome}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {entry.actionItemCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <CheckSquare className="h-2.5 w-2.5" />
                    {entry.actionItemCount}
                  </span>
                )}
                {entry.coachingRecordCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Target className="h-2.5 w-2.5" />
                    {entry.coachingRecordCount}
                  </span>
                )}
                {entry.ticketReviewCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Ticket className="h-2.5 w-2.5" />
                    {entry.ticketReviewCount}
                  </span>
                )}
              </div>
            </summary>
            <div className="mt-1 ml-6 pl-3 border-l-2 border-border/40 space-y-2 pb-1">
              {entry.meetingNote.lifeCheckIn && (
                <div className="text-xs space-y-0.5">
                  <span className="font-medium text-muted-foreground">Life check-in</span>
                  <p className="text-foreground">{entry.meetingNote.lifeCheckIn}</p>
                </div>
              )}
              {entry.meetingNote.body && (
                <div className="text-xs space-y-0.5">
                  <span className="font-medium text-muted-foreground">Notes</span>
                  <p className="text-foreground whitespace-pre-line">{entry.meetingNote.body}</p>
                </div>
              )}
              {!entry.meetingNote.body && !entry.meetingNote.lifeCheckIn && (
                <p className="text-xs text-muted-foreground italic">No notes recorded.</p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
