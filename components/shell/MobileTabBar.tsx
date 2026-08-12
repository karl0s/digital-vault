import { LayoutGrid, type LucideIcon, Music2, Search } from 'lucide-react';
import { cn } from '../../src/lib/cn';
import { ViewKey } from '../../src/lib/url';
import { useFilterStore } from '../../src/store/filters';

/**
 * Bottom navigation for phones, replacing the sidebar entirely below `md`.
 *
 * Chosen over YouTube's hamburger-and-sheet: one tap instead of two, and it
 * sits under the thumb rather than in the top-left corner. Three items, because
 * a tab bar with seven is a menu in disguise — ContentType demotes to a facet
 * on mobile.
 *
 * The host layout must reserve matching bottom padding, or the last row of
 * cards hides behind this bar.
 */

interface MobileTabBarProps {
  /** Opens the nav search field; the bar itself owns no input. */
  onSearchClick: () => void;
}

type Tab =
  | { kind: 'view'; key: ViewKey; label: string; icon: LucideIcon }
  | { kind: 'search'; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { kind: 'view', key: 'browse', label: 'Browse', icon: LayoutGrid },
  { kind: 'view', key: 'artists', label: 'Artists', icon: Music2 },
  { kind: 'search', label: 'Search', icon: Search },
];

export function MobileTabBar({ onSearchClick }: MobileTabBarProps) {
  const view = useFilterStore(s => s.view);
  const setView = useFilterStore(s => s.setView);

  return (
    <nav
      aria-label="Main"
      // pb-[env(safe-area-inset-bottom)]: without it the bar sits under the iOS
      // home indicator and the bottom few pixels stop responding to taps.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/6 bg-[#141414]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex h-14 items-stretch">
        {TABS.map(tab => {
          const active = tab.kind === 'view' && view === tab.key;
          const Icon = tab.icon;
          return (
            <li key={tab.label} className="flex-1">
              <button
                onClick={() => (tab.kind === 'view' ? setView(tab.key) : onSearchClick())}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-150',
                  active ? 'text-white' : 'text-gray-400',
                )}
              >
                <Icon className="h-5 w-5" />
                {/* Labels stay visible: an icon-only tab bar fails recognition. */}
                <span className="text-[10px] leading-none">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
