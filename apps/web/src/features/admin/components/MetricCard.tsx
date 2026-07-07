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
  zendesk: 'bg-hr-teal-tint text-hr-teal',
  assembled: 'bg-hr-navy/[0.06] text-hr-navy-soft',
  forethought: 'bg-hr-bg text-hr-gray',
};

const fieldLabel = 'text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-gray-light mb-1.5 block';
const fieldInput =
  'w-full rounded-lg border-hr-line text-sm text-hr-navy focus:ring-hr-teal/20 focus:border-hr-teal/40';

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
    <div className={`bg-hr-card border border-hr-line rounded-xl p-6 transition-opacity ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-hr-gray-light">{metric.key}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_BADGE[metric.source] ?? 'bg-hr-bg text-hr-gray'}`}
          >
            {metric.source}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-hr-gray">{isActive ? 'Active' : 'Inactive'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`${metric.name} active`}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hr-teal focus-visible:ring-offset-2 ${
              isActive ? 'bg-hr-teal' : 'bg-hr-line'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0'
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
          <label className={fieldLabel}>Coaching Prompt Template</label>
          <textarea
            value={coachingPrompt}
            onChange={e => setCoachingPrompt(e.target.value)}
            rows={3}
            className={fieldInput}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={fieldLabel}>Display Order</label>
            <input
              type="number"
              value={displayOrder}
              onChange={e => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
              min={1}
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Unit</label>
            <p className="text-sm text-hr-gray py-2">{metric.unit}</p>
          </div>
          <div>
            <label className={fieldLabel}>Direction</label>
            <p className="text-sm text-hr-gray py-2">{directionLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saveState === 'saved'
              ? 'bg-hr-teal-tint text-hr-teal'
              : saveState === 'error'
                ? 'bg-hr-amber-tint text-hr-amber-deep'
                : isDirty && saveState !== 'saving'
                  ? 'bg-hr-navy text-white hover:bg-hr-navy/90'
                  : 'bg-hr-line text-hr-gray-light cursor-not-allowed'
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
