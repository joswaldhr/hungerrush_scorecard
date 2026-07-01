import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, LayoutGrid, SlidersHorizontal, FileOutput } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface AppLayoutProps {
  children: ReactNode;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, borderRadius: 7, backgroundColor: '#1D9E75' }}
      className="flex items-center justify-center flex-shrink-0"
    >
      <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
        HR
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts.length >= 2 ? parts[parts.length - 1] : undefined;
  if (first && last) return (first.charAt(0) + last.charAt(0)).toUpperCase();
  return first ? first.charAt(0).toUpperCase() : '?';
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = session?.user?.app_metadata?.['role'] as string | undefined;
  const rawName = session?.user?.user_metadata?.['full_name'];
  const fullName = typeof rawName === 'string' ? rawName : (session?.user?.email ?? '');
  const showRollup = role === 'senior_manager' || role === 'admin';
  const showAdmin = role === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/scorecard');
    }
    return location.pathname.startsWith(path);
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-2 py-[7px] rounded-md text-[13px] transition-colors ${
      active
        ? 'bg-[rgba(29,158,117,0.20)] text-white'
        : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
    }`;

  const iconClass = (active: boolean) =>
    active ? 'text-[#1D9E75]' : 'text-white/50';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F6F3]">
      <aside className="w-[220px] flex-shrink-0 bg-[#1E2E4A] flex-col h-full hidden lg:flex">
        <div className="p-5 border-b border-white/[0.08] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#1D9E75] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">HR</span>
          </div>
          <div>
            <span className="text-[13px] font-medium text-white block">Scorecard</span>
            <span className="text-[11px] text-white/40 block">HungerRush</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30 px-2 mb-2">Main</p>
          <button onClick={() => navigate('/dashboard')} className={navItemClass(isActive('/dashboard'))}>
            <Users size={15} className={iconClass(isActive('/dashboard'))} />
            <span>Your team</span>
          </button>
          {showRollup && (
            <button onClick={() => navigate('/rollup')} className={navItemClass(isActive('/rollup'))}>
              <LayoutGrid size={15} className={iconClass(isActive('/rollup'))} />
              <span>Team rollup</span>
            </button>
          )}
          {showAdmin && (
            <>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-white/30 px-2 mb-2 mt-6">Admin</p>
              <button onClick={() => navigate('/admin/metrics')} className={navItemClass(isActive('/admin/metrics'))}>
                <SlidersHorizontal size={15} className={iconClass(isActive('/admin/metrics'))} />
                <span>Metrics</span>
              </button>
              <button onClick={() => navigate('/admin/exports')} className={navItemClass(isActive('/admin/exports'))}>
                <FileOutput size={15} className={iconClass(isActive('/admin/exports'))} />
                <span>Export log</span>
              </button>
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-white/[0.08] p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.06] group">
            <div className="w-[26px] h-[26px] rounded-full bg-[#1D9E75] flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-white">{getInitials(fullName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/70 truncate">{fullName}</p>
              <p className="text-[10px] text-white/35 capitalize">{role ?? 'user'}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-[11px] text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-[52px] bg-white border-b border-[#E8E6E1] flex items-center px-6 gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-[15px] font-medium text-slate-800 truncate">{title}</h1>
            {subtitle && <p className="text-[11px] text-slate-400 mt-px">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">{actions}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-[#F7F6F3]">{children}</main>
      </div>
    </div>
  );
}
