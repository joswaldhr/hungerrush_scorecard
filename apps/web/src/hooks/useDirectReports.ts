import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '@scorecard/shared';

export function useDirectReports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesWithMetrics, setEmployeesWithMetrics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [empRes, snapshotRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .order('full_name'),
        supabase
          .from('metric_snapshots')
          .select('employee_id'),
      ]);

      if (empRes.error) {
        setError(empRes.error.message);
      } else {
        setEmployees((empRes.data ?? []) as Employee[]);
      }

      if (snapshotRes.data) {
        const ids = new Set(snapshotRes.data.map((r: { employee_id: string }) => r.employee_id));
        setEmployeesWithMetrics(ids);
      }

      setLoading(false);
    }

    load();
  }, []);

  return { employees, employeesWithMetrics, loading, error };
}
