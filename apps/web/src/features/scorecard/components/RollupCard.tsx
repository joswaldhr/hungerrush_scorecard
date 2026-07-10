import { METRIC_SPECS, type MetricDefinition } from '@scorecard/shared';
import type { ManagerRollupRow, MetricToneCounts } from '../../../lib/rollup';
import { getInitials } from '../../../lib/initials';

function chipClass(counts: MetricToneCounts): { bg: string, border: string, color: string } {
  if (counts.discuss > 0) return { bg: 'rgba(233,180,84,0.1)', border: 'rgba(233,180,84,0.35)', color: '#E9B454' }; // Amber
  if (counts.win > 0) return { bg: 'rgba(43,217,188,0.1)', border: 'rgba(43,217,188,0.35)', color: '#2BD9BC' }; // Jade
  return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', color: '#98A2B8' }; // Neutral
}

function chipText(counts: MetricToneCounts, label: string): string {
  const parts: string[] = [];
  if (counts.win > 0) parts.push(`${counts.win} improving`);
  if (counts.discuss > 0) parts.push(`${counts.discuss} to discuss`);
  if (parts.length === 0) return counts.steady > 0 ? `${label} steady` : `${label} tracking`;
  return parts.join(' · ');
}

function ToneChip({ label, counts }: { label: string; counts: MetricToneCounts }) {
  const style = chipClass(counts);
  return (
    <div 
      className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-semibold"
      style={{ backgroundColor: style.bg, borderColor: style.border, color: style.color, borderWidth: '1px' }}
    >
      {counts.win > 0 ? '📈 ' : counts.discuss > 0 ? '🎯 ' : ''}
      {chipText(counts, label)}
    </div>
  );
}

function Stat({ label, val, delta, deltaColor }: { label: string, val: string, delta: string, deltaColor: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold tracking-wider uppercase text-[#6B7690]">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-heading font-bold text-[20px]">{val}</span>
        <span className="text-[12px] font-semibold" style={{ color: deltaColor }}>{delta}</span>
      </div>
    </div>
  );
}

export function RollupCard({
  row,
  definitions,
  onOpen,
}: {
  row: ManagerRollupRow;
  definitions: MetricDefinition[];
  onOpen: () => void;
}) {
  const chips = definitions.filter(d => row.tones[d.key]);
  
  // Decide the glow based on the overall tone
  const glow = row.toDiscuss > 0 ? 'rgba(233,180,84,0.22)' : 'rgba(43,217,188,0.25)';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative overflow-hidden rounded-[18px] p-6 pt-7 text-left outline-none transition-all duration-250 ease-out hover:-translate-y-[3px] focus-visible:ring-2 focus-visible:ring-[#2BD9BC]"
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
        border: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(22px)',
        boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
      }}
    >
      <div 
        className="absolute -top-[60px] -right-[60px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
      />
      
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-heading font-bold text-[19px] tracking-tight">{row.manager.full_name}</div>
          <div className="mt-1 text-[13px] text-[#98A2B8]">
            {row.employeeCount} people
            {row.inactiveCount > 0 ? ` · ${row.inactiveCount} inactive` : ''}
          </div>
        </div>
      </div>

      <div className="mt-[18px] flex flex-wrap gap-2">
        {chips.length > 0 ? (
          chips.slice(0, 3).map(def => (
            <ToneChip
              key={def.key}
              label={METRIC_SPECS[def.key]?.shortLabel ?? def.name}
              counts={row.tones[def.key]!}
            />
          ))
        ) : (
          <span className="text-xs text-[#98A2B8]">Building history...</span>
        )}
      </div>

      <div className="mt-5 pt-[18px] border-t border-white/10 grid grid-cols-2 gap-3">
        <Stat 
          label="Wins" 
          val={row.wins.toString()} 
          delta="" 
          deltaColor="#2BD9BC" 
        />
        <Stat 
          label="To Discuss" 
          val={row.toDiscuss.toString()} 
          delta="" 
          deltaColor={row.toDiscuss > 0 ? "#E9B454" : "#6B7690"} 
        />
      </div>
    </button>
  );
}
