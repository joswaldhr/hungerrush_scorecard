import type { ReactNode } from 'react';
import { LogoMark } from '../../components/AppLayout';

/** Centered public auth card with the Cadence brand header (login + callback). */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-hr-bg flex items-center justify-center p-4">
      <div className="bg-hr-card rounded-2xl border border-hr-line shadow-card w-full max-w-sm overflow-hidden">
        <div className="h-[5px] bg-hr-teal" />
        <div className="p-10">
          <div className="flex flex-col items-center mb-5">
            <LogoMark size={34} />
            <p className="font-heading font-extrabold text-[19px] text-hr-navy mt-2 leading-none">
              Hunger<span className="text-hr-teal">Rush</span>
            </p>
            <p className="text-[12px] text-hr-gray-light mt-1">Cadence</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
