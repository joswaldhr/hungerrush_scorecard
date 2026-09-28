import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorecardBody } from "@/components/scorecard-body";
import { requireDemoAccess } from "@/lib/demo/authorization";
import { demoEmployees, demoTeams, demoRows } from "@/lib/demo/fixtures";
import { resolveReportingWeek } from "@/lib/utils";
import { getDemoWeekMetrics } from "./actions";

export default async function DemoScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  await requireDemoAccess();
  const { id } = await params;
  const employee = demoEmployees.find((item) => item.id === id);
  if (!employee) notFound();
  const { week } = await searchParams;
  const periodStart = resolveReportingWeek(typeof week === "string" ? week : undefined);
  return (
    <>
      <Link
        href="/demo/one-on-ones"
        className="text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        ← Back to 1:1s
      </Link>
      <ScorecardBody
        employeeId={id}
        employeeName={employee.displayName}
        employeeJobTitle={employee.jobTitle}
        teamName={demoTeams.find((team) => team.id === employee.primaryTeamId)!.name}
        managerName="Adam Seow"
        initialPeriodStart={periodStart}
        initialRows={demoRows(id, periodStart)}
        loadWeekAction={getDemoWeekMetrics}
        basePath="/demo/one-on-ones"
      />
    </>
  );
}
