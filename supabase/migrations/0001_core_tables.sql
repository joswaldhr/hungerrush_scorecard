-- 0001_core_tables.sql
-- Creates all 8 core tables, the role enum, the visible_employee_ids() scoping
-- helper, RLS policies on every table, and the get_metric_history() function.

-- =============================================================================
-- ENUM
-- =============================================================================

create type user_role as enum ('admin', 'senior_manager', 'manager', 'employee');
create type metric_source as enum ('zendesk', 'assembled', 'forethought');
create type metric_direction as enum ('higher_is_better', 'lower_is_better');

-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles: every system user (managers, senior managers, admins, employees with accounts)
-- id matches auth.users.id so auth.uid() works directly.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null default 'employee',
  manager_id  uuid references profiles(id),
  zendesk_agent_id   text,
  assembled_agent_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- employees: people being coached. manager_id points to a profile (the manager).
create table employees (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id),
  full_name   text not null,
  email       text not null,
  manager_id  uuid not null references profiles(id),
  zendesk_agent_id   text,
  assembled_agent_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- metric_definitions: the catalog of metrics (source, unit, coaching prompt, direction)
create table metric_definitions (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  name            text not null,
  unit            text not null,
  source          metric_source not null,
  coaching_prompt text not null default '',
  direction       metric_direction not null default 'higher_is_better',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- metric_snapshots: frozen weekly metric values per employee
create table metric_snapshots (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id),
  metric_key    text not null references metric_definitions(key),
  value         numeric not null,
  period_start  date not null,
  period_end    date not null,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (employee_id, metric_key, period_start)
);

-- scorecard_sessions: 1:1 session records between a manager and an employee
create table scorecard_sessions (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id),
  manager_id    uuid not null references profiles(id),
  session_date  date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- session_notes: notes written during a 1:1 session
create table session_notes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references scorecard_sessions(id) on delete cascade,
  content     text not null default '',
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- share_tokens: read-only sharing links (72h expiry, single-use)
create table share_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null unique default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  created_by  uuid not null references profiles(id),
  expires_at  timestamptz not null default (now() + interval '72 hours'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- audit_log: all sensitive actions (share token use, admin changes, etc.)
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles(id),
  action        text not null,
  resource_type text not null,
  resource_id   text not null,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- SCOPING HELPER — the single source of truth for who can see which employees
-- =============================================================================

-- visible_employee_ids(): returns the set of employee ids the CURRENT caller may see.
-- managers  -> their own direct reports
-- senior    -> the reports of the managers who report to them (ONE level down, not all)
-- admin     -> everyone
-- Uses auth.uid() directly. SECURITY DEFINER so it can read profiles regardless of caller RLS.
create or replace function visible_employee_ids()
returns setof uuid
language sql security definer stable as $$
  with me as (select id, role from profiles where id = auth.uid())
  select e.id from employees e, me
  where
    (me.role = 'admin')
    or (me.role = 'manager'        and e.manager_id = me.id)
    or (me.role = 'senior_manager' and e.manager_id in (
          select p.id from profiles p where p.manager_id = me.id
       ));
$$;

-- =============================================================================
-- get_metric_history(): 4-week rolling metric history for sparklines
-- =============================================================================

create or replace function get_metric_history(
  p_employee_id uuid, p_metric_key text, p_weeks int default 4
)
returns table(period_start date, period_end date, value numeric)
language sql stable security definer as $$
  select ms.period_start, ms.period_end, ms.value
  from metric_snapshots ms
  where ms.employee_id = p_employee_id
    and ms.metric_key = p_metric_key
    and ms.employee_id in (select visible_employee_ids())
  order by ms.period_start desc
  limit p_weeks;
$$;

-- =============================================================================
-- RLS — enabled on every table, policies reference visible_employee_ids()
-- =============================================================================

-- profiles -------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select
  using (id = auth.uid());

create policy "profiles_select_visible" on profiles for select
  using (id in (select manager_id from employees where id in (select visible_employee_ids())));

create policy "profiles_update_own" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all" on profiles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- employees ------------------------------------------------------------------
alter table employees enable row level security;

create policy "employees_select_visible" on employees for select
  using (id in (select visible_employee_ids()));

create policy "employees_admin_all" on employees for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- metric_definitions ---------------------------------------------------------
alter table metric_definitions enable row level security;

create policy "metric_definitions_select_authenticated" on metric_definitions for select
  using (auth.uid() is not null);

create policy "metric_definitions_admin_all" on metric_definitions for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- metric_snapshots -----------------------------------------------------------
alter table metric_snapshots enable row level security;

create policy "metric_snapshots_select_visible" on metric_snapshots for select
  using (employee_id in (select visible_employee_ids()));

create policy "metric_snapshots_admin_insert" on metric_snapshots for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- scorecard_sessions ---------------------------------------------------------
alter table scorecard_sessions enable row level security;

create policy "scorecard_sessions_select_visible" on scorecard_sessions for select
  using (employee_id in (select visible_employee_ids()));

create policy "scorecard_sessions_insert_manager" on scorecard_sessions for insert
  with check (
    manager_id = auth.uid()
    and employee_id in (select visible_employee_ids())
  );

create policy "scorecard_sessions_update_own" on scorecard_sessions for update
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

-- session_notes --------------------------------------------------------------
alter table session_notes enable row level security;

create policy "session_notes_select_visible" on session_notes for select
  using (
    session_id in (
      select id from scorecard_sessions where employee_id in (select visible_employee_ids())
    )
  );

create policy "session_notes_insert_own" on session_notes for insert
  with check (
    created_by = auth.uid()
    and session_id in (
      select id from scorecard_sessions where manager_id = auth.uid()
    )
  );

create policy "session_notes_update_own" on session_notes for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- share_tokens ---------------------------------------------------------------
alter table share_tokens enable row level security;

create policy "share_tokens_select_own" on share_tokens for select
  using (created_by = auth.uid());

create policy "share_tokens_insert_manager" on share_tokens for insert
  with check (
    created_by = auth.uid()
    and employee_id in (select visible_employee_ids())
  );

-- audit_log ------------------------------------------------------------------
alter table audit_log enable row level security;

create policy "audit_log_admin_select" on audit_log for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "audit_log_admin_insert" on audit_log for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));


