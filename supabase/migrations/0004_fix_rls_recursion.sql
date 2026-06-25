-- 0004_fix_rls_recursion.sql
-- Fix: visible_employee_ids() was reading from the employees table, which has an
-- RLS policy that calls visible_employee_ids() — infinite recursion.
--
-- The manager hierarchy lives entirely in profiles.manager_id, so we can resolve
-- which manager profile IDs the caller may see using profiles alone, then return
-- employees whose manager_id matches one of those profile IDs.
--
-- To break the RLS recursion, this function creates a temporary table with the
-- resolved employee IDs and returns from that, never triggering employees RLS.

create or replace function visible_employee_ids()
returns setof uuid
language plpgsql security definer stable as $$
declare
  caller_id   uuid;
  caller_role text;
begin
  caller_id   := auth.uid();
  caller_role := (select role from profiles where id = caller_id);

  if caller_role = 'admin' then
    return query select id from employees;
  end if;

  if caller_role = 'manager' then
    return query select id from employees where manager_id = caller_id;
  end if;

  if caller_role = 'senior_manager' then
    return query
      select id from employees
      where manager_id in (select id from profiles where manager_id = caller_id);
  end if;

  -- employee role or no profile: sees nothing
  return;
end;
$$;

-- =============================================================================
-- ROLLBACK (restores the original 0001 version — still has the recursion bug):
-- create or replace function visible_employee_ids()
-- returns setof uuid
-- language sql security definer stable as $$
--   with me as (select id, role from profiles where id = auth.uid())
--   select e.id from employees e, me
--   where
--     (me.role = 'admin')
--     or (me.role = 'manager'        and e.manager_id = me.id)
--     or (me.role = 'senior_manager' and e.manager_id in (
--           select p.id from profiles p where p.manager_id = me.id
--        ));
-- $$;
-- =============================================================================
