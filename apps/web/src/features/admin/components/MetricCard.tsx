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
  zendesk: 'bg-hr-teal-tint text-hr-teal-deep',
  assembled: 'bg-hr-navy/[0.06] text-hr-navy-soft',
  forethought: 'bg-hr-bg text-hr-gray',
};

const fieldLabel = 'text-xs font-semibold uppercase tracking-[0.07em] text-hr-gray-mid mb-1 block';
const metaLabel = 'text-xs font-semibold uppercase tracking-[0.07em] text-hr-gray-mid';
const fieldInput =
  'w-full rounded-lg border-hr-line text-base text-hr-navy py-1.5 focus:ring-hr-teal/20 focus:border-hr-teal/40';

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
    <div className={`bg-hr-card border border-hr-line rounded-xl shadow-card p-5 transition-opacity ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs text-hr-gray-mid truncate">{metric.key}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${SOURCE_BADGE[metric.source] ?? 'bg-hr-bg text-hr-gray'}`}
          >
            {metric.source}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <span className="text-sm text-hr-gray">{isActive ? 'Active' : 'Inactive'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`${metric.name} active`}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hr-teal focus-visible:ring-offset-2 ${
              isActive ? 'bg-hr-teal' : 'bg-hr-line'
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

      <div className="space-y-3">
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

      <div className="mt-4 pt-3.5 border-t border-hr-line flex flex-wrap items-center gap-x-6 gap-y-2.5">
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
            className="w-20 rounded-lg border-hr-line text-base text-hr-navy py-1 focus:ring-hr-teal/20 focus:border-hr-teal/40"
          />
        </div>
        <p className="flex items-baseline gap-1.5">
          <span className={metaLabel}>Unit</span>
          <span className="text-sm text-hr-gray">{metric.unit}</span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className={metaLabel}>Direction</span>
          <span className="text-sm text-hr-gray">{directionLabel}</span>
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
          className={`ml-auto px-3.5 py-1.5 rounded-lg text-base font-medium transition-colors ${
            saveState === 'saved'
              ? 'bg-hr-teal-tint text-hr-teal-deep'
              : saveState === 'error'
                ? 'bg-hr-amber-tint text-hr-amber-deep'
                : isDirty && saveState !== 'saving'
                  ? 'bg-hr-navy text-white hover:bg-hr-navy/90'
                  : 'bg-hr-line text-hr-gray-mid cursor-not-allowed'
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
