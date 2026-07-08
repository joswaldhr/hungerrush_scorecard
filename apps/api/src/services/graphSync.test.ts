import { describe, it, expect } from 'vitest';
import { reconcileEmployeeActivity } from './graphSync';

function emp(id: string, email: string, active = true) {
  return { id, email, is_active: active };
}

describe('reconcileEmployeeActivity', () => {
  it('deactivates rows absent from the graph and reactivates ones that return', () => {
    const r = reconcileEmployeeActivity(
      [
        emp('a', 'present@hungerrush.com'),
        emp('b', 'gone@hungerrush.com'),
        emp('c', 'back@hungerrush.com', false),
        emp('d', 'still-gone@hungerrush.com', false),
      ],
      new Set(['present@hungerrush.com', 'back@hungerrush.com']),
    );
    expect(r.deactivate).toEqual(['b']);
    expect(r.reactivate).toEqual(['c']);
    expect(r.breakerTripped).toBe(false);
  });

  it('matches emails case-insensitively (graph set is lowercased)', () => {
    const r = reconcileEmployeeActivity(
      [emp('a', 'Mixed.Case@HungerRush.com')],
      new Set(['mixed.case@hungerrush.com']),
    );
    expect(r.deactivate).toEqual([]);
  });

  it('trips the circuit breaker instead of mass-deactivating on a thin graph result', () => {
    const rows = Array.from({ length: 100 }, (_, i) => emp(`e${i}`, `p${i}@hungerrush.com`));
    // Only 10 of 100 present → 90 candidates > max(5, 20) → breaker
    const present = new Set(rows.slice(0, 10).map(e => e.email));
    const r = reconcileEmployeeActivity(rows, present);
    expect(r.breakerTripped).toBe(true);
    expect(r.deactivate).toEqual([]);
  });

  it('small legitimate deactivation stays under the breaker', () => {
    const rows = Array.from({ length: 100 }, (_, i) => emp(`e${i}`, `p${i}@hungerrush.com`));
    const present = new Set(rows.slice(3).map(e => e.email)); // 3 absent
    const r = reconcileEmployeeActivity(rows, present);
    expect(r.breakerTripped).toBe(false);
    expect(r.deactivate).toEqual(['e0', 'e1', 'e2']);
  });

  it('reactivations apply even when the breaker trips', () => {
    const rows = [
      ...Array.from({ length: 50 }, (_, i) => emp(`e${i}`, `p${i}@hungerrush.com`)),
      emp('r1', 'returned@hungerrush.com', false),
    ];
    const r = reconcileEmployeeActivity(rows, new Set(['returned@hungerrush.com']));
    expect(r.breakerTripped).toBe(true);
    expect(r.deactivate).toEqual([]);
    expect(r.reactivate).toEqual(['r1']);
  });
});
