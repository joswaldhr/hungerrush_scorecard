import { db } from "@/lib/db";
import { contextItems } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";

export async function getEmployeeContext(ctx: ManagerContext, employeeId: string, limit = 20) {
  assertCanAccessEmployee(ctx, employeeId);
  return db
    .select()
    .from(contextItems)
    .where(and(eq(contextItems.employeeId, employeeId), eq(contextItems.visibility, "manager")))
    .orderBy(desc(contextItems.occurredAt))
    .limit(limit);
}
