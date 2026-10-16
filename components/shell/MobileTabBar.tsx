import { LayoutGrid, type LucideIcon, Music2, Search } from 'lucide-react';
import { cn } from '../../src/lib/cn';

/**
 * Bottom navigation for phones.
 *
 * Chosen over YouTube's hamburger-and-sheet: one tap instead of two, and it
 * sits under the thumb rather than in the top-left corner. Three items: since
 * the one-page change (2026-10-13) they are jumps on that page rather than
 * destinations — Browse to the top, Artists to the A–Z list, Search into the
 * filter bar's field. Artists is lit while the list is on screen.
 *
 * The host layout must reserve matching bottom padding, or the last row of
 * cards hides behind this bar.
 */

interface MobileTabBarProps {
  onBrowse: () => void;
  onArtists: () => void;
  /**
   * Focuses the filter bar's search field. It must call focus() synchronously:
   * iOS only raises the keyboard for a focus inside the tap.
   */
  onSearch: () => void;
  active: 'browse' | 'artists';
}

interface Tab {
  key: 'browse' | 'artists' | 'search';
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { key: 'browse', label: 'Browse', icon: LayoutGrid },
  { key: 'artists', label: 'Artists', icon: Music2 },
  { key: 'search', label: 'Search', icon: Search },
];

export function MobileTabBar({ onBrowse, onArtists, onSearch, active }: MobileTabBarProps) {
  const handlers = { browse: onBrowse, artists: onArtists, search: onSearch };

  return (
    <nav
      aria-label="Main"
      // pb-[env(safe-area-inset-bottom)]: without it the bar sits under the iOS
      // home indicator and the bottom few pixels stop responding to taps.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/6 bg-[#141414]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
    >
      <ul className="flex h-14 items-stretch">
        {TABS.map(({ key, label, icon: Icon }) => {
          const current = key === active;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={handlers[key]}
                aria-current={current ? 'location' : undefined}
                className={cn(
                  'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-150',
                  current ? 'text-white' : 'text-gray-400',
                )}
              >
                <Icon className="h-5 w-5" />
                {/* Labels stay visible: an icon-only tab bar fails recognition. */}
                <span className="text-xs leading-none">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
