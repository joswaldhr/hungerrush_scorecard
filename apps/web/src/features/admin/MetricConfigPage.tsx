import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMetricDefinitions } from '../../hooks/useMetricDefinitions';
import { MetricCard } from './components/MetricCard';
import type { MetricDefinition } from '@scorecard/shared';

type MetricUpdates = Pick<MetricDefinition, 'name' | 'coaching_prompt' | 'display_order' | 'is_active'>;

function MetricCardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="h-6 w-11 bg-slate-200 rounded-full" />
      </div>
      <div className="h-8 bg-slate-200 rounded w-full" />
      <div className="h-20 bg-slate-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-8 bg-slate-200 rounded" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export function MetricConfigPage() {
  const { session, loading: authLoading } = useAuth();
  const { metrics, loading, error, updateMetric } = useMetricDefinitions();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-64">
          <div className="h-6 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!session || session.user.app_metadata?.['role'] !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSave = async (id: string, updates: MetricUpdates) => {
    setSavingId(id);
    setSaveError(null);
    const result = await updateMetric(id, updates);
    if (!result.ok) {
      setSaveError(result.error ?? 'Failed to save');
    }
    setSavingId(null);
  };

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold">Metric Configuration</h1>
        </div>
        <span className="hidden sm:inline text-sm text-slate-300">{session.user.email}</span>
      </nav>

      <main className="max-w-4xl mx-auto p-6 sm:p-8">
        <p className="text-slate-500 mb-6">
          Configure which metrics appear on scorecards, their display names, and coaching prompts.
        </p>

        {saveError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4">
            {saveError}
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center">
            <p className="text-slate-500 mb-2">No metric definitions found.</p>
            <p className="text-sm text-slate-400">
              Run the sync job or seed the database with metric definitions to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {metrics.map(metric => (
              <MetricCard
                key={metric.id}
                metric={metric}
                saving={savingId === metric.id}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
