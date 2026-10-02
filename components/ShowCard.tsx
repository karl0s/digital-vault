import { memo, useRef } from 'react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';

interface ShowCardProps {
  show: Show;
  /**
   * Receives the show, rather than being a per-card `() => onClick(show)`
   * closure, so every card gets the same function and `memo` below can hold.
   */
  onSelect: (show: Show) => void;
  getImageUrl?: (checksum: string, index: number) => string | null;
  searchMode?: 'artist' | 'search';
}

const getColorFromString = (str: string): string => {
  const colors = [
    'bg-red-900', 'bg-blue-900', 'bg-green-900', 'bg-purple-900',
    'bg-pink-900', 'bg-indigo-900', 'bg-yellow-900', 'bg-teal-900',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getRecordingBadgeStyle = (_type: string): string => {
  return 'bg-black text-white border border-white/10';
};

/**
 * Hover and keyboard-focus states are plain CSS (`group-hover` and
 * `group-focus-visible` off the button), not React state driving motion.divs.
 * That used to be four animated components and a state update per card — on
 * Browse, ~4,600 of them, all re-rendering whenever anything above the grid
 * did. The browser runs the same fades for free.
 *
 * Memoised: with stable props (see `onSelect`, and `getImageUrl` in useShows)
 * opening the drawer or touching a filter no longer re-renders every card.
 */
export const ShowCard = memo(function ShowCard({ show, onSelect, getImageUrl, searchMode }: ShowCardProps) {
  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  const durationMin = Math.floor(parseInt(show.DurationSec || '0') / 60);
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const imageUrl = show.ChecksumSHA1
    ? (getImageUrl ? getImageUrl(show.ChecksumSHA1, 1) : `/images/${show.ChecksumSHA1}_01.jpg`)
    : null;

  const location = [show.City, show.Country].filter(Boolean).join(', ');
  // Full context label: event → venue → city/country
  const contextLabel = show.EventOrFestival || show.VenueName || location;
  // Non-repeating secondary label: skips whatever was shown on line 1
  const secondaryLabel = show.EventOrFestival
    ? (show.VenueName || location)
    : show.VenueName
      ? location
      : contextLabel;

  // Line 1 & line 2 per mode
  const line1 = searchMode === 'search'
    ? show.Artist
    : searchMode === 'artist'
      ? (show.EventOrFestival || show.VenueName || location)
      : show.Artist;
  const line2 = searchMode === 'search'
    ? contextLabel
    : searchMode === 'artist'
      ? secondaryLabel
      : contextLabel;

  const artistInitials = show.Artist
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Warm the drawer's images on first hover or focus. A ref, not state:
  // remembering that it has already happened must not re-render the card.
  const prefetched = useRef(false);
  const prefetch = () => {
    if (prefetched.current || !show.ChecksumSHA1) return;
    prefetched.current = true;
    [1, 2, 3, 4].forEach(i => {
      const url = getImageUrl ? getImageUrl(show.ChecksumSHA1!, i) : `/images/${show.ChecksumSHA1}_0${i}.jpg`;
      if (url) new Image().src = url;
    });
  };

  // Shown on hover and on keyboard focus; hidden otherwise.
  const reveal = 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100';

  return (
    // A real <button>, not a div: this is the only way to open a show, so it
    // has to be reachable by keyboard. Keyboard focus reveals the same overlay
    // as hover, via group-focus-visible.
    <button
      type="button"
      id={`show-${show.ShowID}`}
      data-show-year={year}
      className="group cursor-pointer w-full relative z-0 block text-left"
      onClick={() => onSelect(show)}
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      {/* Thumbnail */}
      <div
        className="
          relative overflow-hidden rounded-md transition-transform duration-300 ease-out
          group-hover:scale-[1.02] group-hover:shadow-xl group-hover:shadow-black/60
          group-focus-visible:scale-[1.02] group-focus-visible:shadow-xl group-focus-visible:shadow-black/60
        "
      >
        <div className="aspect-4/3 bg-neutral-900 relative">
          {imageUrl ? (
            <LazyImage
              src={imageUrl}
              alt={`${show.Artist} - ${show.VenueName}`}
              className="w-full h-full object-cover object-center"
              placeholderColor={getColorFromString(show.Artist)}
            />
          ) : (
            <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
              <span className="text-4xl font-bold text-white/20">{artistInitials}</span>
            </div>
          )}

          {/*
            Hover layers, over the image or the initials alike.

            Tried and rejected: content-visibility on this group and the
            caption, to make the page cheaper to restyle when App sets
            `inert`. Once `inert` moved to the end of the drawer animation it
            no longer sped up opening, and it cost smoothness on fast scrolls.
            Never put it on the image: inside a skipped subtree, loading="lazy"
            does not fetch until the card is nearly on screen, and cards
            scroll into view blank.
          */}
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent transition-opacity duration-200 ${reveal}`} />

            {/* Hover overlay — venue + duration */}
            <div
              className={`
                absolute bottom-0 left-0 right-0 p-3
                transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                translate-y-[5px] group-hover:translate-y-0 group-focus-visible:translate-y-0 ${reveal}
              `}
            >
              <div className="space-y-0.5">
                {searchMode === 'artist' && (
                  <p className="text-xs text-gray-200 truncate leading-snug">{show.Artist}</p>
                )}
                {durationMin > 0 && (
                  <p className="text-xs text-gray-300">{durationText}</p>
                )}
              </div>
            </div>

            {/* Recording type badge — bottom-right on hover */}
            {show.RecordingType && (
              <div className={`absolute bottom-2 right-2 z-10 transition-opacity duration-150 ${reveal}`}>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide ${getRecordingBadgeStyle(show.RecordingType)}`}>
                  {show.RecordingType.split(' ')[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Always-visible metadata below card */}
      <div className="mt-2 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-white truncate leading-snug">{line1}</p>
          {year && (
            <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">{year}</span>
          )}
        </div>
        {line2 && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-snug">{line2}</p>
        )}
      </div>
    </button>
  );
});
