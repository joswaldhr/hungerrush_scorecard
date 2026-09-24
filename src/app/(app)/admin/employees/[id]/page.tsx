import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { getAdminEmployeeDetail } from "@/lib/domain/roster/admin-queries";
import Link from "next/link";
import { updateEmployee, setEmployeeTeam } from "../../roster-actions";

export default async function AdminEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const detail = await getAdminEmployeeDetail(admin.organizationId, id);
  if (!detail) notFound();
  const { employee, allTeams, currentMembership, currentManager } = detail;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:text-foreground">
        ← All employees
      </Link>

      <header>
        <h1 className="text-xl font-semibold text-foreground">{employee.displayName}</h1>
      </header>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <form action={updateEmployee} className="space-y-3">
          <input type="hidden" name="employeeId" value={employee.id} />
          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Name
            </label>
            <input
              id="displayName"
              name="displayName"
              defaultValue={employee.displayName}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={employee.email ?? ""}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label
              htmlFor="jobTitle"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Job title
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              defaultValue={employee.jobTitle ?? ""}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label
              htmlFor="employmentStatus"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Employment status
            </label>
            <select
              id="employmentStatus"
              name="employmentStatus"
              defaultValue={employee.employmentStatus}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
          >
            Save
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Team</h2>
        <p className="text-xs text-muted-foreground">
          Manager assignment follows the team —{" "}
          {currentManager
            ? `currently managed by ${currentManager.displayName}`
            : "this team has no manager assigned yet"}
          .
        </p>
        {employee.line && (
          <p className="text-xs text-muted-foreground">
            Current line: {employee.line}. Changing teams clears this team-specific line.
          </p>
        )}
        <form action={setEmployeeTeam} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="employeeId" value={employee.id} />
          <div>
            <select
              aria-label="Employee team"
              name="teamId"
              defaultValue={currentMembership?.teamId ?? ""}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">Unassigned</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
          >
            Update team
          </button>
        </form>
      </section>
    </div>
  );
}
