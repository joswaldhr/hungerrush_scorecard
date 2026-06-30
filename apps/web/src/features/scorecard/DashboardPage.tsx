import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDirectReports } from '../../hooks/useDirectReports';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { TourModal, useTour } from '../onboarding/TourModal';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { OfflineBanner } from '../../components/OfflineBanner';
import { formatMetricValue } from '../../lib/formatMetric';

function EmployeeSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4 bg-white rounded-lg">
      <div className="h-10 w-10 bg-slate-200 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/4" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const { employees, employeesWithMetrics, previewMetrics, lastSyncedAt, loading, error } = useDirectReports();
  const [showOnlyWithMetrics, setShowOnlyWithMetrics] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'az' | 'recent'>('az');
  const { showTour, openTour, closeTour } = useTour();
  const { canInstall, install } = useInstallPrompt();
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const managerFilter = searchParams.get('manager');
  const managerName = searchParams.get('name');

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const role = session?.user?.app_metadata?.['role'] as string | undefined;
  const showRollup = role === 'senior_manager' || role === 'admin';
  const showAdmin = role === 'admin';

  const employeeIds = useMemo(() => filteredEmployees.map(e => e.id), [filteredEmployees]);

  const handleEmployeeClick = (employeeId: string) => {
    navigate(`/scorecard/${employeeId}`, { state: { employeeIds } });
  };

  return (
    <div className="min-h-screen bg-hr-gray">
      <OfflineBanner />
      <nav className="bg-hr-navy text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Manager Scorecard</h1>

        <div className="hidden sm:flex items-center gap-4">
          {showRollup && (
            <Link
              to="/rollup"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Team Rollup
            </Link>
          )}
          {showAdmin && (
            <Link
              to="/admin/metrics"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Admin
            </Link>
          )}
          {canInstall && (
            <button
              onClick={install}
              className="text-sm text-slate-300 hover:text-white transition-colors"
              aria-label="Install app"
            >
              Install app
            </button>
          )}
          <button
            onClick={openTour}
            className="h-6 w-6 rounded-full border border-slate-400 text-slate-300 hover:text-white hover:border-white text-xs font-bold transition-colors"
            aria-label="Show tour"
          >
            ?
          </button>
          <span className="text-sm text-slate-300">{session?.user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-300 hover:text-white transition-colors"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>

        <div className="sm:hidden relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 text-slate-300 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-hr-navy rounded-lg shadow-lg border border-slate-600 py-2 z-50">
              {showRollup && (
                <Link
                  to="/rollup"
                  className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
                  onClick={() => setMenuOpen(false)}
                >
                  Team Rollup
                </Link>
              )}
              {showAdmin && (
                <Link
                  to="/admin/metrics"
                  className="block px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              {(showRollup || showAdmin) && <div className="border-t border-slate-600 my-1" />}
              {canInstall && (
                <button
                  onClick={() => { setMenuOpen(false); install(); }}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  Install app
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); openTour(); }}
                className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Help tour
              </button>
              <span className="block px-4 py-2 text-xs text-slate-400 truncate">
                {session?.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6 sm:p-8">
        {managerFilter && (
          <div className="bg-[#E1F5EE] border-b border-[#9FE1CB] px-4 py-2 text-sm flex items-center justify-between mb-4">
            <span className="text-[#0F6E56] font-medium">
              {`Viewing ${managerName ?? 'this manager'}'s team`}
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-[#0F6E56] hover:underline"
            >
              ← All teams
            </button>
          </div>
        )}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Your Team</h2>
            {!loading && employees.length > 0 && !managerFilter && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOnlyWithMetrics(true)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    showOnlyWithMetrics
                      ? 'bg-hr-green text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Has metrics ({employeesWithMetrics.size})
                </button>
                <button
                  onClick={() => setShowOnlyWithMetrics(false)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    !showOnlyWithMetrics
                      ? 'bg-hr-navy text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  All ({employees.length})
                </button>
              </div>
            )}
          </div>
          {lastSyncedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Last synced {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>

        {!loading && employees.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-hr-green focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortMode('az')}
                className={`text-sm px-3 py-1 rounded-full transition-colors ${
                  sortMode === 'az'
                    ? 'bg-[#1E2E4A] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                A-Z
              </button>
              <button
                onClick={() => setSortMode('recent')}
                className={`text-sm px-3 py-1 rounded-full transition-colors ${
                  sortMode === 'recent'
                    ? 'bg-[#1E2E4A] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Recent
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <EmployeeSkeleton key={i} />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center">
            {employees.length === 0 ? (
              <>
                <p className="text-slate-500 mb-2">No team members found yet.</p>
                <p className="text-sm text-slate-400">
                  Ask your admin to run the org sync, or check back once your team
                  has been set up.
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-500 mb-2">None of your team members have synced metrics yet.</p>
                <p className="text-sm text-slate-400">
                  Metrics appear after the data sync connects to Zendesk and Assembled.
                </p>
                <button
                  onClick={() => setShowOnlyWithMetrics(false)}
                  className="text-hr-green text-sm mt-3 hover:underline"
                >
                  Show all team members
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEmployees.map((emp) => {
              const hasMetrics = employeesWithMetrics.has(emp.id);
              const preview = previewMetrics.get(emp.id);
              return (
                <button
                  key={emp.id}
                  onClick={() => handleEmployeeClick(emp.id)}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-sm transition-shadow text-left"
                >
                  <div className="h-10 w-10 bg-hr-green-light rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-hr-green font-medium text-lg">
                      {emp.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">{emp.full_name}</p>
                    <p className="text-sm text-slate-500 truncate">{emp.email}</p>
                  </div>
                  {hasMetrics && preview && (preview.ticket_volume !== null || preview.first_reply_time !== null) ? (
                    <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
                      {preview.ticket_volume !== null && (
                        <div>
                          <p className="text-xs text-slate-400">Tickets</p>
                          <p className="text-sm font-medium text-slate-800">{preview.ticket_volume === 0 ? '—' : formatMetricValue(preview.ticket_volume, 'count')}</p>
                        </div>
                      )}
                      {preview.first_reply_time !== null && (
                        <div>
                          <p className="text-xs text-slate-400">First Reply</p>
                          <p className="text-sm font-medium text-slate-800">{preview.first_reply_time === 0 ? '—' : formatMetricValue(preview.first_reply_time, 'seconds')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2" title={hasMetrics ? 'Metrics synced' : 'No data source connected'}>
                      <span className={`h-2.5 w-2.5 rounded-full ${hasMetrics ? 'bg-hr-green' : 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-400">{hasMetrics ? 'Data' : 'No data'}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <TourModal open={showTour} onClose={closeTour} />
    </div>
  );
}
