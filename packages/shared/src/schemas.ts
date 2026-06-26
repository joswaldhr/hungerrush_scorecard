import { z } from 'zod';

// --- Enums ---

export const RoleSchema = z.enum(['admin', 'senior_manager', 'manager', 'employee']);
export type Role = z.infer<typeof RoleSchema>;

export const MetricSourceSchema = z.enum(['zendesk', 'assembled', 'forethought']);
export type MetricSource = z.infer<typeof MetricSourceSchema>;

export const MetricDirectionSchema = z.enum(['higher_is_better', 'lower_is_better']);
export type MetricDirection = z.infer<typeof MetricDirectionSchema>;

// --- Core table schemas ---

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  role: RoleSchema,
  manager_id: z.string().uuid().nullable(),
  zendesk_agent_id: z.string().nullable(),
  assembled_agent_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
  full_name: z.string(),
  email: z.string().email(),
  manager_id: z.string().uuid(),
  zendesk_agent_id: z.string().nullable(),
  assembled_agent_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const MetricDefinitionSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  unit: z.string(),
  source: MetricSourceSchema,
  coaching_prompt: z.string(),
  direction: MetricDirectionSchema,
  is_active: z.boolean(),
  display_order: z.number(),
  created_at: z.string(),
});
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const MetricSnapshotSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  metric_key: z.string(),
  value: z.number(),
  period_start: z.string(),
  period_end: z.string(),
  synced_at: z.string(),
  created_at: z.string(),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

export const ScorecardSessionSchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  manager_id: z.string().uuid(),
  session_date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ScorecardSession = z.infer<typeof ScorecardSessionSchema>;

export const SessionNoteSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  content: z.string(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SessionNote = z.infer<typeof SessionNoteSchema>;

export const ShareTokenSchema = z.object({
  id: z.string().uuid(),
  token: z.string().uuid(),
  employee_id: z.string().uuid(),
  created_by: z.string().uuid(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
  created_at: z.string(),
});
export type ShareToken = z.infer<typeof ShareTokenSchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actor_id: z.string().uuid().nullable(),
  action: z.string(),
  resource_type: z.string(),
  resource_id: z.string(),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// --- Query result types ---

export const MetricHistoryPointSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  value: z.number(),
});
export type MetricHistoryPoint = z.infer<typeof MetricHistoryPointSchema>;
