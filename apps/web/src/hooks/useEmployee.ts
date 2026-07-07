import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '@scorecard/shared';

export function useEmployee(employeeId: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  }, [employeeId]);

  useEffect(() => {
    // New employeeId: drop the previous employee's data so an error can't
    // strand the wrong person on screen. A failed same-key refetch keeps data.
    setEmployee(null);
    load();
  }, [load]);

  return { employee, loading, error, refetch: load };
}
