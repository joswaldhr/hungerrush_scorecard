"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { employees, teams, teamMemberships } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !(await isPlatformAdmin(session.user.email))) {
    redirect("/");
  }
}

export async function createEmployee(formData: FormData) {
  await requireAdmin();

  const displayName = (formData.get("displayName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const teamId = (formData.get("teamId") as string) || null;
  const organizationId = formData.get("organizationId") as string;

  if (!displayName || !organizationId) return;

  const [employee] = await db
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
    await db.insert(teamMemberships).values({
      employeeId: employee.id,
      teamId,
      effectiveFrom: new Date().toISOString().split("T")[0]!,
    });
  }

  revalidatePath("/admin/employees");
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  const displayName = (formData.get("displayName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const employmentStatus = formData.get("employmentStatus") as string;

  if (!employeeId || !displayName) return;

  await db
    .update(employees)
    .set({ displayName, email, jobTitle, employmentStatus, updatedAt: new Date() })
    .where(eq(employees.id, employeeId));

  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/employees");
}

export async function setEmployeeTeam(formData: FormData) {
  await requireAdmin();

  const employeeId = formData.get("employeeId") as string;
  const teamId = (formData.get("teamId") as string) || null;
  if (!employeeId) return;

  const today = new Date().toISOString().split("T")[0]!;

  await db
    .update(teamMemberships)
    .set({ effectiveTo: today })
    .where(and(eq(teamMemberships.employeeId, employeeId), isNull(teamMemberships.effectiveTo)));

  if (teamId) {
    await db.insert(teamMemberships).values({
      employeeId,
      teamId,
      effectiveFrom: today,
    });
  }

  await db.update(employees).set({ primaryTeamId: teamId }).where(eq(employees.id, employeeId));

  revalidatePath(`/admin/employees/${employeeId}`);
  revalidatePath("/admin/employees");
  revalidatePath("/team");
}

export async function createTeam(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const organizationId = formData.get("organizationId") as string;
  if (!name || !organizationId) return;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  await db.insert(teams).values({ organizationId, name, slug });

  revalidatePath("/admin/teams");
}
