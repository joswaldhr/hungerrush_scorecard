import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '@scorecard/shared';

export function useDirectReports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      const { data, error: err } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');

      if (err) {
        setError(err.message);
      } else {
        setEmployees((data ?? []) as Employee[]);
      }
      setLoading(false);
    }

    fetch();
  }, []);

  return { employees, loading, error };
}
