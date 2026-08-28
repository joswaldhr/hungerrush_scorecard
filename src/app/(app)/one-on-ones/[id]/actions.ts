"use server";

import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { meetingNotes, actionItems } from "@/lib/db/schema";
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

export async function saveMeetingNote(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const noteId = formData.get("noteId") as string | null;
  const outcome = (formData.get("outcome") as string) || null;
  const body = (formData.get("body") as string) || null;
  const meetingReferenceId = (formData.get("meetingReferenceId") as string) || null;

  const ctx = await authorizeForEmployee(employeeId);

  if (noteId) {
    await db
      .update(meetingNotes)
      .set({ outcome, body, updatedAt: new Date() })
      .where(and(eq(meetingNotes.id, noteId), eq(meetingNotes.managerUserId, ctx.userId)));
  } else {
    await db.insert(meetingNotes).values({
      employeeId,
      managerUserId: ctx.userId,
      meetingReferenceId,
      outcome,
      body,
    });
  }

  revalidatePath(`/one-on-ones/${employeeId}`);
}

export async function addActionItem(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const title = formData.get("title") as string;
  if (!title?.trim()) return;

  const ctx = await authorizeForEmployee(employeeId);

  await db.insert(actionItems).values({
    employeeId,
    managerUserId: ctx.userId,
    title: title.trim(),
  });

  revalidatePath(`/one-on-ones/${employeeId}`);
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

  revalidatePath(`/one-on-ones/${employeeId}`);
}
