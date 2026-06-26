import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '@scorecard/shared';

export function useEmployee(employeeId: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (err) {
        setError(err.message);
      } else {
        setEmployee(data as Employee);
      }
      setLoading(false);
    }

    load();
  }, [employeeId]);

  return { employee, loading, error };
}
