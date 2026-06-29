import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface ExportLogEntry {
  id: string;
  actor_id: string | null;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_email?: string;
  employee_name?: string;
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="animate-pulse p-4 space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExportLogPage() {
  const { session, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<ExportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [logsRes, profilesRes, employeesRes] = await Promise.all([
        supabase
          .from('audit_log')
          .select('*')
          .eq('action', 'pdf_export')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('profiles')
          .select('id, email'),
        supabase
          .from('employees')
          .select('id, full_name'),
      ]);

      if (logsRes.error) {
        setError(logsRes.error.message);
        setLoading(false);
        return;
      }

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: { id: string; email: string }) => [p.id, p.email]),
      );
      const employeeMap = new Map(
        (employeesRes.data ?? []).map((e: { id: string; full_name: string }) => [e.id, e.full_name]),
      );

      const enriched: ExportLogEntry[] = (logsRes.data ?? []).map((row: ExportLogEntry) => ({
        ...row,
        actor_email: row.actor_id ? profileMap.get(row.actor_id) ?? 'Unknown' : 'Unknown',
        employee_name: employeeMap.get(row.resource_id) ?? 'Unknown',
      }));

      setEntries(enriched);
      setLoading(false);
    }

    load();
  }, []);

  if (authLoading) return <TableSkeleton />;
  if (!session) return <Navigate to="/login" replace />;

  const role = session.user.app_metadata?.['role'] as string | undefined;
  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold">Export Log</h1>
        </div>
        <span className="text-sm text-slate-300">{session.user.email}</span>
      </nav>

      <main className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-hr-navy">PDF Export History</h2>
          <p className="text-sm text-slate-500 mt-1">
            All scorecard PDF exports with manager and timestamp
          </p>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : entries.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center">
            <p className="text-slate-500 mb-2">No exports yet.</p>
            <p className="text-sm text-slate-400">
              PDF exports will appear here once a manager exports a scorecard.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-sm font-semibold text-hr-navy">Date</th>
                  <th className="px-4 py-3 text-sm font-semibold text-hr-navy">Exported By</th>
                  <th className="px-4 py-3 text-sm font-semibold text-hr-navy">Employee</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {format(parseISO(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.actor_email}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.employee_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
