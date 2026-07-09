import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Employee } from '@scorecard/shared';

export function useEmployee(employeeId: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Fetch generation (external review): only the newest fetch may commit
  // state — a slow response for the outgoing person must not put their name
  // back on screen after a switch. See useEmployeeMetrics.
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (generationRef.current !== generation) return;

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
