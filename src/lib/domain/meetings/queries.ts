import { db } from "@/lib/db";
import {
  meetingNotes,
  meetingReferences,
  actionItems,
  coachingRecords,
  ticketReviews,
} from "@/lib/db/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
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

  if (notes.length === 0) return [];

  const noteIds = notes.map((n) => n.id);
  const refIds = notes.map((n) => n.meetingReferenceId).filter((id): id is string => id !== null);

  const [refs, aiCounts, crCounts, trCounts] = await Promise.all([
    refIds.length > 0
      ? db.select().from(meetingReferences).where(inArray(meetingReferences.id, refIds))
      : Promise.resolve([]),
    db
      .select({ noteId: actionItems.meetingNoteId, count: count() })
      .from(actionItems)
      .where(inArray(actionItems.meetingNoteId, noteIds))
      .groupBy(actionItems.meetingNoteId),
    db
      .select({ noteId: coachingRecords.meetingNoteId, count: count() })
      .from(coachingRecords)
      .where(inArray(coachingRecords.meetingNoteId, noteIds))
      .groupBy(coachingRecords.meetingNoteId),
    db
      .select({ noteId: ticketReviews.meetingNoteId, count: count() })
      .from(ticketReviews)
      .where(inArray(ticketReviews.meetingNoteId, noteIds))
      .groupBy(ticketReviews.meetingNoteId),
  ]);

  const refMap = new Map(refs.map((r) => [r.id, r]));
  const aiMap = new Map(aiCounts.map((r) => [r.noteId, r.count]));
  const crMap = new Map(crCounts.map((r) => [r.noteId, r.count]));
  const trMap = new Map(trCounts.map((r) => [r.noteId, r.count]));

  return notes.map((note) => {
    const r = note.meetingReferenceId ? refMap.get(note.meetingReferenceId) : undefined;
    return {
      meetingNote: {
        id: note.id,
        outcome: note.outcome,
        body: note.body,
        lifeCheckIn: note.lifeCheckIn,
        createdAt: note.createdAt,
      },
      meetingReference: r
        ? {
            id: r.id,
            scheduledStart: r.scheduledStart,
            meetingType: r.meetingType,
            status: r.status,
          }
        : null,
      actionItemCount: aiMap.get(note.id) ?? 0,
      coachingRecordCount: crMap.get(note.id) ?? 0,
      ticketReviewCount: trMap.get(note.id) ?? 0,
    };
  });
}

export async function getLatestMeetingNote(ctx: ManagerContext, employeeId: string) {
  assertCanAccessEmployee(ctx, employeeId);
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.employeeId, employeeId))
    .orderBy(desc(meetingNotes.createdAt))
    .limit(1);
  return note ?? null;
}
