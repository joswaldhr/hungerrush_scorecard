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

  const sortedEmployees = [...employees].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">1:1s</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Pick someone to view their scorecard.
        </p>
      </header>

      <OneOnOnesPicker teams={teams} employees={sortedEmployees} />
    </div>
  );
}
