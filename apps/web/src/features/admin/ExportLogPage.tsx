import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { AppLayout } from '../../components/AppLayout';

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
    <div className="bg-white rounded-xl border border-[#E8E6E1] overflow-hidden">
      <div className="animate-pulse p-4 space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/4" />
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

  if (authLoading) {
    return (
      <AppLayout title="Export log">
        <TableSkeleton />
      </AppLayout>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const role = session.user.app_metadata?.['role'] as string | undefined;
  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout title="Export log">
      <p className="text-[13px] text-slate-500 mb-6">
        All scorecard PDF exports with manager and timestamp
      </p>

      {error && (
        <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-12 text-center">
          <p className="text-[13px] text-slate-700 mb-2">No exports yet.</p>
          <p className="text-[13px] text-slate-400">
            PDF exports will appear here once a manager exports a scorecard.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8E6E1] overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E8E6E1]">
                <th className="px-4 py-3 text-[10px] font-semibold tracking-widest uppercase text-slate-400">Date</th>
                <th className="px-4 py-3 text-[10px] font-semibold tracking-widest uppercase text-slate-400">Exported By</th>
                <th className="px-4 py-3 text-[10px] font-semibold tracking-widest uppercase text-slate-400">Employee</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-[#F0EEE9] last:border-0 hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-4 py-3 text-[13px] text-slate-700">
                    {format(parseISO(entry.created_at), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-700">
                    {entry.actor_email}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-700">
                    {entry.employee_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
