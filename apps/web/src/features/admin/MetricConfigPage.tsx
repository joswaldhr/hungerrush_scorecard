import { useState } from 'react';
import { useMetricDefinitions, type MetricUpdates } from '../../hooks/useMetricDefinitions';
import { MetricCard } from './components/MetricCard';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';

function MetricCardSkeleton() {
  return (
    <div className="animate-pulse bg-hr-card rounded-xl border border-hr-line p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-4 w-24 bg-hr-line/60 rounded" />
          <div className="h-4 w-16 bg-hr-line/60 rounded-full" />
        </div>
        <div className="h-6 w-11 bg-hr-line/60 rounded-full" />
      </div>
      <div className="h-8 bg-hr-line/60 rounded w-full" />
      <div className="h-20 bg-hr-line/60 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-8 bg-hr-line/60 rounded" />
        <div className="h-4 bg-hr-line/60 rounded w-2/3" />
        <div className="h-4 bg-hr-line/60 rounded w-2/3" />
      </div>
    </div>
  );
}

// Access control: AuthGuard in App.tsx gates this route to admin (S6).
export function MetricConfigPage() {
  const { metrics, loading, error, updateMetric } = useMetricDefinitions();
  // Save feedback lives on the card's own button — a page-top banner alone was how
  // S4's broken saves looked successful with the card below the fold.
  const [saveState, setSaveState] = useState<{ id: string; state: 'saving' | 'saved' | 'error' } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (id: string, updates: MetricUpdates) => {
    setSaveState({ id, state: 'saving' });
    setSaveError(null);
    const result = await updateMetric(id, updates);
    if (result.ok) {
      setSaveState({ id, state: 'saved' });
    } else {
      setSaveError(result.error ?? 'Failed to save');
      setSaveState({ id, state: 'error' });
    }
    setTimeout(() => setSaveState(current => (current?.id === id ? null : current)), 3000);
  };

  return (
    <AppLayout title="Metrics">
      <p className="text-[13px] text-hr-gray mb-6">
        Configure which metrics appear on scorecards, their display names, and coaching prompts.
        Toggling a metric off also stops its collection at the next sync.
      </p>

      {saveError && <WarnBanner className="mb-4">{saveError}</WarnBanner>}
      {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="bg-hr-card rounded-xl border border-hr-line p-8 text-center">
          <p className="text-[13px] text-hr-navy mb-1">No metric definitions found.</p>
          <p className="text-[13px] text-hr-gray">
            Run the sync job or seed the database with metric definitions to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map(metric => (
            <MetricCard
              key={metric.id}
              metric={metric}
              saveState={saveState?.id === metric.id ? saveState.state : 'idle'}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
