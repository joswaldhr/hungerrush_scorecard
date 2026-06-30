import { useState, useEffect } from 'react';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { Profile, Employee, MetricSnapshot, MetricDefinition } from '@scorecard/shared';

export interface MetricTrend {
  improving: number;
  declining: number;
  total: number;
  direction: string;
}

export interface ManagerRollupRow {
  manager: Profile;
  employeeCount: number;
  trends: Record<string, MetricTrend>;
}

export function useManagerRollup() {
  const [rows, setRows] = useState<ManagerRollupRow[]>([]);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastMonday = subWeeks(thisMonday, 1);
      const thisMondayStr = format(thisMonday, 'yyyy-MM-dd');
      const lastMondayStr = format(lastMonday, 'yyyy-MM-dd');

      const [managersRes, employeesRes, definitionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('employees')
          .select('id, manager_id'),
        supabase
          .from('metric_definitions')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
      ]);

      if (managersRes.error) {
        setError(managersRes.error.message);
        setLoading(false);
        return;
      }
      if (employeesRes.error) {
        setError(employeesRes.error.message);
        setLoading(false);
        return;
      }
      if (definitionsRes.error) {
        setError(definitionsRes.error.message);
        setLoading(false);
        return;
      }

      const managers = (managersRes.data ?? []) as Profile[];
      const employees = (employeesRes.data ?? []) as Pick<Employee, 'id' | 'manager_id'>[];
      const defs = (definitionsRes.data ?? []) as MetricDefinition[];

      // Only keep profiles that actually manage employees
      const managerIds = new Set(employees.map(e => e.manager_id));
      const activeManagers = managers.filter(m => managerIds.has(m.id));

      if (activeManagers.length === 0) {
        setDefinitions(defs);
        setRows([]);
        setLoading(false);
        return;
      }

      // Group employees by manager
      const employeesByManager = new Map<string, string[]>();
      for (const emp of employees) {
        const list = employeesByManager.get(emp.manager_id) ?? [];
        list.push(emp.id);
        employeesByManager.set(emp.manager_id, list);
      }

      // Fetch snapshots for current and last week
      const allEmployeeIds = employees.map(e => e.id);
      const snapshotsRes = await supabase
        .from('metric_snapshots')
        .select('employee_id, metric_key, value, period_start')
        .in('employee_id', allEmployeeIds)
        .in('period_start', [thisMondayStr, lastMondayStr]);

      if (snapshotsRes.error) {
        setError(snapshotsRes.error.message);
        setLoading(false);
        return;
      }

      const snapshots = (snapshotsRes.data ?? []) as Pick<MetricSnapshot, 'employee_id' | 'metric_key' | 'value' | 'period_start'>[];

      // Index snapshots: employeeId -> metricKey -> { thisWeek, lastWeek }
      const snapshotIndex = new Map<string, Map<string, { thisWeek: number | null; lastWeek: number | null }>>();
      for (const s of snapshots) {
        let byMetric = snapshotIndex.get(s.employee_id);
        if (!byMetric) {
          byMetric = new Map();
          snapshotIndex.set(s.employee_id, byMetric);
        }
        let entry = byMetric.get(s.metric_key);
        if (!entry) {
          entry = { thisWeek: null, lastWeek: null };
          byMetric.set(s.metric_key, entry);
        }
        if (s.period_start === thisMondayStr) {
          entry.thisWeek = s.value;
        } else if (s.period_start === lastMondayStr) {
          entry.lastWeek = s.value;
        }
      }

      // Build direction lookup
      const directionByKey = new Map(defs.map(d => [d.key, d.direction]));

      // Compute rollup rows
      const result: ManagerRollupRow[] = activeManagers.map(manager => {
        const empIds = employeesByManager.get(manager.id) ?? [];
        const trends: Record<string, MetricTrend> = {};

        for (const def of defs) {
          let improving = 0;
          let declining = 0;
          let total = 0;

          for (const empId of empIds) {
            const byMetric = snapshotIndex.get(empId);
            const entry = byMetric?.get(def.key);
            if (!entry || entry.thisWeek === null || entry.lastWeek === null) continue;

            total++;
            const direction = directionByKey.get(def.key);
            const diff = entry.thisWeek - entry.lastWeek;

            if (diff === 0) continue;

            const isImproving = direction === 'higher_is_better' ? diff > 0 : diff < 0;
            if (isImproving) {
              improving++;
            } else {
              declining++;
            }
          }

          trends[def.key] = { improving, declining, total, direction: def.direction };
        }

        return { manager, employeeCount: empIds.length, trends };
      });

      result.sort((a, b) => {
        const aChips = Object.values(a.trends).filter(t => t.total > 0).length;
        const bChips = Object.values(b.trends).filter(t => t.total > 0).length;
        if (aChips !== bChips) return bChips - aChips;
        return a.manager.full_name.localeCompare(b.manager.full_name);
      });

      if (snapshots.length > 0) {
        const sunday = new Date(thisMonday.getTime());
        sunday.setDate(sunday.getDate() + 6);
        const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        setWeekRange(`Week of ${dateFmt.format(thisMonday)} – ${dateFmt.format(sunday)}`);
      }

      setDefinitions(defs);
      setRows(result);
      setLoading(false);
    }

    load();
  }, []);

  return { rows, definitions, weekRange, loading, error };
}
