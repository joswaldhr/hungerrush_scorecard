import { db } from "@/lib/db";
import { coachingRecords, metricDefinitions } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getCoachingRecords(
  ctx: ManagerContext,
  employeeId: string,
  options: { openOnly?: boolean; limit?: number } = {}
) {
  assertCanAccessEmployee(ctx, employeeId);
  const conditions = [eq(coachingRecords.employeeId, employeeId)];
  if (options.openOnly) conditions.push(isNull(coachingRecords.closedAt));

  return db
    .select({
      id: coachingRecords.id,
      employeeId: coachingRecords.employeeId,
      managerUserId: coachingRecords.managerUserId,
      meetingNoteId: coachingRecords.meetingNoteId,
      metricDefinitionId: coachingRecords.metricDefinitionId,
      metricName: metricDefinitions.name,
      topic: coachingRecords.topic,
      notes: coachingRecords.notes,
      expectedImprovement: coachingRecords.expectedImprovement,
      followUpDate: coachingRecords.followUpDate,
      outcome: coachingRecords.outcome,
      outcomeNotes: coachingRecords.outcomeNotes,
      closedAt: coachingRecords.closedAt,
      createdAt: coachingRecords.createdAt,
    })
    .from(coachingRecords)
    .leftJoin(metricDefinitions, eq(coachingRecords.metricDefinitionId, metricDefinitions.id))
    .where(and(...conditions))
    .orderBy(desc(coachingRecords.createdAt))
    .limit(options.limit ?? 50);
}

export async function createCoachingRecord(
  ctx: ManagerContext,
  data: {
    employeeId: string;
    topic: string;
    notes?: string;
    metricDefinitionId?: string;
    expectedImprovement?: string;
    followUpDate?: string;
    meetingNoteId?: string;
  }
) {
  assertCanAccessEmployee(ctx, data.employeeId);
  const [record] = await db
    .insert(coachingRecords)
    .values({
      employeeId: data.employeeId,
      managerUserId: ctx.userId,
      topic: data.topic,
      notes: data.notes ?? null,
      metricDefinitionId: data.metricDefinitionId ?? null,
      expectedImprovement: data.expectedImprovement ?? null,
      followUpDate: data.followUpDate ?? null,
      meetingNoteId: data.meetingNoteId ?? null,
    })
    .returning();
  return record!;
}

export async function updateCoachingOutcome(
  ctx: ManagerContext,
  recordId: string,
  data: {
    outcome: string;
    outcomeNotes?: string;
    close?: boolean;
  }
) {
  const [existing] = await db
    .select()
    .from(coachingRecords)
    .where(eq(coachingRecords.id, recordId));
  if (!existing) throw new Error("Coaching record not found");
  assertCanAccessEmployee(ctx, existing.employeeId);

  const [updated] = await db
    .update(coachingRecords)
    .set({
      outcome: data.outcome,
      outcomeNotes: data.outcomeNotes ?? null,
      closedAt: data.close ? new Date() : null,
    })
    .where(eq(coachingRecords.id, recordId))
    .returning();
  return updated!;
}
