"use server";

import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { contextItems } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";

const VALID_CONTEXT_TYPES = ["coaching", "quality_review", "attendance", "note"];

export async function addContextNote(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const contextType = formData.get("contextType") as string;
  const title = formData.get("title") as string;
  const summary = (formData.get("summary") as string) || null;

  if (!VALID_CONTEXT_TYPES.includes(contextType)) throw new Error("Invalid context type");
  if (!title?.trim()) return;

  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) throw new Error("No manager context");
  const employees = await getAssignedEmployees(ctx);
  if (!employees.some((e) => e.id === employeeId)) throw new Error("Not authorized");

  await db.insert(contextItems).values({
    organizationId: ctx.organizationId,
    employeeId,
    contextType,
    title: title.trim(),
    summary,
    occurredAt: new Date(),
    visibility: "manager",
  });

  revalidatePath(`/employee/${employeeId}`);
  revalidatePath(`/one-on-ones/${employeeId}`);
}
