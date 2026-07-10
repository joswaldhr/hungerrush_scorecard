import { useNavigate } from 'react-router-dom';
import { useManagerRollup } from '../../hooks/useManagerRollup';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';
import { SyncFreshnessChip } from '../../components/SyncFreshnessChip';
import { RollupCard } from './components/RollupCard';
import type { ManagerRollupRow } from '../../hooks/useManagerRollup';

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="animate-pulse bg-white/5 rounded-[18px] border border-white/10 p-6 flex flex-col gap-4"
        >
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-3 bg-white/10 rounded w-1/3" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 bg-white/10 rounded-full w-24" />
            <div className="h-7 bg-white/10 rounded-full w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RollupPage() {
  const { rows, definitions, weekRange, latestSyncedAt, loading, error } = useManagerRollup();
  const navigate = useNavigate();

  const handleOpen = (row: ManagerRollupRow) => {
    const params = new URLSearchParams({ manager: row.manager.id, name: row.manager.full_name });
    navigate(`/scorecard?${params.toString()}`);
  };

  return (
    <AppLayout title="Team rollup">
      <div className="max-w-[1220px] mx-auto px-7 pt-10 pb-16 hr-fade-up">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="font-heading font-extrabold text-[32px] tracking-tight">Team momentum</h1>
            <p className="mt-2 text-[14px] text-[#98A2B8]">
              {weekRange ? `Week of ${weekRange} · ` : ''} 
              aggregate movement across support teams. No rankings — just direction.
            </p>
          </div>
          
          <div className="flex items-center gap-2 h-8 px-3.5 rounded-full bg-[#2BD9BC]/10 border border-[#2BD9BC]/30 text-[#2BD9BC] text-[12.5px] font-semibold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2BD9BC] hr-pulse" />
            <SyncFreshnessChip latestSyncedAt={latestSyncedAt} minimal />
          </div>
        </div>

        {error && <WarnBanner className="mt-6 mb-4">{error}</WarnBanner>}

        <div className="mt-8">
          {loading ? (
            <CardSkeleton />
          ) : rows.length === 0 ? (
            <div className="bg-white/5 rounded-[18px] border border-white/10 p-8 text-center mt-6">
              <p className="text-base text-white mb-1">No managers found in your team.</p>
              <p className="text-base text-[#98A2B8]">
                Your managers&apos; teams appear here once the org sync has run.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-5">
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
        </div>
      </div>
    </AppLayout>
  );
}
