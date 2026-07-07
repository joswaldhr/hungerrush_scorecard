import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MetricDefinition } from '@scorecard/shared';

// The one MetricUpdates definition (D9) — MetricConfigPage and MetricCard import it from here.
export type MetricUpdates = Pick<MetricDefinition, 'name' | 'coaching_prompt' | 'display_order' | 'is_active'>;

export function useMetricDefinitions() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('metric_definitions')
      .select('*')
      .order('display_order');

    if (err) {
      setError(err.message);
    } else {
      setMetrics((data ?? []) as MetricDefinition[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateMetric = useCallback(
    async (id: string, updates: MetricUpdates): Promise<{ ok: boolean; error?: string }> => {
      const { error: err } = await supabase
        .from('metric_definitions')
        .update(updates)
        .eq('id', id);

      if (err) return { ok: false, error: err.message };

      setMetrics(prev =>
        prev
          .map(m => (m.id === id ? { ...m, ...updates } : m))
          .sort((a, b) => a.display_order - b.display_order),
      );

      return { ok: true };
    },
    [],
  );

  return { metrics, loading, error, refetch: load, updateMetric };
}
