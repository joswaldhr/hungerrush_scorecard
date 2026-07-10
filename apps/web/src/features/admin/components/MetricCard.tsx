import { useState } from 'react';
import type { MetricDefinition } from '@scorecard/shared';
import type { MetricUpdates } from '../../../hooks/useMetricDefinitions';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface MetricCardProps {
  metric: MetricDefinition;
  saveState: SaveState;
  onSave: (id: string, updates: MetricUpdates) => void;
}

// Source identity badges — calm, never a performance signal.
const SOURCE_BADGE: Record<string, string> = {
  zendesk: 'bg-[#14A88F]/20 text-[#2BD9BC]',
  assembled: 'bg-[#35508C]/30 text-[#7DA2F5]',
  forethought: 'bg-white/10 text-[#98A2B8]',
};

const fieldLabel = 'text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5E6980] mb-1.5 block';
const metaLabel = 'text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5E6980]';
const fieldInput =
  'w-full rounded-[10px] bg-white/5 border border-white/10 text-[14px] text-[#F2F5FA] py-2 px-3 focus:ring-[#2BD9BC]/20 focus:border-[#2BD9BC]/40 focus:outline-none';

export function MetricCard({ metric, saveState, onSave }: MetricCardProps) {
  const [name, setName] = useState(metric.name);
  const [coachingPrompt, setCoachingPrompt] = useState(metric.coaching_prompt);
  const [displayOrder, setDisplayOrder] = useState(metric.display_order);
  const [isActive, setIsActive] = useState(metric.is_active);

  const isDirty =
    name !== metric.name ||
    coachingPrompt !== metric.coaching_prompt ||
    displayOrder !== metric.display_order ||
    isActive !== metric.is_active;

  const directionLabel =
    metric.direction === 'higher_is_better' ? '↑ Higher is better' : '↓ Lower is better';

  return (
    <div className={`bg-white/5 border border-white/10 rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.3)] p-5 transition-opacity ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[12px] text-[#5E6980] truncate">{metric.key}</span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${SOURCE_BADGE[metric.source] ?? 'bg-white/10 text-[#98A2B8]'}`}
          >
            {metric.source}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <span className="text-[13px] text-[#98A2B8] font-medium">{isActive ? 'Active' : 'Inactive'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`${metric.name} active`}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2BD9BC] focus-visible:ring-offset-2 ${
              isActive ? 'bg-[#2BD9BC]' : 'bg-white/20'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                isActive ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className={fieldLabel}>Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={fieldInput}
          />
        </div>

        <div>
          <label className={fieldLabel}>Coaching Prompt</label>
          <textarea
            value={coachingPrompt}
            onChange={e => setCoachingPrompt(e.target.value)}
            rows={2}
            className={`${fieldInput} resize-y`}
          />
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor={`display-order-${metric.id}`} className={metaLabel}>
            Order
          </label>
          <input
            id={`display-order-${metric.id}`}
            type="number"
            value={displayOrder}
            onChange={e => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
            min={1}
            className="w-20 rounded-[10px] bg-white/5 border border-white/10 text-[14px] text-[#F2F5FA] py-1.5 px-3 focus:ring-[#2BD9BC]/20 focus:border-[#2BD9BC]/40 focus:outline-none"
          />
        </div>
        <p className="flex items-baseline gap-1.5">
          <span className={metaLabel}>Unit</span>
          <span className="text-[13px] text-[#98A2B8]">{metric.unit}</span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className={metaLabel}>Direction</span>
          <span className="text-[13px] text-[#98A2B8]">{directionLabel}</span>
        </p>
        <button
          onClick={() =>
            onSave(metric.id, {
              name,
              coaching_prompt: coachingPrompt,
              display_order: displayOrder,
              is_active: isActive,
            })
          }
          disabled={!isDirty || saveState === 'saving'}
          className={`ml-auto px-4 py-2 rounded-[10px] text-[13.5px] font-semibold transition-colors ${
            saveState === 'saved'
              ? 'bg-[#14A88F]/20 text-[#2BD9BC]'
              : saveState === 'error'
                ? 'bg-[#E9B454]/20 text-[#E9B454]'
                : isDirty && saveState !== 'saving'
                  ? 'bg-[#2BD9BC] text-[#101624] hover:bg-[#2BD9BC]/90'
                  : 'bg-white/10 text-[#5E6980] cursor-not-allowed'
          }`}
        >
          {saveState === 'saving' && 'Saving...'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Save failed'}
          {saveState === 'idle' && 'Save'}
        </button>
      </div>
    </div>
  );
}
