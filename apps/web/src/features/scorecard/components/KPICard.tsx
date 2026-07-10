import { motion } from 'framer-motion';
import { formatMetricValue } from '../../../lib/formatMetric';
import type { EvidenceMetric } from '../../../lib/evidence';
import { CadenceSparkline } from './CadenceSparkline';
import { TONE_HEX } from './toneStyles';

export function KPICard({ metric, index = 0 }: { metric: EvidenceMetric; index?: number }) {
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

  const iconMap: Record<string, string> = {
    zendesk: 'support_agent',
    assembled: 'schedule',
    manual: 'fact_check',
  };
  const icon = iconMap[metric.definition.source] || 'monitoring';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="relative rounded-2xl p-5 pb-3.5 border transition-all duration-300 ease-out hover:-translate-y-1 group"
      style={{
        background: 'linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 14px 36px rgba(0,0,0,0.25)',
      }}
    >
      {/* Dynamic Hover Glow */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          boxShadow: `0 0 30px ${TONE_HEX[metric.assessment.tone]}25`,
        }}
      />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-[9px]">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-[16px] text-[#7DA2F5]">{icon}</span>
          </div>
          <span className="text-[12.5px] font-semibold tracking-[0.5px] uppercase text-[#98A2B8]">
            {metric.definition.name}
          </span>
        </div>
        {isWin && (
          <div className="h-6 px-2.5 rounded-full bg-[#2BD9BC]/10 border border-[#2BD9BC]/30 text-[#2BD9BC] text-[11px] font-bold uppercase tracking-[0.5px] flex items-center shadow-[0_0_12px_rgba(43,217,188,0.2)]">
            Improving
          </div>
        )}
        {isDiscuss && (
          <div className="h-6 px-2.5 rounded-full bg-[#E9B454]/10 border border-[#E9B454]/30 text-[#E9B454] text-[11px] font-bold uppercase tracking-[0.5px] flex items-center shadow-[0_0_12px_rgba(233,180,84,0.2)]">
            To Discuss
          </div>
        )}
      </div>
      
      <div className="mt-4 flex items-baseline gap-3 relative z-10">
        <div className="font-heading text-[38px] font-extrabold tracking-[-1.5px] text-white drop-shadow-md">
          {metric.currentValue !== null ? formatMetricValue(metric.currentValue, metric.definition.unit) : '—'}
        </div>
        {deltaText && (
          <div className="text-[14px] font-bold tracking-tight" style={{ color: deltaColor, textShadow: `0 2px 10px ${deltaColor}40` }}>
            {deltaText}
          </div>
        )}
      </div>

      <div className="mt-[18px] relative z-10 h-[50px] w-full flex items-center">
        {metric.weeksOfHistory > 0 ? (
          <CadenceSparkline 
            slots={metric.slots} 
            domain={metric.domain} 
            color={TONE_HEX[metric.assessment.tone]}
            ariaLabel={`Trend for ${metric.definition.name}`}
            width={300}
            height={50}
            unit={metric.definition.unit}
          />
        ) : (
          <div className="text-[12px] text-[#6B7690] italic">Not enough data to show trend</div>
        )}
      </div>
    </motion.div>
  );
}
