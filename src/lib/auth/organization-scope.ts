import { db } from "@/lib/db";
import { employees, teams, users, metricDefinitions, dataSources } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const resources = {
  employee: employees,
  team: teams,
  user: users,
  metric: metricDefinitions,
  source: dataSources,
};

/** Validate related IDs as well as the final mutation's ownership predicate. */
export async function assertOrganizationResource(
  organizationId: string,
  resource: keyof typeof resources,
  id: string,
  connection: Pick<typeof db, "select"> = db
): Promise<void> {
  const table = resources[resource];
  const [row] = await connection
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.organizationId, organizationId)))
    .limit(1);
  if (!row) throw new Error("Resource not found or not permitted");
}

export function organizationSourceIds(organizationId: string) {
  return db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.organizationId, organizationId));
}

export function organizationMetricIds(organizationId: string) {
  return db
    .select({ id: metricDefinitions.id })
    .from(metricDefinitions)
    .where(eq(metricDefinitions.organizationId, organizationId));
}
