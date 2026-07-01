import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useDirectReports } from '../../hooks/useDirectReports';
import { TourModal, useTour } from '../onboarding/TourModal';
import { OfflineBanner } from '../../components/OfflineBanner';
import { AppLayout } from '../../components/AppLayout';
import { formatMetricValue } from '../../lib/formatMetric';

export function DashboardPage() {
  const { employees, employeesWithMetrics, previewMetrics, lastSyncedAt, loading, error } = useDirectReports();
  const [showOnlyWithMetrics, setShowOnlyWithMetrics] = useState(true);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'az' | 'recent'>('az');
  const { showTour, closeTour } = useTour();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const managerFilter = searchParams.get('manager');
  const managerName = searchParams.get('name');

  const filteredEmployees = useMemo(() => {
    let list = managerFilter
      ? employees.filter(emp => emp.manager_id === managerFilter)
      : showOnlyWithMetrics
        ? employees.filter(emp => employeesWithMetrics.has(emp.id))
        : employees;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(emp =>
        emp.full_name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q)
      );
    }

    if (sortMode === 'recent') {
      list = [...list].sort((a, b) => {
        const aDate = previewMetrics.get(a.id)?.latestPeriodStart ?? '';
        const bDate = previewMetrics.get(b.id)?.latestPeriodStart ?? '';
        if (bDate !== aDate) return bDate.localeCompare(aDate);
        return a.full_name.localeCompare(b.full_name);
      });
    }

    return list;
  }, [employees, employeesWithMetrics, showOnlyWithMetrics, search, sortMode, previewMetrics, managerFilter]);

  const employeeIds = useMemo(() => filteredEmployees.map(e => e.id), [filteredEmployees]);

  const avgTickets = useMemo(() => {
    const values: number[] = [];
    previewMetrics.forEach(p => {
      if (p.ticket_volume !== null && p.ticket_volume > 0) values.push(p.ticket_volume);
    });
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [previewMetrics]);

  const handleEmployeeClick = (employeeId: string) => {
    navigate(`/scorecard/${employeeId}`, { state: { employeeIds } });
  };

  const pillClass = (active: boolean) =>
    active
      ? 'bg-[#1E2E4A] text-white text-[12px] px-3 py-1 rounded-full transition-colors'
      : 'bg-white border border-[#E8E6E1] text-slate-600 text-[12px] px-3 py-1 rounded-full hover:bg-[#F7F6F3] transition-colors';

  const topActions = !loading && employees.length > 0 ? (
    <>
      <input
        type="text"
        placeholder="Search team members..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-60 h-8 bg-[#F7F6F3] border border-[#E8E6E1] rounded-lg px-3 text-[13px] outline-none focus:border-[#1D9E75] transition-colors"
      />
      <div className="flex gap-1.5">
        {!managerFilter && (
          <>
            <button onClick={() => setShowOnlyWithMetrics(true)} className={pillClass(showOnlyWithMetrics)}>
              Has data ({employeesWithMetrics.size})
            </button>
            <button onClick={() => setShowOnlyWithMetrics(false)} className={pillClass(!showOnlyWithMetrics)}>
              All ({employees.length})
            </button>
          </>
        )}
        <button onClick={() => setSortMode('az')} className={pillClass(sortMode === 'az')}>A-Z</button>
        <button onClick={() => setSortMode('recent')} className={pillClass(sortMode === 'recent')}>Recent</button>
      </div>
    </>
  ) : undefined;

  return (
    <AppLayout title="Your team" actions={topActions}>
      <OfflineBanner />

      {managerFilter && (
        <div className="bg-[#E1F5EE] border border-[#1D9E75]/20 rounded-xl px-4 py-3 flex items-center justify-between mb-5">
          <span className="text-[13px] text-[#0F6E56] font-medium">
            {`Viewing ${managerName ?? 'this manager'}'s team`}
          </span>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-[12px] text-[#0F6E56] hover:underline"
          >
            <ArrowLeft size={12} />
            All teams
          </button>
        </div>
      )}

      {!loading && employees.length > 0 && !managerFilter && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-[#E8E6E1] p-4">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">With metrics</p>
            <p className="text-[20px] font-medium text-slate-800 mt-1">{employeesWithMetrics.size}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E6E1] p-4">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Avg tickets</p>
            <p className="text-[20px] font-medium text-slate-800 mt-1">{avgTickets ?? '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E6E1] p-4">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Last synced</p>
            <p className="text-[13px] font-medium text-slate-800 mt-1">
              {lastSyncedAt ? format(new Date(lastSyncedAt), 'MMM d, h:mm a') : '—'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-[#E8E6E1]">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 px-4 py-3 border-b border-[#F0EEE9] last:border-0">
              <div className="h-8 w-8 bg-slate-100 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate-100 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-8 text-center">
          <p className="text-[13px] text-slate-700 mb-1">No team members found yet.</p>
          <p className="text-[13px] text-slate-400">
            Ask your admin to run the org sync, or check back once your team has been set up.
          </p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-8 text-center">
          {search.trim() ? (
            <p className="text-[13px] text-slate-400 py-8">No team members match your search.</p>
          ) : (
            <>
              <p className="text-[13px] text-slate-700 mb-1">None of your team members have synced metrics yet.</p>
              <p className="text-[13px] text-slate-400">
                Metrics appear after the data sync connects to Zendesk and Assembled.
              </p>
              <button
                onClick={() => setShowOnlyWithMetrics(false)}
                className="text-[#1D9E75] text-[13px] mt-3 hover:underline"
              >
                Show all team members
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8E6E1]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EEE9]">
            <p className="text-[13px] font-medium text-slate-700">All members</p>
            <p className="text-[11px] text-slate-400">{filteredEmployees.length}</p>
          </div>
          {filteredEmployees.map(emp => {
            const hasMetrics = employeesWithMetrics.has(emp.id);
            const preview = previewMetrics.get(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => handleEmployeeClick(emp.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition-colors text-left border-b border-[#F0EEE9] last:border-0"
              >
                <div className="h-8 w-8 bg-[#E1F5EE] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#0F6E56] font-semibold text-sm">
                    {emp.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700">{emp.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{emp.email}</p>
                </div>
                {hasMetrics && preview && (preview.ticket_volume !== null || preview.first_reply_time !== null) ? (
                  <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
                    {preview.ticket_volume !== null && (
                      <div>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Tickets</p>
                        <p className="text-[13px] font-medium text-slate-700">
                          {preview.ticket_volume === 0 ? '—' : formatMetricValue(preview.ticket_volume, 'count')}
                        </p>
                      </div>
                    )}
                    {preview.first_reply_time !== null && (
                      <div>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">First Reply</p>
                        <p className="text-[13px] font-medium text-slate-700">
                          {preview.first_reply_time === 0 ? '—' : formatMetricValue(preview.first_reply_time, 'seconds')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">{hasMetrics ? 'Data' : 'No data'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <TourModal open={showTour} onClose={closeTour} />
    </AppLayout>
  );
}
