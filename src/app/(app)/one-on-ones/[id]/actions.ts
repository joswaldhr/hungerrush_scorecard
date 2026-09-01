"use server";

import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  meetingNotes,
  actionItems,
  discussionTopics,
  coachingRecords,
  ticketReviews,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function authorizeForEmployee(employeeId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) throw new Error("No manager context");
  const employees = await getAssignedEmployees(ctx);
  if (!employees.some((e) => e.id === employeeId)) throw new Error("Not authorized");
  return ctx;
}

function revalidate(employeeId: string) {
  revalidatePath(`/one-on-ones/${employeeId}`);
}

// ── Meeting Notes ──────────────────────────────────────

export async function saveMeetingNote(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const noteId = formData.get("noteId") as string | null;
  const outcome = (formData.get("outcome") as string) || null;
  const body = (formData.get("body") as string) || null;
  const lifeCheckIn = (formData.get("lifeCheckIn") as string) || null;
  const meetingReferenceId = (formData.get("meetingReferenceId") as string) || null;

  const ctx = await authorizeForEmployee(employeeId);

  if (noteId) {
    await db
      .update(meetingNotes)
      .set({ outcome, body, lifeCheckIn, updatedAt: new Date() })
      .where(and(eq(meetingNotes.id, noteId), eq(meetingNotes.managerUserId, ctx.userId)));
  } else {
    await db.insert(meetingNotes).values({
      employeeId,
      managerUserId: ctx.userId,
      meetingReferenceId,
      outcome,
      body,
      lifeCheckIn,
    });
  }

  revalidate(employeeId);
}

// ── Action Items ───────────────────────────────────────

export async function addActionItem(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const title = formData.get("title") as string;
  if (!title?.trim()) return;

  const owner = (formData.get("owner") as string) || "employee";
  const priority = (formData.get("priority") as string) || "normal";
  const dueDateStr = formData.get("dueDate") as string | null;

  const ctx = await authorizeForEmployee(employeeId);

  await db.insert(actionItems).values({
    employeeId,
    managerUserId: ctx.userId,
    title: title.trim(),
    owner,
    priority,
    dueDate: dueDateStr ? new Date(dueDateStr) : null,
  });

  revalidate(employeeId);
}

export async function toggleActionItem(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const itemId = formData.get("itemId") as string;

  const ctx = await authorizeForEmployee(employeeId);

  const [item] = await db
    .select({ status: actionItems.status })
    .from(actionItems)
    .where(and(eq(actionItems.id, itemId), eq(actionItems.managerUserId, ctx.userId)));

  if (!item) return;

  const newStatus = item.status === "open" ? "done" : "open";
  await db
    .update(actionItems)
    .set({
      status: newStatus,
      completedAt: newStatus === "done" ? new Date() : null,
    })
    .where(eq(actionItems.id, itemId));

  revalidate(employeeId);
}

// ── Discussion Topics ──────────────────────────────────

export async function createDiscussionTopic(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const title = formData.get("title") as string;
  if (!title?.trim()) return;

  const notes = (formData.get("notes") as string) || null;

  const ctx = await authorizeForEmployee(employeeId);

  await db.insert(discussionTopics).values({
    organizationId: ctx.organizationId,
    employeeId,
    managerUserId: ctx.userId,
    title: title.trim(),
    notes,
    source: "manager",
  });

  revalidate(employeeId);
}

export async function markTopicDiscussed(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const topicId = formData.get("topicId") as string;

  await authorizeForEmployee(employeeId);

  await db
    .update(discussionTopics)
    .set({ status: "discussed", discussedAt: new Date() })
    .where(eq(discussionTopics.id, topicId));

  revalidate(employeeId);
}

export async function dismissTopic(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const topicId = formData.get("topicId") as string;

  await authorizeForEmployee(employeeId);

  await db
    .update(discussionTopics)
    .set({ status: "deferred" })
    .where(eq(discussionTopics.id, topicId));

  revalidate(employeeId);
}

// ── Coaching Records ───────────────────────────────────

export async function createCoachingRecord(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const topic = formData.get("topic") as string;
  if (!topic?.trim()) return;

  const notes = (formData.get("notes") as string) || null;
  const metricDefinitionId = (formData.get("metricDefinitionId") as string) || null;
  const expectedImprovement = (formData.get("expectedImprovement") as string) || null;
  const followUpDateStr = formData.get("followUpDate") as string | null;

  const ctx = await authorizeForEmployee(employeeId);

  await db.insert(coachingRecords).values({
    employeeId,
    managerUserId: ctx.userId,
    topic: topic.trim(),
    notes,
    metricDefinitionId: metricDefinitionId || null,
    expectedImprovement,
    followUpDate: followUpDateStr || null,
  });

  revalidate(employeeId);
}

export async function updateCoachingOutcome(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const recordId = formData.get("recordId") as string;
  const outcome = formData.get("outcome") as string;
  const outcomeNotes = (formData.get("outcomeNotes") as string) || null;
  const close = formData.get("close") === "true";

  await authorizeForEmployee(employeeId);

  await db
    .update(coachingRecords)
    .set({
      outcome,
      outcomeNotes,
      closedAt: close ? new Date() : null,
    })
    .where(eq(coachingRecords.id, recordId));

  revalidate(employeeId);
}

// ── Ticket Reviews ─────────────────────────────────────

export async function createTicketReview(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const ticketId = formData.get("ticketId") as string;
  if (!ticketId?.trim()) return;

  const ticketUrl = (formData.get("ticketUrl") as string) || null;
  const category = (formData.get("category") as string) || "general";
  const notes = (formData.get("notes") as string) || null;

  const ctx = await authorizeForEmployee(employeeId);

  await db.insert(ticketReviews).values({
    employeeId,
    managerUserId: ctx.userId,
    ticketId: ticketId.trim(),
    ticketUrl,
    category,
    notes,
  });

  revalidate(employeeId);
}
