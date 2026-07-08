import type { ReactNode } from 'react';

/**
 * The one degradation/warning banner (amber = system state, never a
 * performance judgment). Every stale-data or failed-query message uses this
 * so the styling can't drift between surfaces.
 */
export function WarnBanner({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={`bg-hr-amber-tint border border-hr-amber/30 rounded-lg px-3 py-2 text-sm leading-snug text-hr-amber-deep ${className}`}
    >
      {children}
    </div>
  );
}
