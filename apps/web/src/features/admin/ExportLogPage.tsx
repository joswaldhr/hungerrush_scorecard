import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { AppLayout } from '../../components/AppLayout';
import { WarnBanner } from '../../components/WarnBanner';

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
    <div className="bg-white/5 border border-white/10 rounded-[18px] overflow-hidden">
      <div className="animate-pulse p-5 space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-white/10 rounded w-1/4" />
            <div className="h-4 bg-white/10 rounded w-1/4" />
            <div className="h-4 bg-white/10 rounded w-1/4" />
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
      <div className="pb-20 max-w-5xl">
        <p className="text-[14px] text-[#98A2B8] mb-6">
          Scorecard PDF exports with manager and timestamp — showing the latest 100
        </p>

        {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

        {loading ? (
          <TableSkeleton />
        ) : entries.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-xl">
            <p className="text-[16px] text-[#F2F5FA] font-semibold mb-1">No exports yet.</p>
            <p className="text-[14px] text-[#98A2B8]">
              PDF exports will appear here once a manager exports a scorecard.
            </p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-[18px] overflow-x-auto shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.1em] uppercase text-[#5E6980]">Date</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.1em] uppercase text-[#5E6980]">Exported By</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.1em] uppercase text-[#5E6980]">Employee</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5 text-[14px] text-[#F2F5FA]">
                      {format(parseISO(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-5 py-3.5 text-[14px] text-[#F2F5FA]">
                      {entry.actor_email}
                    </td>
                    <td className="px-5 py-3.5 text-[14px] text-[#F2F5FA]">
                      {entry.employee_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
