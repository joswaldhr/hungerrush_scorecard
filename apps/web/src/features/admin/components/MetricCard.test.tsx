// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { MetricDefinition } from '@scorecard/shared';
import { MetricCard } from './MetricCard';

afterEach(cleanup);

const METRIC: MetricDefinition = {
  id: 'id-csat',
  key: 'csat_score',
  name: 'Customer Satisfaction',
  unit: 'percent',
  source: 'zendesk',
  coaching_prompt: 'What is driving positive customer feedback?',
  direction: 'higher_is_better',
  is_active: true,
  display_order: 3,
  created_at: '2026-01-01',
};

describe('MetricCard', () => {
  it('renders the DB-owned fields and the read-only unit/direction', () => {
    render(<MetricCard metric={METRIC} saveState="idle" onSave={() => {}} />);
    expect(screen.getByText('csat_score')).toBeTruthy();
    expect(screen.getByText('zendesk')).toBeTruthy();
    expect(screen.getByDisplayValue('Customer Satisfaction')).toBeTruthy();
    expect(screen.getByDisplayValue('What is driving positive customer feedback?')).toBeTruthy();
    expect(screen.getByText('percent')).toBeTruthy();
    expect(screen.getByText('↑ Higher is better')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Customer Satisfaction active' })).toBeTruthy();
  });

  it('keeps Save disabled until a field is dirty, then submits the edits', () => {
    const onSave = vi.fn();
    render(<MetricCard metric={METRIC} saveState="idle" onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('switch'));
    expect((save as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith('id-csat', {
      name: 'Customer Satisfaction',
      coaching_prompt: 'What is driving positive customer feedback?',
      display_order: 3,
      is_active: false,
    });
  });

  it('shows the per-card save state on the button', () => {
    render(<MetricCard metric={METRIC} saveState="saved" onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
    cleanup();
    render(<MetricCard metric={METRIC} saveState="error" onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save failed' })).toBeTruthy();
  });
});
