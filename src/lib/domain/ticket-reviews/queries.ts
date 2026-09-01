import { db } from "@/lib/db";
import { ticketReviews } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getTicketReviews(ctx: ManagerContext, employeeId: string, limit = 20) {
  assertCanAccessEmployee(ctx, employeeId);
  return db
    .select()
    .from(ticketReviews)
    .where(eq(ticketReviews.employeeId, employeeId))
    .orderBy(desc(ticketReviews.reviewedAt))
    .limit(limit);
}

export async function createTicketReview(
  ctx: ManagerContext,
  data: {
    employeeId: string;
    ticketId: string;
    ticketUrl?: string;
    category: string;
    notes?: string;
    meetingNoteId?: string;
  }
) {
  assertCanAccessEmployee(ctx, data.employeeId);
  const [review] = await db
    .insert(ticketReviews)
    .values({
      employeeId: data.employeeId,
      managerUserId: ctx.userId,
      ticketId: data.ticketId,
      ticketUrl: data.ticketUrl ?? null,
      category: data.category,
      notes: data.notes ?? null,
      meetingNoteId: data.meetingNoteId ?? null,
    })
    .returning();
  return review!;
}
