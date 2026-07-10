import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  // The ONE person-switch path (roster clicks and arrow keys both land here).
  const selectPerson = useCallback(
    (id: string) => {
      if (id === employeeId) return;
      navigate({ pathname: `/scorecard/${id}`, search: searchParams.toString() });
    },
    [employeeId, navigate, searchParams],
  );

  // Keyboard basics (QoL): '/' focuses the roster search, ←/→ step through
  // the visible roster (via selectPerson, so the unsaved-note guard applies),
  // Esc clears the search. Plain window listener; it never acts while the
  // user is typing — '/' in the notes textarea must not steal focus, and an
  // arrow keypress mid-sentence must not switch people. Esc inside the search
  // box itself is the input's own handler below, not this listener.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === '/') {
        if (searchRef.current) {
          e.preventDefault();
          searchRef.current.focus();
        }
      } else if (e.key === 'Escape') {
        setSearch('');
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && visible.length > 0) {
        const idx = visible.findIndex(entry => entry.employee.id === employeeId);
        const step = e.key === 'ArrowRight' ? 1 : -1;
        // Clamp at the ends (no wrap); an unknown selection starts at the front.
        const next = idx === -1 ? 0 : Math.min(Math.max(idx + step, 0), visible.length - 1);
        if (next !== idx) {
          e.preventDefault();
          selectPerson(visible[next]!.employee.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, employeeId, selectPerson]);

  const pillClass = (active: boolean) =>
    active
      ? 'bg-white/10 text-white text-[13px] font-medium px-3 py-1.5 rounded-full border border-white/10 transition-colors shadow-glass'
      : 'bg-transparent text-[#6B7690] text-[13px] font-medium px-3 py-1.5 rounded-full border border-transparent hover:text-[#98A2B8] hover:bg-white/5 transition-colors';

  const noneWithData =
    !loading && effectiveMode === 'data' && withData.length === 0 && scoped.length > 0;

  return (
    <AppLayout title="Your team">
      {managerFilter && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-4 mt-6 backdrop-blur-md"
        >
          <span className="text-[14px] text-white font-medium">
            {`Viewing ${managerName ?? 'this manager'}'s team`}
          </span>
          <button
            onClick={() => navigate('/rollup')}
            className="flex items-center gap-1 text-[13px] text-[#98A2B8] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to rollup
          </button>
        </motion.div>
      )}

      {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

      {!loading && !managerFilter && scoped.length > 1 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 mb-3 mt-6 flex-wrap"
        >
          <input
            ref={searchRef}
            type="text"
            placeholder="Search team members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('');
            }}
            aria-label="Search team members"
            className="w-64 h-9 bg-white/5 border border-white/10 rounded-[10px] px-3.5 text-[13.5px] text-white placeholder:text-[#6B7690] outline-none focus:border-[#2BD9BC]/50 focus:bg-white/10 focus:ring-2 focus:ring-[#2BD9BC]/20 transition-all shadow-glass"
          />
          {withData.length !== scoped.length && (
            <div className="flex gap-1.5 ml-2">
              <button onClick={() => setRosterMode('data')} className={pillClass(rosterMode === 'data')}>
                With data ({withData.length})
              </button>
              <button onClick={() => setRosterMode('all')} className={pillClass(rosterMode === 'all')}>
                All ({scoped.length})
              </button>
            </div>
          )}
        </motion.div>
      )}

      {!loading && scoped.length === 0 && !error ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-xl mx-auto mt-10 backdrop-blur-md shadow-glass"
        >
          <p className="text-[16px] text-[#F2F5FA] font-semibold mb-1">No team members found yet.</p>
          <p className="text-[14px] text-[#98A2B8]">
            Ask your admin to run the org sync, or check back once your team has been set up.
          </p>
        </motion.div>
      ) : noneWithData ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-xl mx-auto mt-10 backdrop-blur-md shadow-glass"
        >
          <p className="text-[16px] text-[#F2F5FA] font-semibold mb-1">
            None of your team members have synced metrics yet.
          </p>
          <p className="text-[14px] text-[#98A2B8]">
            Metrics appear after the data sync connects to Zendesk and Assembled.
          </p>
          <button
            onClick={() => setRosterMode('all')}
            className="text-[#2BD9BC] text-[14px] font-semibold mt-4 hover:text-[#6FEAD6] transition-colors"
          >
            Show all team members
          </button>
        </motion.div>
      ) : !loading && visible.length === 0 && search.trim() ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-xl mx-auto mt-10 backdrop-blur-md shadow-glass"
        >
          <p className="text-[14px] text-[#98A2B8]">No team members match your search.</p>
        </motion.div>
      ) : (
        <RosterStrip
          entries={visible}
          selectedId={employeeId ?? null}
          onSelect={selectPerson}
          loading={loading}
        />
      )}

      {employeeId && <Briefing employeeId={employeeId} />}

      <TourModal open={showTour} onClose={closeTour} />
    </AppLayout>
  );
}
