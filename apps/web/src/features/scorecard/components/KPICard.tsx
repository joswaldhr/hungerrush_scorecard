import { formatMetricValue } from '../../../lib/formatMetric';
import type { EvidenceMetric } from '../../../lib/evidence';

function MetricSparkline({ slots, target, goodDir }: { slots: (number | null)[]; target: number | null; goodDir: 'higher_is_better' | 'lower_is_better' | 'band' }) {
  // A simple placeholder sparkline for now, since we don't have a charting library handy.
  // Cadence mockup has an SVG sparkline, we'll draw a basic polyline
  const max = Math.max(...slots.filter(v => v !== null) as number[], target || 0, 1);
  const min = 0; // Assuming 0-based metrics for simple sparkline
  
  const width = 200;
  const height = 40;
  
  const points = slots.map((val, i) => {
    if (val === null) return null;
    const x = (i / (Math.max(1, slots.length - 1))) * width;
    const y = height - ((val - min) / (max - min)) * height;
    return `${x},${y}`;
  });

  const validPoints = points.filter(Boolean).join(' ');

  return (
    <div className="mt-[18px] h-[50px] relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {target !== null && (
          <line 
            x1="0" y1={height - ((target - min) / (max - min)) * height} 
            x2={width} y2={height - ((target - min) / (max - min)) * height} 
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" 
          />
        )}
        <polyline 
          points={validPoints} 
          fill="none" 
          stroke="rgba(43,217,188,0.6)" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {points.map((p, i) => p && (
          <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="3" fill="#2BD9BC" />
        ))}
      </svg>
    </div>
  );
}

export function KPICard({ metric }: { metric: EvidenceMetric }) {
  const isWin = metric.weeksOfHistory > 0 && metric.assessment.tone === 'win';
  const isDiscuss = metric.weeksOfHistory > 0 && metric.assessment.tone === 'discuss';
  
  const deltaColor = isWin ? '#2BD9BC' : isDiscuss ? '#E9B454' : '#6B7690';
  let deltaText = '';
  
  if (metric.weeksOfHistory > 0 && metric.lastWeekValue !== null && metric.currentValue !== null) {
    const diff = metric.currentValue - metric.lastWeekValue;
    if (diff === 0) deltaText = 'No change';
    else {
      const formattedDiff = formatMetricValue(Math.abs(diff), metric.definition.unit);
      deltaText = diff > 0 ? `+${formattedDiff}` : `-${formattedDiff}`;
    }
  }

  // Use a generic icon if none is provided, or map domains to icons
  const iconMap: Record<string, string> = {
    zendesk: 'support_agent',
    assembled: 'schedule',
    manual: 'fact_check',
  };
  const icon = iconMap[metric.definition.source] || 'monitoring';

  return (
    <div 
      className="relative rounded-2xl p-5 pb-3.5 border transition-all duration-250 ease-out hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(165deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 14px 36px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px]">
          <span className="material-symbols-rounded text-[18px] text-[#7C879C]">{icon}</span>
          <span className="text-[12.5px] font-semibold tracking-[0.5px] uppercase text-[#98A2B8]">
            {metric.definition.name}
          </span>
        </div>
        {isWin && (
          <div className="h-6 px-2.5 rounded-full bg-[#2BD9BC]/10 border border-[#2BD9BC]/30 text-[#2BD9BC] text-[11px] font-bold uppercase tracking-[0.5px] flex items-center">
            Improving
          </div>
        )}
        {isDiscuss && (
          <div className="h-6 px-2.5 rounded-full bg-[#E9B454]/10 border border-[#E9B454]/30 text-[#E9B454] text-[11px] font-bold uppercase tracking-[0.5px] flex items-center">
            To Discuss
          </div>
        )}
      </div>
      
      <div className="mt-3.5 flex items-baseline gap-3">
        <div className="font-heading text-[34px] font-extrabold tracking-[-1px] text-white">
          {metric.currentValue !== null ? formatMetricValue(metric.currentValue, metric.definition.unit) : '—'}
        </div>
        {deltaText && (
          <div className="text-[14px] font-semibold" style={{ color: deltaColor }}>
            {deltaText}
          </div>
        )}
      </div>

      <MetricSparkline 
        slots={metric.slots.map(s => s ? s.value : null)} 
        target={null} 
        goodDir={metric.definition.direction} 
      />
    </div>
  );
}
