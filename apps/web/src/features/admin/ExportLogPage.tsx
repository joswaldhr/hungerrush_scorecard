import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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

// Access control: AuthGuard in App.tsx gates this route to admin (S6).
export function ExportLogPage() {
  const [entries, setEntries] = useState<ExportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const logsRes = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', 'pdf_export')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsRes.error) {
        setError(logsRes.error.message);
        setLoading(false);
        return;
      }

      const logs = (logsRes.data ?? []) as ExportLogEntry[];

      // Enrichment lookups bounded to the ids actually shown (S8) — previously
      // fetched every profile and employee in the org for 100 rows.
      const actorIds = [...new Set(logs.map(l => l.actor_id).filter((id): id is string => id !== null))];
      const employeeIds = [...new Set(logs.map(l => l.resource_id))];

      const [profilesRes, employeesRes] = await Promise.all([
        actorIds.length > 0
          ? supabase.from('profiles').select('id, email').in('id', actorIds)
          : Promise.resolve({ data: [] }),
        employeeIds.length > 0
          ? supabase.from('employees').select('id, full_name').in('id', employeeIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map(
        ((profilesRes.data ?? []) as Array<{ id: string; email: string }>).map(p => [p.id, p.email]),
      );
      const employeeMap = new Map(
        ((employeesRes.data ?? []) as Array<{ id: string; full_name: string }>).map(e => [e.id, e.full_name]),
      );

      const enriched: ExportLogEntry[] = logs.map(row => ({
        ...row,
        actor_email: row.actor_id ? profileMap.get(row.actor_id) ?? 'Unknown' : 'Unknown',
        employee_name: employeeMap.get(row.resource_id) ?? 'Unknown',
      }));

      setEntries(enriched);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppLayout title="Export log">
      <p className="text-[13px] text-slate-500 mb-6">
        Scorecard PDF exports with manager and timestamp — showing the latest 100
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
