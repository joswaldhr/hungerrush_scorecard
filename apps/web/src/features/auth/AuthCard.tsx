import type { ReactNode } from 'react';
import { LogoMark } from '../../components/AppLayout';

/** Centered public auth card with the Cadence brand header (login + callback). */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#070B14] flex items-center justify-center p-4">
      {/* Background Mesh (same as AppLayout) */}
      <div className="absolute inset-0 -z-10 bg-[#070B14]">
        <div className="absolute -inset-[20%] blur-[90px] opacity-55">
          <div className="absolute left-[12%] top-[18%] w-[560px] h-[560px] rounded-full hr-mesh-a" style={{ background: 'radial-gradient(circle at 40% 40%, rgba(14,132,118,0.85), transparent 65%)' }} />
          <div className="absolute right-[8%] top-[6%] w-[520px] h-[520px] rounded-full hr-mesh-b" style={{ background: 'radial-gradient(circle at 60% 40%, rgba(53,80,140,0.8), transparent 65%)' }} />
          <div className="absolute left-[38%] -bottom-[10%] w-[640px] h-[640px] rounded-full hr-mesh-c" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(43,217,188,0.35), transparent 60%)' }} />
        </div>
        <div className="absolute inset-0 hr-grain" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)' }} />
      </div>

      <div 
        className="relative w-full max-w-[400px] px-11 pt-12 pb-9 rounded-[20px] bg-white/[0.045] border border-white/10 backdrop-blur-[28px] hr-fade-up text-center z-10"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)' }}
      >
        <div className="flex justify-center mb-[22px]">
          <div 
            className="w-16 h-16 rounded-[18px] border border-[#2BD9BC]/35 flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(145deg, rgba(14,132,118,0.35), rgba(14,132,118,0.08))',
              boxShadow: '0 0 40px rgba(43,217,188,0.25)'
            }}
          >
            <LogoMark size={38} />
          </div>
        </div>
        
        <p className="font-heading font-extrabold text-[26px] tracking-[-0.5px] text-[#F2F5FA] leading-none mb-2.5">
          Performance Scorecard
        </p>
        <p className="text-[14px] leading-[1.55] text-[#98A2B8] mb-[30px]">
          Coaching-first insights for your weekly 1:1s. Sign in with your HungerRush account.
        </p>

        {children}

        <div className="mt-8 pt-4 border-t border-white/5 text-[11px] text-[#4C5568]">
          Powered by HungerRush LLC.
        </div>
      </div>
    </div>
  );
}
