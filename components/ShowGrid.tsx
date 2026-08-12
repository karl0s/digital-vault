import { Show } from '../App';
import { GRID_COLS } from './FeaturedRows';
import { ShowCard } from './ShowCard';

/**
 * Plain results grid: cards and an empty state, no header.
 *
 * Distinct from SearchResultsGrid, which owns its own title, count and clear
 * button. On the browse view the FilterBar already carries all three, so a
 * second header would repeat them.
 *
 * Deliberately unanimated. Filtering is a high-frequency action and animating
 * a few hundred cards on every checkbox is the worst option available.
 */

interface ShowGridProps {
  shows: Show[];
  onShowClick: (show: Show) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
  onClearFilters: () => void;
}

export function ShowGrid({ shows, onShowClick, getImageUrl, onClearFilters }: ShowGridProps) {
  if (shows.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-base text-gray-300">No shows match these filters</p>
        <p className="mt-1 text-sm text-gray-400">
          Try removing one, or widening the era.
        </p>
        <button
          onClick={onClearFilters}
          className="mt-4 cursor-pointer rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white transition-colors duration-150 hover:bg-white/20"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div className={GRID_COLS}>
      {shows.map(show => (
        <ShowCard
          key={show.ShowID}
          show={show}
          onClick={() => onShowClick(show)}
          getImageUrl={getImageUrl}
          searchMode="search"
        />
      ))}
    </div>
  );
}
