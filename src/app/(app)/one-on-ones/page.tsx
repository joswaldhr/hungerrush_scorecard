import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getVisibleTeamsForManager,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { EmptyState } from "@/components/empty-state";
import { OneOnOnesPicker } from "@/components/one-on-ones-picker";
import { ShieldAlert, Users } from "lucide-react";

export default async function OneOnOnesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        description="You are not assigned as a manager."
      />
    );
  }

  const employees = await getAssignedEmployees(ctx);
  const teams = await getVisibleTeamsForManager(ctx, employees);
  if (employees.length === 0) {
    return <EmptyState icon={Users} title="No employees" description="No employees assigned." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <header className="cadence-welcome relative overflow-hidden rounded-2xl p-6 text-white sm:p-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
          Your people. A clearer conversation.
        </p>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">1:1s</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-200">
              A week at a glance, one person at a time. Select an employee to review their
              scorecard.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
            <Users className="h-5 w-5 text-teal-200" aria-hidden="true" />
            <span className="text-sm">
              <strong className="font-semibold">{employees.length}</strong> assigned{" "}
              {employees.length === 1 ? "employee" : "employees"}
            </span>
          </div>
        </div>
      </header>

      <OneOnOnesPicker teams={teams} employees={employees} />
    </div>
  );
}
