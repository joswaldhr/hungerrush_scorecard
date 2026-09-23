"use server";

import { requireAdmin } from "@/lib/auth/authorization";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { db } from "@/lib/db";
import { employees, teams, teamMemberships } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createEmployee(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const displayName = (formData.get("displayName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const teamId = (formData.get("teamId") as string) || null;

  if (!displayName || !organizationId) return;

  await db.transaction(async (tx) => {
    if (teamId) await assertOrganizationResource(organizationId, "team", teamId, tx);
    const [employee] = await tx
      .insert(employees)
      .values({
        organizationId,
        displayName,
        email,
        jobTitle,
        primaryTeamId: teamId,
      })
      .returning();

    if (teamId && employee) {
      await tx.insert(teamMemberships).values({
        employeeId: employee.id,
        teamId,
        effectiveFrom: new Date().toISOString().split("T")[0]!,
      });
    }
  });

  revalidatePath("/admin/employees");
}

export async function updateEmployee(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  const displayName = (formData.get("displayName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const employmentStatus = formData.get("employmentStatus") as string;

  if (!employeeId || !displayName) return;
  if (!["active", "inactive", "terminated"].includes(employmentStatus))
    throw new Error("Invalid employment status");
  await assertOrganizationResource(organizationId, "employee", employeeId);

  await db
    .update(employees)
    .set({ displayName, email, jobTitle, employmentStatus, updatedAt: new Date() })
    .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)));

  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/employees");
}

export async function setEmployeeTeam(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  const teamId = (formData.get("teamId") as string) || null;
  if (!employeeId) return;

  const today = new Date().toISOString().split("T")[0]!;

  await db.transaction(async (tx) => {
    await assertOrganizationResource(organizationId, "employee", employeeId, tx);
    if (teamId) await assertOrganizationResource(organizationId, "team", teamId, tx);
    // Serialize team changes for the same employee before closing memberships.
    await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
      .for("update");
    await tx
      .update(teamMemberships)
      .set({ effectiveTo: today })
      .where(and(eq(teamMemberships.employeeId, employeeId), isNull(teamMemberships.effectiveTo)));

    if (teamId) {
      await tx.insert(teamMemberships).values({
        employeeId,
        teamId,
        effectiveFrom: today,
      });
    }

    await tx
      .update(employees)
      .set({ primaryTeamId: teamId })
      .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)));
  });

  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/employees");
  revalidatePath("/one-on-ones");
}

export async function createTeam(formData: FormData) {
  const { organizationId } = await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  if (!name || !organizationId) return;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  await db.insert(teams).values({ organizationId, name, slug });

  revalidatePath("/admin/teams");
}