-- =============================================================================
-- ROLLBACK:
-- drop function if exists get_metric_history(uuid, text, int);
-- drop function if exists visible_employee_ids();
-- drop policy if exists "audit_log_admin_insert" on audit_log;
-- drop policy if exists "audit_log_admin_select" on audit_log;
-- drop policy if exists "share_tokens_insert_manager" on share_tokens;
-- drop policy if exists "share_tokens_select_own" on share_tokens;
-- drop policy if exists "session_notes_update_own" on session_notes;
-- drop policy if exists "session_notes_insert_own" on session_notes;
-- drop policy if exists "session_notes_select_visible" on session_notes;
-- drop policy if exists "scorecard_sessions_update_own" on scorecard_sessions;
-- drop policy if exists "scorecard_sessions_insert_manager" on scorecard_sessions;
-- drop policy if exists "scorecard_sessions_select_visible" on scorecard_sessions;
-- drop policy if exists "metric_snapshots_admin_insert" on metric_snapshots;
-- drop policy if exists "metric_snapshots_select_visible" on metric_snapshots;
-- drop policy if exists "metric_definitions_admin_all" on metric_definitions;
-- drop policy if exists "metric_definitions_select_authenticated" on metric_definitions;
-- drop policy if exists "employees_admin_all" on employees;
-- drop policy if exists "employees_select_visible" on employees;
-- drop policy if exists "profiles_admin_all" on profiles;
-- drop policy if exists "profiles_update_own" on profiles;
-- drop policy if exists "profiles_select_visible" on profiles;
-- drop policy if exists "profiles_select_own" on profiles;
-- drop table if exists audit_log;
-- drop table if exists share_tokens;
-- drop table if exists session_notes;
-- drop table if exists scorecard_sessions;
-- drop table if exists metric_snapshots;
-- drop table if exists metric_definitions;
-- drop table if exists employees;
-- drop table if exists profiles;
-- drop type if exists metric_direction;
-- drop type if exists metric_source;
-- drop type if exists user_role;
-- =============================================================================
