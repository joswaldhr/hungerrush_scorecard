import { OneOnOnesPicker } from "@/components/one-on-ones-picker";
import { requireDemoAccess } from "@/lib/demo/authorization";
import { demoEmployees, demoTeams } from "@/lib/demo/fixtures";

export default async function DemoRosterPage() {
  await requireDemoAccess();
  return (
    <>
      <header>
        <p className="text-sm font-medium text-primary">Your team, ready for a conversation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">1:1s</h1>
        <p className="mt-2 text-muted-foreground">
          Choose an employee to review last week, compare trends, or check this week’s progress.
        </p>
      </header>
      <OneOnOnesPicker employees={demoEmployees} teams={demoTeams} basePath="/demo/one-on-ones" />
    </>
  );
}
