import { useState } from 'react';
import type { MetricDefinition } from '@scorecard/shared';

type MetricUpdates = Pick<MetricDefinition, 'name' | 'coaching_prompt' | 'display_order' | 'is_active'>;

interface MetricCardProps {
  metric: MetricDefinition;
  saving: boolean;
  onSave: (id: string, updates: MetricUpdates) => void;
}

const SOURCE_BADGE: Record<string, string> = {
  zendesk: 'bg-blue-100 text-blue-800',
  assembled: 'bg-purple-100 text-purple-800',
  forethought: 'bg-slate-100 text-slate-600',
};

export function MetricCard({ metric, saving, onSave }: MetricCardProps) {
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
    <div className={`bg-white rounded-lg p-6 transition-opacity ${!isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">{metric.key}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_BADGE[metric.source] ?? 'bg-slate-100 text-slate-600'}`}
          >
            {metric.source}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-slate-500">{isActive ? 'Active' : 'Inactive'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              isActive ? 'bg-hr-green' : 'bg-slate-300'
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
          <label className="block text-sm font-medium text-hr-navy mb-1">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-hr-navy mb-1">
            Coaching Prompt Template
          </label>
          <textarea
            value={coachingPrompt}
            onChange={e => setCoachingPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-hr-navy mb-1">Display Order</label>
            <input
              type="number"
              value={displayOrder}
              onChange={e => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
              min={1}
              className="w-full rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Unit</label>
            <p className="text-sm text-slate-600 py-2">{metric.unit}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Direction</label>
            <p className="text-sm text-slate-600 py-2">{directionLabel}</p>
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
          disabled={!isDirty || saving}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isDirty && !saving
              ? 'bg-hr-green text-white hover:bg-hr-green-dark'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
