import type { ReactNode } from 'react';

/** Cadence section label — Montserrat, tracked-out uppercase. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-heading text-[11px] font-bold tracking-[0.12em] uppercase text-[#98A2B8] ${className}`}>
      {children}
    </p>
  );
}
