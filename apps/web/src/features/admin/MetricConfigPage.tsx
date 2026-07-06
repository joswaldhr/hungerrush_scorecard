import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMetricDefinitions, type MetricUpdates } from '../../hooks/useMetricDefinitions';
import { MetricCard } from './components/MetricCard';
import { AppLayout } from '../../components/AppLayout';

function MetricCardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl border border-[#E8E6E1] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="h-4 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-6 w-11 bg-slate-100 rounded-full" />
      </div>
      <div className="h-8 bg-slate-100 rounded w-full" />
      <div className="h-20 bg-slate-100 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-8 bg-slate-100 rounded" />
        <div className="h-4 bg-slate-100 rounded w-2/3" />
        <div className="h-4 bg-slate-100 rounded w-2/3" />
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
      <AppLayout title="Metrics">
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      </AppLayout>
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
    <AppLayout title="Metrics">
      <p className="text-[13px] text-slate-500 mb-6">
        Configure which metrics appear on scorecards, their display names, and coaching prompts.
      </p>

      {saveError && (
        <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
          {saveError}
        </div>
      )}

      {error && (
        <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
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
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-12 text-center">
          <p className="text-[13px] text-slate-700 mb-2">No metric definitions found.</p>
          <p className="text-[13px] text-slate-400">
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
    </AppLayout>
  );
}
