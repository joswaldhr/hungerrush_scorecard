-- 0013_session_action_items.sql
-- Adds a structured action items table for 1:1 scorecard sessions.
-- Each action item tracks content + completion state, scoped by session.

-- =============================================================================
-- TABLE
-- =============================================================================

create table session_action_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references scorecard_sessions(id) on delete cascade,
  content      text not null,
  is_completed boolean not null default false,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- RLS (same pattern as session_notes — scope via scorecard_sessions)
-- =============================================================================

alter table session_action_items enable row level security;

create policy "action_items_select_visible" on session_action_items for select
  using (
    session_id in (
      select id from scorecard_sessions where employee_id in (select visible_employee_ids())
    )
  );

create policy "action_items_insert_own" on session_action_items for insert
  with check (
    created_by = auth.uid()
    and session_id in (
      select id from scorecard_sessions where manager_id = auth.uid()
    )
  );

create policy "action_items_update_own" on session_action_items for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- =============================================================================
-- GRANTs
-- =============================================================================

grant select, insert, update on session_action_items to authenticated;
grant all on session_action_items to service_role;

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "action_items_update_own" on session_action_items;
-- drop policy if exists "action_items_insert_own" on session_action_items;
-- drop policy if exists "action_items_select_visible" on session_action_items;
-- drop table if exists session_action_items;
-- =============================================================================
