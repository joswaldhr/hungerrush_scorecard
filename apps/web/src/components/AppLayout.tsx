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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Global freshness chip (QoL): every screen answers "can I trust this right
  // now" at a glance — the newest visible synced_at, amber past the 9h bound.
  const { latestSyncedAt } = useDataFreshness();
  // Header hint doubles as the mouse entry point for the Ctrl/Cmd+K palette.
  const isMac = /Mac/i.test(navigator.platform);

  // S12: per-route document title + move focus to the page heading when a page
  // mounts (each page mounts its own AppLayout, so this fires on page-to-page
  // navigation but NOT on a same-page param change like switching people).
  useDocumentTitle(typeof title === 'string' ? title : undefined);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // S1 mobile navigation: Esc closes the drawer; focus moves into it on open.
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const handleNavigate = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-hr-bg">
      <aside className="w-[220px] flex-shrink-0 bg-hr-navy flex-col h-full hidden lg:flex">
        <SidebarContent onNavigate={handleNavigate} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            className="relative w-[240px] h-full bg-hr-navy flex flex-col shadow-panel outline-none"
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-3 p-1.5 rounded-md text-white/50 hover:text-white"
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-[52px] bg-hr-card border-b border-hr-line flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="lg:hidden p-1.5 -ml-1 rounded-md text-hr-gray hover:text-hr-navy hover:bg-hr-bg transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium text-hr-navy truncate outline-none">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-hr-gray-mid mt-px">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:flex items-center gap-1 border border-hr-line rounded-md px-1.5 py-0.5 text-xs text-hr-gray-mid hover:text-hr-gray hover:bg-hr-bg transition-colors"
            >
              <Search size={11} />
              {isMac ? '⌘K' : 'Ctrl K'}
            </button>
            <SyncFreshnessChip latestSyncedAt={latestSyncedAt} />
            {actions}
          </div>
        </header>
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-hr-bg">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
