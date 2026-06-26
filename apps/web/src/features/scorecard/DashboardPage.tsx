import { Link } from 'react-router-dom';
import { useDirectReports } from '../../hooks/useDirectReports';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

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
  const { employees, loading, error } = useDirectReports();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Manager Scorecard</h1>
        <div className="flex items-center gap-4">
          {session?.user?.app_metadata?.['role'] === 'admin' && (
            <Link
              to="/admin/metrics"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Metrics Config
            </Link>
          )}
          <span className="text-sm text-slate-300">{session?.user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-300 hover:text-white transition-colors"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-xl font-bold text-hr-navy mb-6">Your Team</h2>

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
        ) : employees.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center">
            <p className="text-slate-500 mb-2">No team members found yet.</p>
            <p className="text-sm text-slate-400">
              Ask your admin to run the org sync, or check back once your team
              has been set up.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((emp) => (
              <Link
                key={emp.id}
                to={`/scorecard/${emp.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="h-10 w-10 bg-hr-green-light rounded-full flex items-center justify-center">
                  <span className="text-hr-green font-medium text-lg">
                    {emp.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-hr-navy">{emp.full_name}</p>
                  <p className="text-sm text-slate-500">{emp.email}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
