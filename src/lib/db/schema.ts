import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── People ──────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    identityProviderSubject: text("identity_provider_subject"),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_organization_id_idx").on(table.organizationId)]
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    parentTeamId: uuid("parent_team_id").references((): AnyPgColumn => teams.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("teams_organization_id_idx").on(table.organizationId),
    uniqueIndex("teams_org_slug_idx").on(table.organizationId, table.slug),
  ]
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    primaryTeamId: uuid("primary_team_id").references(() => teams.id),
    displayName: text("display_name").notNull(),
    email: text("email"),
    jobTitle: text("job_title"),
    employmentStatus: text("employment_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("employees_organization_id_idx").on(table.organizationId),
    index("employees_primary_team_id_idx").on(table.primaryTeamId),
  ]
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    roleType: text("role_type").notNull().default("member"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("team_memberships_employee_id_idx").on(table.employeeId),
    index("team_memberships_team_id_idx").on(table.teamId),
  ]
);

export const managerAssignments = pgTable(
  "manager_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    managerUserId: uuid("manager_user_id")
      .notNull()
      .references(() => users.id),
    teamId: uuid("team_id").references(() => teams.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    assignmentType: text("assignment_type").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("manager_assignments_user_id_idx").on(table.managerUserId)]
);

// ── Identity / Sources ──────────────────────────────────────

export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    type: text("type").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("configured"),
    configurationReference: text("configuration_reference"),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("data_sources_organization_id_idx").on(table.organizationId)]
);

export const externalIdentities = pgTable(
  "external_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id),
    externalEntityType: text("external_entity_type").notNull(),
    externalId: text("external_id").notNull(),
    externalEmail: text("external_email"),
    externalDisplayName: text("external_display_name"),
    matchMethod: text("match_method").notNull(),
    matchConfidence: real("match_confidence"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("external_identities_employee_id_idx").on(table.employeeId),
    uniqueIndex("external_identities_source_external_idx").on(table.dataSourceId, table.externalId),
  ]
);
