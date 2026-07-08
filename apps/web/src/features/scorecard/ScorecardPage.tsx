import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useRoster } from '../../hooks/useRoster';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';
import { TourModal, useTour } from '../onboarding/TourModal';
import { RosterStrip } from './components/RosterStrip';
import { Briefing } from './components/Briefing';

/**
 * The Cadence home: roster strip for picking the person, 1:1 briefing below.
 * Selection lives in the URL (/scorecard/:employeeId) so briefings stay
 * deep-linkable; landing without a selection auto-picks the first roster
 * member. The ?manager= filter (rollup drill-down) scopes the roster to that
 * manager's FULL team — no with-data filtering, matching the old drill-down.
 */
export function ScorecardPage() {
  const { employeeId } = useParams<{ employeeId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const managerFilter = searchParams.get('manager');
  const managerName = searchParams.get('name');
  const { entries, loading, error } = useRoster(managerFilter);
  const [rosterMode, setRosterMode] = useState<'data' | 'all'>('data');
  const [search, setSearch] = useState('');
  const { showTour, closeTour } = useTour();

  const scoped = entries;
  const withData = useMemo(() => scoped.filter(e => e.hasData), [scoped]);
  const effectiveMode = managerFilter ? 'all' : rosterMode;

  const visible = useMemo(() => {
    let list = effectiveMode === 'data' ? withData : scoped;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        e =>
          e.employee.full_name.toLowerCase().includes(q) ||
          e.employee.email.toLowerCase().includes(q),
      );
    }
    // The selected person always keeps a chip, even when a filter hides them.
    if (employeeId && !list.some(e => e.employee.id === employeeId)) {
      const selected = scoped.find(e => e.employee.id === employeeId);
      if (selected) {
        list = [...list, selected].sort((a, b) =>
          a.employee.full_name.localeCompare(b.employee.full_name),
        );
      }
    }
    return list;
  }, [scoped, withData, effectiveMode, search, employeeId]);

  // Landing without a selection: pick the first roster member.
  useEffect(() => {
    if (!employeeId && !loading && visible.length > 0) {
      navigate(
        { pathname: `/scorecard/${visible[0]!.employee.id}`, search: searchParams.toString() },
        { replace: true },
      );
    }
  }, [employeeId, loading, visible, navigate, searchParams]);

  const handleSelect = (id: string) => {
    navigate({ pathname: `/scorecard/${id}`, search: searchParams.toString() });
  };

  const pillClass = (active: boolean) =>
    active
      ? 'bg-hr-navy text-white text-sm px-3 py-1 rounded-full transition-colors'
      : 'bg-hr-card border border-hr-line text-hr-gray text-sm px-3 py-1 rounded-full hover:bg-hr-bg transition-colors';

  const noneWithData =
    !loading && effectiveMode === 'data' && withData.length === 0 && scoped.length > 0;

  return (
    <AppLayout title="Your team">
      {managerFilter && (
        <div className="bg-hr-teal-tint border border-hr-teal/20 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
          <span className="text-base text-hr-navy font-medium">
            {`Viewing ${managerName ?? 'this manager'}'s team`}
          </span>
          <button
            onClick={() => navigate('/rollup')}
            className="flex items-center gap-1 text-sm text-hr-navy hover:underline"
          >
            <ArrowLeft size={12} />
            Back to rollup
          </button>
        </div>
      )}

      {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

      {!loading && !managerFilter && scoped.length > 1 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input
            type="text"
            placeholder="Search team members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search team members"
            className="w-56 h-8 bg-hr-card border border-hr-line rounded-lg px-3 text-base outline-none focus:border-hr-teal transition-colors"
          />
          {withData.length !== scoped.length && (
            <div className="flex gap-1.5">
              <button onClick={() => setRosterMode('data')} className={pillClass(rosterMode === 'data')}>
                With data ({withData.length})
              </button>
              <button onClick={() => setRosterMode('all')} className={pillClass(rosterMode === 'all')}>
                All ({scoped.length})
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && scoped.length === 0 && !error ? (
        <div className="bg-hr-card rounded-xl border border-hr-line p-8 text-center">
          <p className="text-base text-hr-navy mb-1">No team members found yet.</p>
          <p className="text-base text-hr-gray">
            Ask your admin to run the org sync, or check back once your team has been set up.
          </p>
        </div>
      ) : noneWithData ? (
        <div className="bg-hr-card rounded-xl border border-hr-line p-8 text-center">
          <p className="text-base text-hr-navy mb-1">
            None of your team members have synced metrics yet.
          </p>
          <p className="text-base text-hr-gray">
            Metrics appear after the data sync connects to Zendesk and Assembled.
          </p>
          <button
            onClick={() => setRosterMode('all')}
            className="text-hr-teal-deep text-base mt-3 hover:underline"
          >
            Show all team members
          </button>
        </div>
      ) : !loading && visible.length === 0 && search.trim() ? (
        <div className="bg-hr-card rounded-xl border border-hr-line p-8 text-center">
          <p className="text-base text-hr-gray">No team members match your search.</p>
        </div>
      ) : (
        <RosterStrip
          entries={visible}
          selectedId={employeeId ?? null}
          onSelect={handleSelect}
          loading={loading}
        />
      )}

      {employeeId && <Briefing employeeId={employeeId} />}

      <TourModal open={showTour} onClose={closeTour} />
    </AppLayout>
  );
}
