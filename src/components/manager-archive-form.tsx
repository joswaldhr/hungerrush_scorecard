"use client";

import { useActionState } from "react";
import { updateMeetingRoster } from "@/app/(app)/one-on-ones/roster/actions";

export function ManagerArchiveForm({
  managerId,
  employeeId,
  employeeName,
  archiveId,
}: {
  managerId: string;
  employeeId: string;
  employeeName: string;
  archiveId?: string;
}) {
  const [state, action, pending] = useActionState(updateMeetingRoster, { message: "" });
  const verb = archiveId ? "Restore" : "Archive";
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="expectedManagerId" value={managerId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="action" value={archiveId ? "restore" : "archive"} />
      {archiveId && <input type="hidden" name="archiveId" value={archiveId} />}
      <label className="block text-xs text-muted-foreground" htmlFor={`reason-${employeeId}`}>
        Reason for {verb.toLowerCase()} (required)
      </label>
      <input
        id={`reason-${employeeId}`}
        name="reason"
        required
        minLength={5}
        maxLength={500}
        disabled={pending}
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
        placeholder={archiveId ? "Confirmed return to my roster" : "Confirmed no longer on my team"}
      />
      <button
        disabled={pending}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        aria-label={`${verb} ${employeeName} ${archiveId ? "to" : "from"} your active 1:1 roster`}
      >
        {pending ? "Saving…" : `${verb} ${archiveId ? "to" : "from"} my roster`}
      </button>
      <p role="status" className="text-sm text-muted-foreground">
        {state.message}
      </p>
    </form>
  );
}
