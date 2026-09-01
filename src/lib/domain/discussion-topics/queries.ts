import { db } from "@/lib/db";
import { discussionTopics, employees } from "@/lib/db/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getDiscussionTopics(
  ctx: ManagerContext,
  employeeId: string,
  options: { status?: string; limit?: number } = {}
) {
  assertCanAccessEmployee(ctx, employeeId);

  const [employee] = await db
    .select({ primaryTeamId: employees.primaryTeamId })
    .from(employees)
    .where(eq(employees.id, employeeId));
  const teamId = employee?.primaryTeamId ?? null;

  const conditions = [
    or(
      eq(discussionTopics.employeeId, employeeId),
      ...(teamId
        ? [and(eq(discussionTopics.teamId, teamId), isNull(discussionTopics.employeeId))]
        : [])
    ),
  ];
  if (options.status) conditions.push(eq(discussionTopics.status, options.status));

  return db
    .select()
    .from(discussionTopics)
    .where(and(...conditions))
    .orderBy(desc(discussionTopics.createdAt))
    .limit(options.limit ?? 50);
}

export async function createDiscussionTopic(
  ctx: ManagerContext,
  data: {
    title: string;
    notes?: string;
    employeeId?: string;
    teamId?: string;
    source?: string;
  }
) {
  if (data.employeeId) assertCanAccessEmployee(ctx, data.employeeId);
  const [topic] = await db
    .insert(discussionTopics)
    .values({
      organizationId: ctx.organizationId,
      employeeId: data.employeeId ?? null,
      teamId: data.teamId ?? null,
      managerUserId: ctx.userId,
      title: data.title,
      notes: data.notes ?? null,
      source: data.source ?? "manager",
    })
    .returning();
  return topic!;
}

export async function markTopicDiscussed(
  ctx: ManagerContext,
  topicId: string,
  meetingNoteId?: string
) {
  const [updated] = await db
    .update(discussionTopics)
    .set({
      status: "discussed",
      discussedAt: new Date(),
      meetingNoteId: meetingNoteId ?? null,
    })
    .where(eq(discussionTopics.id, topicId))
    .returning();
  return updated!;
}

export async function updateTopicStatus(
  _ctx: ManagerContext,
  topicId: string,
  status: string
) {
  const [updated] = await db
    .update(discussionTopics)
    .set({ status })
    .where(eq(discussionTopics.id, topicId))
    .returning();
  return updated!;
}
