import { cva } from 'class-variance-authority';
import { Clapperboard, LayoutGrid, type LucideIcon, Music2, PanelLeft, Radio } from 'lucide-react';
import { cn } from '../../src/lib/cn';
import { ViewKey } from '../../src/lib/url';
import { useFilterStore } from '../../src/store/filters';

/**
 * Persistent left navigation, YouTube's shell.
 *
 * Two roles, deliberately separated: the top group changes *destination* (what
 * you are looking at), the lower group toggles the ContentType *facet* (which
 * kind of recording). They look different because they behave differently —
 * destinations are exclusive, content types are additive.
 *
 * Desktop only. Below `md` the sidebar does not render at all and MobileTabBar
 * takes over; a hamburger-and-sheet costs two taps where a tab bar costs one.
 */

export type SidebarWidth = 'expanded' | 'rail';

interface SidebarProps {
  width: SidebarWidth;
  onToggleWidth: () => void;
}

const item = cva(
  'group relative flex w-full cursor-pointer items-center rounded-lg text-sm transition-colors duration-150',
  {
    variants: {
      width: {
        expanded: 'gap-4 px-3 py-2.5',
        // Rail stacks a small label under the icon rather than dropping it —
        // icon-only navigation fails recognition for anyone who visits rarely.
        rail: 'flex-col gap-1 px-1 py-3',
      },
      active: {
        true: 'bg-white/10 text-white',
        false: 'text-gray-400 hover:bg-white/8 hover:text-white',
      },
    },
    defaultVariants: { width: 'expanded', active: false },
  },
);

interface Destination {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
}

const DESTINATIONS: Destination[] = [
  { key: 'browse', label: 'Browse', icon: LayoutGrid },
  { key: 'artists', label: 'Artists', icon: Music2 },
];

interface TypeFilter {
  value: string;
  label: string;
  icon: LucideIcon;
}

/**
 * ContentType is a Phase 0 field still being tagged. Only the two values that
 * resolve today are offered — 'live' (everything untagged) and 'documentary'
 * (the 18 already carrying RecordingType Documentary). TV sessions and
 * compilations join this list once the tagging pass lands.
 */
const TYPE_FILTERS: TypeFilter[] = [
  { value: 'live', label: 'Live shows', icon: Radio },
  { value: 'documentary', label: 'Documentaries', icon: Clapperboard },
];

export function Sidebar({ width, onToggleWidth }: SidebarProps) {
  const view = useFilterStore(s => s.view);
  const setView = useFilterStore(s => s.setView);
  const types = useFilterStore(s => s.type);
  const toggleFacet = useFilterStore(s => s.toggleFacet);

  const isRail = width === 'rail';

  return (
    <nav
      aria-label="Main"
      className={cn(
        'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-white/6 px-2 py-3 md:flex',
        isRail ? 'w-[72px]' : 'w-64',
      )}
    >
      <button
        onClick={onToggleWidth}
        aria-label={isRail ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isRail}
        className={cn(
          'mb-2 flex cursor-pointer items-center rounded-lg text-gray-400 transition-colors duration-150 hover:bg-white/8 hover:text-white',
          isRail ? 'justify-center px-1 py-3' : 'gap-4 px-3 py-2.5',
        )}
      >
        <PanelLeft className="h-5 w-5 shrink-0" />
        {!isRail && <span className="text-sm">Collapse</span>}
      </button>

      <ul className="flex flex-col gap-1">
        {DESTINATIONS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              onClick={() => setView(key)}
              aria-current={view === key ? 'page' : undefined}
              className={item({ width, active: view === key })}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn(isRail ? 'text-[10px] leading-none' : 'truncate')}>{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <hr className="my-3 border-white/6" />

      {!isRail && (
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
          Type
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {TYPE_FILTERS.map(({ value, label, icon: Icon }) => {
          const active = types.map(String).includes(value);
          return (
            <li key={value}>
              <button
                onClick={() => toggleFacet('type', value)}
                aria-pressed={active}
                className={item({ width, active })}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn(isRail ? 'text-[10px] leading-none' : 'truncate')}>
                  {isRail ? label.split(' ')[0] : label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

    </nav>
  );
}
