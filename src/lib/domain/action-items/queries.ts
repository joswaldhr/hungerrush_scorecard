import { db } from "@/lib/db";
import { actionItems } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getActionItems(
  ctx: ManagerContext,
  employeeId: string,
  options: { status?: "open" | "done"; limit?: number } = {}
) {
  assertCanAccessEmployee(ctx, employeeId);
  const conditions = [eq(actionItems.employeeId, employeeId)];
  if (options.status) conditions.push(eq(actionItems.status, options.status));

  return db
    .select()
    .from(actionItems)
    .where(and(...conditions))
    .orderBy(desc(actionItems.createdAt))
    .limit(options.limit ?? 50);
}

export async function getOpenActionItemsForManager(ctx: ManagerContext) {
  if (ctx.assignedEmployeeIds.length === 0) return [];
  return db
    .select()
    .from(actionItems)
    .where(
      and(inArray(actionItems.employeeId, ctx.assignedEmployeeIds), eq(actionItems.status, "open"))
    )
    .orderBy(desc(actionItems.createdAt));
}

export async function createActionItem(
  ctx: ManagerContext,
  data: {
    employeeId: string;
    title: string;
    owner?: string;
    priority?: string;
    notes?: string;
    dueDate?: Date;
    meetingNoteId?: string;
  }
) {
  assertCanAccessEmployee(ctx, data.employeeId);
  const [item] = await db
    .insert(actionItems)
    .values({
      employeeId: data.employeeId,
      managerUserId: ctx.userId,
      title: data.title,
      owner: data.owner ?? "employee",
      priority: data.priority ?? "normal",
      notes: data.notes ?? null,
      dueDate: data.dueDate ?? null,
      meetingNoteId: data.meetingNoteId ?? null,
    })
    .returning();
  return item!;
}

export async function updateActionItem(
  ctx: ManagerContext,
  itemId: string,
  data: {
    title?: string;
    owner?: string;
    priority?: string;
    notes?: string;
    status?: string;
    dueDate?: Date | null;
  }
) {
  const [existing] = await db.select().from(actionItems).where(eq(actionItems.id, itemId));
  if (!existing) throw new Error("Action item not found");
  assertCanAccessEmployee(ctx, existing.employeeId);

  const updates: Record<string, unknown> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.owner !== undefined) updates.owner = data.owner;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.status !== undefined) {
    updates.status = data.status;
    updates.completedAt = data.status === "done" ? new Date() : null;
  }

  const [updated] = await db
    .update(actionItems)
    .set(updates)
    .where(eq(actionItems.id, itemId))
    .returning();
  return updated!;
}
