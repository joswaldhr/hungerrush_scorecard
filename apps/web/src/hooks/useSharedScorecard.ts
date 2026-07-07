import { useState, useEffect, useCallback } from 'react';
import type { MetricDefinition } from '@scorecard/shared';

export type SharedErrorType = 'expired' | 'not_found' | 'network';

interface SharedSnapshot {
  metric_key: string;
  value: number;
  period_start: string;
  period_end: string;
  synced_at: string;
}

interface SharedEmployee {
  full_name: string;
  email: string;
}

export interface SharedScorecardData {
  employee: SharedEmployee;
  definitions: MetricDefinition[];
  snapshots: SharedSnapshot[];
}

export function useSharedScorecard(token: string) {
  const [data, setData] = useState<SharedScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SharedErrorType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    const apiUrl = import.meta.env.VITE_API_URL as string;
    if (!apiUrl) {
      setError('Application is not configured correctly.');
      setErrorType('network');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/share/${encodeURIComponent(token)}`);

      if (res.status === 410) {
        const body = await res.json() as { error: string };
        setError(body.error);
        setErrorType('expired');
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        const body = await res.json() as { error: string };
        setError(body.error);
        setErrorType('not_found');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('Something went wrong loading this scorecard.');
        setErrorType('network');
        setLoading(false);
        return;
      }

      const json = await res.json() as SharedScorecardData;
      setData(json);
      setLoading(false);
    } catch {
      setError('Unable to connect. Check your internet connection and try again.');
      setErrorType('network');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, errorType, refetch: load };
}
