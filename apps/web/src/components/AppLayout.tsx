import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, LayoutGrid, SlidersHorizontal, FileOutput, Menu, Search, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { getInitials } from '../lib/initials';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDataFreshness } from '../hooks/useDataFreshness';
import { OfflineBanner } from './OfflineBanner';
import { SyncFreshnessChip } from './SyncFreshnessChip';
import { CommandPalette } from './CommandPalette';

interface AppLayoutProps {
  children: ReactNode;
  title: ReactNode;
  /** ReactNode so pages can append chips (rollup freshness) — same rationale as title. */
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Cadence brand mark (from the adopted prototype) — teal on any dark ground. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * (22 / 30))}
      viewBox="0 0 30 22"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M8 20 A6.5 6.5 0 0 1 8.5 7.2 A8.5 8.5 0 0 1 24.5 9.5 A5.5 5.5 0 0 1 23.5 20 Z"
        fill="none"
        stroke="#3B8272"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 20 v-7 M18.5 20 v-7 M12.5 16.5 h6"
        stroke="#3B8272"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <div className="min-w-0">
        <span className="font-heading font-extrabold text-lg text-white leading-none block">
          Hunger<span className="text-hr-teal">Rush</span>
        </span>
        <span className="text-xs text-[#AEB3CE] leading-none">Cadence</span>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { session, role } = useAuth();
  const location = useLocation();

  const rawName = session?.user?.user_metadata?.['full_name'];
  const fullName = typeof rawName === 'string' ? rawName : (session?.user?.email ?? '');
  const showRollup = role === 'senior_manager' || role === 'executive' || role === 'admin';
  const showAdmin = role === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onNavigate('/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItemClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-2 py-[7px] rounded-md text-base transition-colors ${
      active ? 'bg-hr-teal/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
    }`;

  const navButton = (path: string, Icon: LucideIcon, label: string) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => onNavigate(path)}
        className={navItemClass(active)}
        aria-current={active ? 'page' : undefined}
      >
        <Icon size={15} className={active ? 'text-hr-teal' : 'text-white/50'} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <>
      <div className="p-5 border-b border-white/[0.08]">
        <Brand />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-xs font-semibold tracking-widest uppercase text-white/30 px-2 mb-2">Main</p>
        {navButton('/scorecard', Users, 'Your team')}
        {showRollup && navButton('/rollup', LayoutGrid, 'Team rollup')}
        {showAdmin && (
          <>
            <p className="text-xs font-semibold tracking-widest uppercase text-white/30 px-2 mb-2 mt-6">Admin</p>
            {navButton('/admin/metrics', SlidersHorizontal, 'Metrics')}
            {navButton('/admin/exports', FileOutput, 'Export log')}
          </>
        )}
      </nav>

      <div className="mt-auto border-t border-white/[0.08] p-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.06] group">
          <div className="w-[26px] h-[26px] rounded-full bg-hr-teal flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">{getInitials(fullName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/70 truncate">{fullName}</p>
            <p className="text-xs text-white/35 capitalize">{role ?? 'user'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-white/30 hover:text-white/60 opacity-60 hover:opacity-100 transition-opacity ml-auto"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  
  const { session, role } = useAuth();
  const rawName = session?.user?.user_metadata?.['full_name'];
  const fullName = typeof rawName === 'string' ? rawName : (session?.user?.email ?? '');
  
  const isMac = /Mac/i.test(navigator.platform);

  useDocumentTitle(typeof title === 'string' ? title : undefined);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
  };
  
  const isExec = location.pathname.startsWith('/rollup');
  const isScorecard = location.pathname.startsWith('/scorecard');

  const tabClass = (active: boolean) =>
    `h-8 px-[14px] rounded-lg border-none cursor-pointer font-sans text-[13px] font-semibold transition-colors ${
      active ? 'bg-hr-teal/15 text-hr-teal' : 'bg-transparent text-hr-gray-mid hover:text-hr-gray hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen relative text-[#F2F5FA] overflow-x-hidden">
      {/* Background Mesh */}
      <div className="fixed inset-0 -z-10 bg-[#070B14]">
        {/* We use inline styles for the complex radial gradients to match exactly */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(1200px 500px at 75% -10%, rgba(53,80,140,0.22), transparent 60%), radial-gradient(900px 420px at 10% -5%, rgba(14,132,118,0.20), transparent 55%)'
          }}
        />
        <div className="absolute -inset-[20%] blur-[90px] opacity-55">
          <div className="absolute left-[12%] top-[18%] w-[560px] h-[560px] rounded-full hr-mesh-a" style={{ background: 'radial-gradient(circle at 40% 40%, rgba(14,132,118,0.85), transparent 65%)' }} />
          <div className="absolute right-[8%] top-[6%] w-[520px] h-[520px] rounded-full hr-mesh-b" style={{ background: 'radial-gradient(circle at 60% 40%, rgba(53,80,140,0.8), transparent 65%)' }} />
          <div className="absolute left-[38%] -bottom-[10%] w-[640px] h-[640px] rounded-full hr-mesh-c" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(43,217,188,0.35), transparent 60%)' }} />
        </div>
        <div className="absolute inset-0 hr-grain" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)' }} />
      </div>

      {/* Top Nav */}
      <div className="sticky top-0 z-40 h-16 flex items-center gap-5 px-7 bg-[#090D17]/70 backdrop-blur-[20px] border-b border-white/10">
        <div className="flex items-center gap-[11px] cursor-pointer" onClick={() => handleNavigate('/scorecard')}>
          <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-[#0E8476]/30 to-[#0E8476]/5 border border-[#2BD9BC]/35 flex items-center justify-center shadow-[0_0_20px_rgba(43,217,188,0.15)]">
            <LogoMark size={16} />
          </div>
          <div className="font-heading font-bold text-[15px] tracking-tight">Scorecard</div>
        </div>

        <div className="flex gap-1 ml-3 p-1 rounded-[10px] bg-white/5 border border-white/5">
          <button onClick={() => handleNavigate('/rollup')} className={tabClass(isExec)}>Team Rollup</button>
          <button onClick={() => handleNavigate('/scorecard')} className={tabClass(isScorecard)}>1:1 Scorecard</button>
        </div>

        <div className="flex-1" />

        <button 
          onClick={() => setPaletteOpen(true)}
          className="h-9 flex items-center gap-2.5 px-3 rounded-[10px] border border-white/10 bg-white/5 text-[#98A2B8] font-sans text-[13px] transition-colors hover:border-[#2BD9BC]/50 hover:text-[#F2F5FA]"
        >
          <Search size={17} />
          Jump to person…
          <kbd className="font-sans text-[11px] px-1.5 py-0.5 rounded-[5px] bg-white/10 border border-white/10 text-[#7C879C] ml-1">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <div 
          className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#35508C] to-[#0E8476] flex items-center justify-center text-xs font-bold border border-white/20 ml-2"
          title={fullName}
        >
          {getInitials(fullName)}
        </div>
      </div>

      <OfflineBanner />
      <main className="relative z-10">{children}</main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
