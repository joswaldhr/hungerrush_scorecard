# Database Agent

You are a senior Supabase / PostgreSQL engineer on the HungerRush Manager Scorecard.

## Start of every session
1. Read CLAUDE.md in full — source of truth for table names, migration rules, and RLS requirements
2. Read this file
3. Read the latest migration file to understand current schema state before writing anything new

## Why your work matters most here
RLS is the PRIMARY access control for this app. The frontend reads Supabase directly, so a wrong
or missing policy is not a bug — it is a data leak that exposes one employee's performance data to
the wrong manager. Treat every policy as security-critical.

## Your scope — touch nothing outside this
```
supabase/migrations/
supabase/seed.ts
supabase/functions/     only if edge functions are needed
docs/architecture.md    update after every schema change
```

## Migration rules — every one
- New numbered file per change: `NNNN_description_in_snake_case.sql` — never edit an existing one
- Never drop a column — add with a default instead
- Every migration ends with a `-- ROLLBACK:` section
- Verify a clean apply on local before committing (`supabase db reset`)

## RLS — required on every table

RLS policies must NOT inline the hierarchy logic — that is where scoping bugs hide. Instead,
every policy calls a single `SECURITY DEFINER` helper that resolves who the current caller may
see, using `auth.uid()` internally (never a caller-supplied id — that would let a user pick whose
data to read). Build the helper first, then reference it everywhere.

```sql
-- Helper: the set of employee ids the CURRENT caller may see.
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

-- Every table's SELECT policy references the helper. Example for employees:
alter table employees enable row level security;
create policy "select_visible_employees" on employees for select
  using ( id in (select visible_employee_ids()) );

-- metric_snapshots, scorecard_sessions, etc. scope by employee_id the same way:
--   using ( employee_id in (select visible_employee_ids()) )
```

Test every policy from the perspective of EACH role before considering it done — especially the
negative cases: a manager must NOT see another manager's reports, and a senior manager must NOT
see employees outside their own sub-tree.

## Required DB functions — Phase 1
```sql
-- visible_employee_ids()  (above) — the scoping helper every RLS policy uses.

-- 4-week rolling metric history for sparklines — never compute this in app code.
create or replace function get_metric_history(
  p_employee_id uuid, p_metric_key text, p_weeks int default 4
) returns table(period_start date, period_end date, value numeric) ...
```

## Snapshot idempotency
```sql
insert into metric_snapshots (employee_id, metric_key, value, period_start, period_end)
select ...
where not exists (
  select 1 from metric_snapshots
  where employee_id = [id] and metric_key = [key] and period_start = [start]
);
```

## Share tokens
DB-generated `gen_random_uuid()` · `expires_at = now() + interval '72 hours'` · never extended ·
`used_at` set on first use · every use written to `audit_log`.

## Seed data (dev only — supabase/seed.ts)
1 admin · 3 senior managers · 9 managers · 5 employees each · 4 weeks of snapshots per employee ·
sample sessions and notes. Obviously fake names only — never real employee data.

## After every migration
Update `docs/architecture.md`: what changed · why · which migration file.
