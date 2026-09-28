"use server";
import { requireDemoAccess } from "@/lib/demo/authorization";
import { demoRows } from "@/lib/demo/fixtures";
import { resolveReportingWeek } from "@/lib/utils";

export async function getDemoWeekMetrics(employeeId: string, periodStart: string) {
  await requireDemoAccess();
  return demoRows(employeeId, resolveReportingWeek(periodStart));
}
