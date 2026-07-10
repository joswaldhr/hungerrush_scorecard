import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { formatMetricValue } from '../../../lib/formatMetric';

interface CadenceSparklineProps {
  slots: Array<{ value: number } | null>;
  domain: [number, number];
  band?: readonly [number, number];
  color: string;
  ariaLabel: string;
  width?: number;
  height?: number;
  unit?: string;
}

export function CadenceSparkline({
  slots,
  domain,
  band,
  color,
  ariaLabel,
  width = 120,
  height = 40,
  unit = 'count'
}: CadenceSparklineProps) {
  // Map slots into a Recharts-friendly format. 
  // We use index as a mock x-axis. Nulls represent missing weeks.
  const data = slots.map((slot, i) => ({
    index: i,
    value: slot ? slot.value : null,
  }));

  // Create a unique ID for the gradient to prevent conflicts if multiple charts render
  const gradId = `spark-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div 
      style={{ width, height }} 
      className="flex-shrink-0"
      role="img" 
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            
            {/* Optional drop shadow for the line to make it "glow" */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <YAxis domain={domain} hide />
          
          <Tooltip 
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const val = payload[0].value as number;
                return (
                  <div className="bg-[#0C1443]/90 border border-white/10 shadow-glass rounded-md px-2 py-1 backdrop-blur-md">
                    <p className="text-[12px] text-white font-mono">
                      {formatMetricValue(val, unit)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradId})`}
            isAnimationActive={true}
            animationDuration={1500}
            animationEasing="ease-out"
            connectNulls={false}
            filter="url(#glow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
