import { useState } from 'react';
import { useMetricDefinitions, type MetricUpdates } from '../../hooks/useMetricDefinitions';
import { MetricCard } from './components/MetricCard';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';

function MetricCardSkeleton() {
  return (
    <div className="animate-pulse bg-white/5 border border-white/10 rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.3)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-3.5 w-24 bg-white/10 rounded" />
          <div className="h-3.5 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-5 w-9 bg-white/10 rounded-full" />
      </div>
      <div className="h-8 bg-white/10 rounded" />
      <div className="h-12 bg-white/10 rounded" />
      <div className="flex items-center gap-6 pt-1">
        <div className="h-6 w-24 bg-white/10 rounded" />
        <div className="h-3.5 w-20 bg-white/10 rounded" />
        <div className="h-3.5 w-28 bg-white/10 rounded" />
        <div className="h-7 w-16 bg-white/10 rounded-lg ml-auto" />
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
      <div className="max-w-3xl pb-20">
        <p className="text-[14px] text-[#98A2B8] leading-[1.6] mb-6">
          Configure which metrics appear on scorecards, their display names, and coaching
          prompts. Toggling a metric off also stops its collection at the next sync.
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
          <div className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-xl mx-auto">
            <p className="text-[16px] text-[#F2F5FA] font-semibold mb-1">No metric definitions found.</p>
            <p className="text-[14px] text-[#98A2B8]">
              Run the sync job or seed the database with metric definitions to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
      </div>
    </AppLayout>
  );
}
