import { db } from "@/lib/db";
import {
  meetingNotes,
  meetingReferences,
  actionItems,
  coachingRecords,
  ticketReviews,
  discussionTopics,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export interface MeetingHistoryEntry {
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

export async function getMeetingHistory(
  ctx: ManagerContext,
  employeeId: string,
  limit = 10
): Promise<MeetingHistoryEntry[]> {
  assertCanAccessEmployee(ctx, employeeId);

  const notes = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.employeeId, employeeId))
    .orderBy(desc(meetingNotes.createdAt))
    .limit(limit);

  const entries: MeetingHistoryEntry[] = [];

  for (const note of notes) {
    let ref = null;
    if (note.meetingReferenceId) {
      const [r] = await db
        .select()
        .from(meetingReferences)
        .where(eq(meetingReferences.id, note.meetingReferenceId));
      if (r) {
        ref = {
          id: r.id,
          scheduledStart: r.scheduledStart,
          meetingType: r.meetingType,
          status: r.status,
        };
      }
    }

    const [aiCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(eq(actionItems.meetingNoteId, note.id));

    const [crCount] = await db
      .select({ count: count() })
      .from(coachingRecords)
      .where(eq(coachingRecords.meetingNoteId, note.id));

    const [trCount] = await db
      .select({ count: count() })
      .from(ticketReviews)
      .where(eq(ticketReviews.meetingNoteId, note.id));

    entries.push({
      meetingNote: {
        id: note.id,
        outcome: note.outcome,
        body: note.body,
        lifeCheckIn: note.lifeCheckIn,
        createdAt: note.createdAt,
      },
      meetingReference: ref,
      actionItemCount: aiCount?.count ?? 0,
      coachingRecordCount: crCount?.count ?? 0,
      ticketReviewCount: trCount?.count ?? 0,
    });
  }

  return entries;
}

export async function getLatestMeetingNote(
  ctx: ManagerContext,
  employeeId: string
) {
  assertCanAccessEmployee(ctx, employeeId);
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.employeeId, employeeId))
    .orderBy(desc(meetingNotes.createdAt))
    .limit(1);
  return note ?? null;
}
