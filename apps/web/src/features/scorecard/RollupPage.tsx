import { useNavigate } from 'react-router-dom';
import { useManagerRollup } from '../../hooks/useManagerRollup';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';
import { RollupCard } from './components/RollupCard';
import type { ManagerRollupRow } from '../../hooks/useManagerRollup';

function CardSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="animate-pulse bg-hr-card rounded-xl border border-hr-line p-4 flex items-center gap-4"
        >
          <div className="w-56 flex-shrink-0 space-y-2">
            <div className="h-3.5 bg-hr-line/60 rounded w-2/3" />
            <div className="h-2.5 bg-hr-line/60 rounded w-1/2" />
          </div>
          <div className="flex-1 flex gap-1.5">
            <div className="h-5 bg-hr-line/60 rounded-full w-28" />
            <div className="h-5 bg-hr-line/60 rounded-full w-32" />
          </div>
          <div className="h-8 bg-hr-line/60 rounded w-20 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Access control: AuthGuard in App.tsx gates this route to senior_manager/executive/admin (S6).
export function RollupPage() {
  const { rows, definitions, weekRange, loading, error } = useManagerRollup();
  const navigate = useNavigate();

  const subtitleText =
    rows.length > 0
      ? `${rows.length} manager${rows.length === 1 ? '' : 's'}${weekRange ? ` · ${weekRange}` : ''}`
      : undefined;

  const handleOpen = (row: ManagerRollupRow) => {
    const params = new URLSearchParams({ manager: row.manager.id, name: row.manager.full_name });
    navigate(`/scorecard?${params.toString()}`);
  };

  return (
    <AppLayout title="Team rollup" subtitle={subtitleText}>
      {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

      {loading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <div className="bg-hr-card rounded-xl border border-hr-line p-8 text-center">
          <p className="text-base text-hr-navy mb-1">No managers found in your team.</p>
          <p className="text-base text-hr-gray">
            Your managers&apos; teams appear here once the org sync has run.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(row => (
            <RollupCard
              key={row.manager.id}
              row={row}
              definitions={definitions}
              onOpen={() => handleOpen(row)}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
