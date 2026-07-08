import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Newest metric_snapshots.synced_at the caller can see (RLS scopes it) — the
 * app-header freshness chip reads this on every screen. One-row read; null
 * until anything visible has synced. A failed refetch keeps the last good
 * stamp (S5), so a transient probe error never blanks the chip.
 */
export function useDataFreshness() {
  const [latestSyncedAt, setLatestSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('metric_snapshots')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setLatestSyncedAt((data as { synced_at: string } | null)?.synced_at ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { latestSyncedAt, loading, error, refetch: load };
}
