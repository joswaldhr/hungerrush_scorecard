import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  real,
  integer,
  jsonb,
  boolean,
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

// ── Metrics ─────────────────────────────────────────────────

export const metricDefinitions = pgTable(
  "metric_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    unit: text("unit"),
    valueType: text("value_type").notNull().default("numeric"),
    direction: text("direction").notNull().default("higher_is_better"),
    aggregationType: text("aggregation_type"),
    calculationType: text("calculation_type").notNull().default("latest"),
    calculationConfigJson: jsonb("calculation_config_json"),
    defaultPeriod: text("default_period").notNull().default("week"),
    sourceStrategy: text("source_strategy"),
    status: text("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("metric_definitions_org_id_idx").on(table.organizationId),
    uniqueIndex("metric_definitions_org_key_version_idx").on(
      table.organizationId,
      table.key,
      table.version
    ),
  ]
);

export const metricAssignments = pgTable(
  "metric_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricDefinitionId: uuid("metric_definition_id")
      .notNull()
      .references(() => metricDefinitions.id),
    teamId: uuid("team_id").references(() => teams.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    roleKey: text("role_key"),
    displayOrder: integer("display_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    visibleOnHome: boolean("visible_on_home").notNull().default(true),
    visibleOnTeam: boolean("visible_on_team").notNull().default(true),
    visibleOnEmployee: boolean("visible_on_employee").notNull().default(true),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("metric_assignments_definition_id_idx").on(table.metricDefinitionId),
    index("metric_assignments_team_id_idx").on(table.teamId),
  ]
);

export const metricTargets = pgTable(
  "metric_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricDefinitionId: uuid("metric_definition_id")
      .notNull()
      .references(() => metricDefinitions.id),
    teamId: uuid("team_id").references(() => teams.id),
    employeeId: uuid("employee_id").references(() => employees.id),
    roleKey: text("role_key"),
    targetType: text("target_type").notNull().default("minimum"),
    targetValue: real("target_value").notNull(),
    warningValue: real("warning_value"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("metric_targets_definition_id_idx").on(table.metricDefinitionId),
    index("metric_targets_team_id_idx").on(table.teamId),
  ]
);

export const metricValues = pgTable(
  "metric_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricDefinitionId: uuid("metric_definition_id")
      .notNull()
      .references(() => metricDefinitions.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    teamId: uuid("team_id").references(() => teams.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    numericValue: real("numeric_value"),
    textValue: text("text_value"),
    calculationVersion: integer("calculation_version").notNull().default(1),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    dataFreshnessAt: timestamp("data_freshness_at", { withTimezone: true }),
    provenanceJson: jsonb("provenance_json"),
    qualityStatus: text("quality_status").notNull().default("complete"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("metric_values_employee_id_idx").on(table.employeeId),
    index("metric_values_definition_id_idx").on(table.metricDefinitionId),
    index("metric_values_period_idx").on(table.periodStart, table.periodEnd),
    uniqueIndex("metric_values_unique_idx").on(
      table.metricDefinitionId,
      table.employeeId,
      table.periodStart,
      table.periodEnd
    ),
  ]
);

export const metricObservations = pgTable(
  "metric_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    metricDefinitionId: uuid("metric_definition_id")
      .notNull()
      .references(() => metricDefinitions.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    observationType: text("observation_type").notNull(),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    explanation: text("explanation"),
    currentValue: real("current_value"),
    comparisonValue: real("comparison_value"),
    targetValue: real("target_value"),
    ruleVersion: integer("rule_version").notNull().default(1),
    evidenceJson: jsonb("evidence_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("metric_observations_employee_id_idx").on(table.employeeId),
    index("metric_observations_definition_id_idx").on(table.metricDefinitionId),
    index("metric_observations_period_idx").on(table.periodStart, table.periodEnd),
  ]
);
