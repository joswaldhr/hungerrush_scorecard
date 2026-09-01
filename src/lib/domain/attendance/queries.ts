import { db } from "@/lib/db";
import { attendanceEvents } from "@/lib/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getAttendanceEvents(ctx: ManagerContext, employeeId: string, limit = 30) {
  assertCanAccessEmployee(ctx, employeeId);
  return db
    .select()
    .from(attendanceEvents)
    .where(eq(attendanceEvents.employeeId, employeeId))
    .orderBy(desc(attendanceEvents.occurredAt))
    .limit(limit);
}

export interface AttendanceSummary {
  totalEvents: number;
  totalPoints: number;
  unexcusedCount: number;
  recentEvents: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    minutesLate: number | null;
    pointsAssigned: number | null;
    excused: boolean;
  }>;
}

export async function getAttendanceSummary(
  ctx: ManagerContext,
  employeeId: string,
  rollingDays = 90
): Promise<AttendanceSummary> {
  assertCanAccessEmployee(ctx, employeeId);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - rollingDays);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  const events = await db
    .select()
    .from(attendanceEvents)
    .where(
      and(eq(attendanceEvents.employeeId, employeeId), gte(attendanceEvents.occurredAt, cutoffStr))
    )
    .orderBy(desc(attendanceEvents.occurredAt));

  const totalPoints = events.reduce((sum, e) => sum + (e.pointsAssigned ?? 0), 0);
  const unexcusedCount = events.filter((e) => !e.excused).length;

  return {
    totalEvents: events.length,
    totalPoints: Math.round(totalPoints * 100) / 100,
    unexcusedCount,
    recentEvents: events.slice(0, 10).map((e) => ({
      id: e.id,
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      minutesLate: e.minutesLate,
      pointsAssigned: e.pointsAssigned,
      excused: e.excused,
    })),
  };
}

export async function createAttendanceEvent(
  ctx: ManagerContext,
  data: {
    employeeId: string;
    eventType: string;
    occurredAt: string;
    minutesLate?: number;
    pointsAssigned?: number;
    notes?: string;
    excused?: boolean;
  }
) {
  assertCanAccessEmployee(ctx, data.employeeId);
  const [event] = await db
    .insert(attendanceEvents)
    .values({
      employeeId: data.employeeId,
      managerUserId: ctx.userId,
      eventType: data.eventType,
      occurredAt: data.occurredAt,
      minutesLate: data.minutesLate ?? null,
      pointsAssigned: data.pointsAssigned ?? null,
      notes: data.notes ?? null,
      excused: data.excused ?? false,
    })
    .returning();
  return event!;
}
