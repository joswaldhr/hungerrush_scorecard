"use server";

import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, getUserIdByEmail } from "@/lib/auth/authorization";
import { changeManagerArchive } from "@/lib/domain/roster/manager-archive";
import { revalidatePath } from "next/cache";

export async function updateMeetingRoster(_previous: { message: string }, data: FormData) {
  const session = await auth();
  if (!session?.user?.email) return { message: "Please sign in again." };
  const { ctx } = await getEffectiveManagerContext(session.user.email);
  const actorId = await getUserIdByEmail(session.user.email);
  if (!ctx || !actorId) return { message: "Roster access is unavailable. Refresh and try again." };
  try {
    if (data.get("expectedManagerId") !== ctx.userId) throw new Error("Manager context changed");
    const action = data.get("action");
    if (action !== "archive" && action !== "restore") throw new Error("Invalid action");
    const result = await changeManagerArchive({
      organizationId: ctx.organizationId,
      actorId,
      managerId: ctx.userId,
      employeeId: String(data.get("employeeId") ?? ""),
      action,
      reason: String(data.get("reason") ?? ""),
      archiveId: data.get("archiveId") ? String(data.get("archiveId")) : undefined,
    });
    revalidatePath("/one-on-ones", "layout");
    revalidatePath("/data-health");
    return {
      message:
        result.status === "restored"
          ? "Restored to your active 1:1 roster."
          : "Archived from your active 1:1 roster. History is preserved.",
    };
  } catch {
    return {
      message:
        "No change saved. Check your reason (5–500 characters), refresh the roster, and retry.",
    };
  }
}
