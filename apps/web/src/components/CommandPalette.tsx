import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, User, LayoutGrid, SlidersHorizontal, FileOutput, type LucideIcon } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useRoster } from '../hooks/useRoster';

/**
 * Ctrl/Cmd+K command palette (external-review wave 2, rebuilt in-house):
 * jump to a person or a page from anywhere. Controlled by AppLayout so the
 * header trigger and the shortcut share one open state. No animation/class
 * libraries — Cadence tokens and the existing overlay idiom (the S1 drawer).
 *
 * Known limit, recorded in REVIEW.md: palette navigation is SPA route nav,
 * so it bypasses the scorecard's unsaved-note confirm the same way sidebar
 * clicks do (the data-router/useBlocker migration closes all of these).
 */

interface PaletteCommand {
  id: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  path: string;
}

/** People shown at once — beyond this the footer says to keep typing. */
const MAX_PEOPLE = 8;

function PeopleSkeleton() {
  return (
    <div className="animate-pulse space-y-2 px-3 py-2" aria-hidden="true">
      <div className="h-4 bg-hr-line/60 rounded w-2/3" />
      <div className="h-4 bg-hr-line/60 rounded w-1/2" />
      <div className="h-4 bg-hr-line/60 rounded w-3/5" />
    </div>
  );
}

/**
 * Inner content mounts only while the palette is open, so the roster query
 * runs lazily on first open instead of on every page load.
 */
function PaletteContent({ onClose }: { onClose: () => void }) {
  const { entries, loading } = useRoster();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Same gates AppLayout's sidebar uses (S6 keeps the real enforcement in RLS/AuthGuard).
  const showRollup = role === 'senior_manager' || role === 'executive' || role === 'admin';
  const showAdmin = role === 'admin';

  const q = search.trim().toLowerCase();

  const pages: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      { id: 'page-team', label: 'Your team', icon: Users, path: '/scorecard' },
    ];
    if (showRollup) list.push({ id: 'page-rollup', label: 'Team rollup', icon: LayoutGrid, path: '/rollup' });
    if (showAdmin) {
      list.push({ id: 'page-metrics', label: 'Metrics', icon: SlidersHorizontal, path: '/admin/metrics' });
      list.push({ id: 'page-exports', label: 'Export log', icon: FileOutput, path: '/admin/exports' });
    }
    return list.filter(p => !q || p.label.toLowerCase().includes(q));
  }, [showRollup, showAdmin, q]);

  const matchingPeople = useMemo(
    () =>
      entries.filter(
        e =>
          !q ||
          e.employee.full_name.toLowerCase().includes(q) ||
          e.employee.email.toLowerCase().includes(q),
      ),
    [entries, q],
  );

  const people: PaletteCommand[] = useMemo(
    () =>
      matchingPeople.slice(0, MAX_PEOPLE).map(e => ({
        id: `person-${e.employee.id}`,
        label: e.employee.full_name,
        sublabel: e.employee.email,
        icon: User,
        path: `/scorecard/${e.employee.id}`,
      })),
    [matchingPeople],
  );

  const items = useMemo(() => [...pages, ...people], [pages, people]);
  const hiddenPeople = matchingPeople.length - people.length;

  // Query changes reset the selection; clamp covers a shrinking list.
  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);
  const activeIndex = items.length === 0 ? -1 : Math.min(selectedIndex, items.length - 1);

  const run = (command: PaletteCommand) => {
    navigate(command.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const command = items[activeIndex];
      if (command) run(command);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="p-2">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Jump to a person or page..."
        role="combobox"
        aria-expanded="true"
        aria-controls="command-palette-list"
        aria-activedescendant={activeIndex >= 0 ? items[activeIndex]!.id : undefined}
        aria-label="Command palette"
        className="w-full rounded-lg border border-hr-line bg-hr-bg px-3 py-2 text-base text-hr-navy placeholder:text-hr-gray-mid outline-none focus:border-hr-teal/40"
      />

      {loading ? (
        <PeopleSkeleton />
      ) : items.length === 0 ? (
        <p className="px-3 py-4 text-base text-hr-gray">
          No matches — try a different name or email.
        </p>
      ) : (
        <ul id="command-palette-list" role="listbox" aria-label="Commands" className="mt-2 max-h-80 overflow-y-auto">
          {items.map((item, i) => {
            const active = i === activeIndex;
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                id={item.id}
                role="option"
                aria-selected={active}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => run(item)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer ${
                  active ? 'bg-hr-teal-tint text-hr-navy' : 'text-hr-navy hover:bg-hr-bg'
                }`}
              >
                <Icon size={15} className={active ? 'text-hr-teal' : 'text-hr-gray-mid'} />
                <span className="text-base truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="ml-auto text-xs text-hr-gray-mid truncate">{item.sublabel}</span>
                )}
              </li>
            );
          })}
          {hiddenPeople > 0 && (
            <li aria-hidden="true" className="px-3 py-1.5 text-xs text-hr-gray-mid">
              +{hiddenPeople} more — keep typing to narrow it down
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Ctrl/Cmd+K toggles from anywhere — a modified chord, so it deliberately
  // works while typing (the scorecard's bare-key listener ignores modifiers).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg bg-hr-card rounded-xl shadow-panel border border-hr-line"
      >
        <PaletteContent onClose={() => onOpenChange(false)} />
      </div>
    </div>
  );
}
