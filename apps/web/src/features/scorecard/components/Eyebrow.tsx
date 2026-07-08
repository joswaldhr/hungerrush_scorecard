import type { ReactNode } from 'react';

/** Cadence section label — Montserrat, tracked-out uppercase. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-heading text-xs font-bold tracking-[0.12em] uppercase text-hr-navy-soft ${className}`}>
      {children}
    </p>
  );
}
