import type { RosterEntry } from '../../../hooks/useRoster';
import { getInitials } from '../../../lib/initials';

const AV = [
  'linear-gradient(135deg, #0E8476, #2BD9BC)',
  'linear-gradient(135deg, #35508C, #7DA2F5)',
  'linear-gradient(135deg, #6C5CE7, #A29BFE)',
  'linear-gradient(135deg, #B8763A, #E9B454)',
  'linear-gradient(135deg, #0E8476, #35508C)',
  'linear-gradient(135deg, #2BB3D9, #7DE8F5)',
  'linear-gradient(135deg, #8C5A35, #E8845F)',
  'linear-gradient(135deg, #2E9E5B, #7FDCA4)',
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AV[Math.abs(hash) % AV.length];
}

function ChipSkeleton() {
  return (
    <div className="flex-shrink-0 flex items-center gap-[10px] h-12 px-4 pl-2 rounded-full border border-white/5 bg-white/5 animate-pulse min-w-[180px]">
      <div className="w-[34px] h-[34px] rounded-full bg-white/10 flex-shrink-0" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 bg-white/10 rounded w-2/3" />
        <div className="h-2 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

export function RosterStrip({
  entries,
  selectedId,
  onSelect,
  loading,
}: {
  entries: RosterEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-[10px] overflow-x-auto pb-3 pt-1.5 mb-2" role="group" aria-label="Your team">
      {loading
        ? Array.from({ length: 4 }, (_, i) => <ChipSkeleton key={i} />)
        : entries.map(entry => {
            const active = entry.employee.id === selectedId;
            const shortTitle = (entry.employee.title || 'Team Member')
              .replace('Support Specialist', 'Specialist')
              .replace('Senior Specialist', 'Sr. Specialist');
            
            const rowBg = active ? 'rgba(43,217,188,0.1)' : 'rgba(255,255,255,0.035)';
            const rowBorder = active ? 'rgba(43,217,188,0.5)' : 'rgba(255,255,255,0.08)';
            const ring = active ? '0 0 0 2px rgba(43,217,188,0.6), 0 0 16px rgba(43,217,188,0.35)' : 'none';
            const nameColor = active ? '#F2F5FA' : '#B9C1D2';
            
            return (
              <button
                key={entry.employee.id}
                onClick={() => onSelect(entry.employee.id)}
                aria-label={`${entry.employee.full_name}, ${shortTitle}`}
                aria-current={active ? 'true' : undefined}
                className="flex-shrink-0 flex items-center gap-[10px] h-12 pr-4 pl-2 rounded-full cursor-pointer transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-[#2BD9BC]/55"
                style={{ background: rowBg, border: `1px solid ${rowBorder}` }}
              >
                <div 
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: getGradient(entry.employee.id), boxShadow: ring }}
                >
                  {getInitials(entry.employee.full_name)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-[13px] font-semibold whitespace-nowrap truncate" style={{ color: nameColor }}>
                    {entry.employee.full_name}
                  </div>
                  <div className="text-[11px] text-[#6B7690] whitespace-nowrap truncate">
                    {shortTitle}
                  </div>
                </div>
              </button>
            );
          })}
    </div>
  );
}
