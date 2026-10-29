import { Fragment, memo, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';
import type { ImageUrlGetter } from '../src/hooks/useShows';
import type { SongHit } from '../src/search/searchIndex';
import { quality, lengthName, dateName } from '../src/lib/specs';
import { copyCount } from '../src/lib/copies';
import { BADGE_DAYS, addedWithin } from '../src/lib/added';

interface ShowCardProps {
  show: Show;
  /**
   * Receives the show, rather than being a per-card `() => onClick(show)`
   * closure, so every card gets the same function and `memo` below can hold.
   */
  onSelect: (show: Show) => void;
  getImageUrl?: ImageUrlGetter;
  /** 'artist' on an artist's page, where the artist is the same on every card. */
  searchMode?: 'artist' | 'search';
  /**
   * Set when a search found this show by a song: the songs that matched, said
   * on the card so it is clear why the show is there. From the search's
   * memoised result, so the same array on every render.
   */
  songHits?: SongHit[];
}

/** Text with the matched letters lit. */
function Marked({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={start} className="bg-transparent font-semibold text-white">{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
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

/**
 * Badges for what the record is, when it is not a plain live show:
 * New (added in the last month), Documentary, or Excerpt (cut from a longer
 * broadcast) — and, quieter, when
 * the collection holds the show more than once ("3 copies", F2), so look-alike
 * cards say why they look alike. How it was filmed gets no badge (owner,
 * 2026-10-15); quality is in the line under the title instead.
 */
function exceptions(show: Show): { label: string; tone: string; title?: string }[] {
  const out: { label: string; tone: string; title?: string }[] = [];
  // Added in the last month (F11): "New" for a new show and a new copy alike — the card
  // has no room for more (owner, 2026-10-29); the drawer's Added line says which.
  if (addedWithin(show, BADGE_DAYS)) out.push({ label: 'New', tone: 'bg-emerald-300 text-[#052e1c]', title: `Added ${show.AddedOn}` });
  if (show.ContentType === 'Documentary') out.push({ label: 'Documentary', tone: 'bg-violet-400/95 text-[#160c2e]' });
  if (show.ParentShowID) out.push({ label: 'Excerpt', tone: 'bg-white/90 text-[#111]', title: 'Cut from a longer broadcast' });
  const copies = copyCount(show);
  if (copies > 1) out.push({ label: `${copies} copies`, tone: 'bg-black/70 text-white ring-1 ring-inset ring-white/25', title: `${copies} recordings of this show: compare them in the show` });
  return out;
}

/**
 * The show card, "Cinematic" (owner, 2026-10-15): the still is the card. On a
 * bottom gradient, the artist and "event · year"; the length top-right; badges
 * top-left only for what is unusual. Hover or keyboard focus crossfades to the
 * show's second still; the text never moves. Designed on
 * ~/VaultShots/reports/show-card-directions.html (direction 02).
 *
 * The hover is plain CSS (`group-hover`, `group-focus-visible`), never motion
 * components: ~1,200 cards re-rendering together was the drawer's old cost.
 * The second still mounts on a card's first hover or focus (that card alone
 * re-renders) and fades in once loaded, so a page of cards never loads twice
 * the images. It is the build's WebP of slot 2, asked for first and alone;
 * the drawer's prefetch waits until it has landed (2026-10-16: hover to fully
 * shown went from ~0.8 s to ~0.3 s on a 20 Mbit/s line). On a mouse device
 * src/lib/hoverPreload.ts has usually fetched it already, from
 * `data-hover-src`, so the first hover finds it in the cache.
 *
 * Memoised: with stable props (see `onSelect`, and `getImageUrl` in useShows)
 * opening the drawer or touching a filter no longer re-renders every card.
 */
export const ShowCard = memo(function ShowCard({ show, onSelect, getImageUrl, searchMode, songHits }: ShowCardProps) {
  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  const length = lengthName(show.DurationSec);
  const badges = exceptions(show);
  // The quiet spec line (F2, agreed 2026-10-16): the date in full, and the
  // quality traders compare first.
  const spec = [dateName(show), quality(show)?.label].filter(Boolean).join(' · ');

  const imageUrl = show.ChecksumSHA1
    ? (getImageUrl ? getImageUrl(show.ChecksumSHA1, 1) : `/images/${show.ChecksumSHA1}_01.jpg`)
    : null;
  // What the card actually loads: the build's 640px WebP of the same image —
  // more pixels than a card ever shows, a fraction of the bytes and decode
  // memory. The original stays as the fallback.
  const thumbUrl = show.ChecksumSHA1 && getImageUrl ? getImageUrl(show.ChecksumSHA1, 1, 'thumb') : imageUrl;
  // The second still, for the hover crossfade: the build's WebP of slot 2,
  // with the original as the fallback.
  const secondThumb = show.ChecksumSHA1 && getImageUrl ? getImageUrl(show.ChecksumSHA1, 2, 'thumb') : null;
  const secondOriginal = show.ChecksumSHA1 && getImageUrl ? getImageUrl(show.ChecksumSHA1, 2) : null;

  // Title and line under it. On an artist's page the artist is on every card,
  // so the event leads; everywhere else, the artist.
  const location = [show.City, show.Country].filter(Boolean).join(', ');
  const title = searchMode === 'artist'
    ? (show.EventOrFestival || show.VenueName || location || show.Artist)
    : show.Artist;
  const sub = searchMode === 'artist'
    ? (show.EventOrFestival ? (show.VenueName || show.City) : show.VenueName ? show.City : '')
    : (show.EventOrFestival || show.VenueName || show.City || show.Country);

  const artistInitials = show.Artist
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [secondSrc, setSecondSrc] = useState<string | null>(null);
  const [secondReady, setSecondReady] = useState(false);

  // Warm the drawer's originals, once, at low priority. A ref, not state:
  // remembering that it has already happened must not re-render the card.
  const prefetched = useRef(false);
  const prefetchDrawer = () => {
    if (prefetched.current || !show.ChecksumSHA1) return;
    prefetched.current = true;
    [1, 2, 3, 4].forEach(i => {
      const url = getImageUrl ? getImageUrl(show.ChecksumSHA1!, i) : `/images/${show.ChecksumSHA1}_0${i}.jpg`;
      if (!url) return;
      const img = new Image();
      img.fetchPriority = 'low';
      img.src = url;
    });
  };
  // First hover or focus: the hover still goes first and alone. The drawer's
  // four originals used to start at the same moment and share the line with
  // it; now they follow once it lands, or after 300ms at the latest.
  const warm = () => {
    if (!secondSrc && (secondThumb || secondOriginal)) setSecondSrc(secondThumb || secondOriginal);
    if (!prefetched.current) setTimeout(prefetchDrawer, 300);
  };

  return (
    // A real <button>, not a div: this is the only way to open a show, so it
    // has to be reachable by keyboard. Focus does what hover does.
    <button
      type="button"
      id={`show-${show.ShowID}`}
      data-show-year={year}
      // What src/lib/hoverPreload.ts fetches ahead of a hover.
      data-hover-src={secondThumb || secondOriginal || undefined}
      className="group relative z-0 block w-full cursor-pointer text-left focus-visible:outline-none"
      // The whole name, place and date on hover: a narrow card cuts them short (F17).
      title={`${show.Artist} — ${[show.EventOrFestival, show.VenueName, location].filter(Boolean).join(', ')} · ${spec}`}
      onClick={() => onSelect(show)}
      onMouseEnter={warm}
      onFocus={warm}
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-[10px] bg-neutral-900 group-focus-visible:ring-2 group-focus-visible:ring-white/85 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#141414]">
        {imageUrl ? (
          <LazyImage
            src={thumbUrl}
            fallbackSrc={imageUrl}
            alt={`${show.Artist} - ${show.VenueName}`}
            className="w-full h-full object-cover object-center"
            placeholderColor={getColorFromString(show.Artist)}
          />
        ) : (
          <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
            <span className="text-4xl font-bold text-white/20">{artistInitials}</span>
          </div>
        )}

        {/* The second still, faded in over 200ms and out over 300ms, both
            ease-out so the change starts at once. The hover classes apply
            only once it has loaded, so the first hover fades rather than
            snapping. Tailwind's hover: is hover-capable
            devices only, so a tap on a phone never triggers it. */}
        {secondSrc && (
          <img
            src={secondSrc}
            alt=""
            decoding="async"
            {...{ fetchpriority: 'high' }}
            // Two frames later, so the still is drawn once at opacity 0 and the
            // fade runs even when it came straight from the preload cache.
            onLoad={() => { requestAnimationFrame(() => requestAnimationFrame(() => setSecondReady(true))); prefetchDrawer(); }}
            onError={() => { if (secondSrc !== secondOriginal && secondOriginal) setSecondSrc(secondOriginal); }}
            className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              secondReady ? 'group-hover:opacity-100 group-hover:duration-200 group-focus-visible:opacity-100 group-focus-visible:duration-200' : ''
            }`}
          />
        )}

        {/*
          Tried and rejected: content-visibility on the card's layers, to make
          the page cheaper to restyle when App sets `inert`. Once `inert` moved
          to the end of the drawer animation it no longer sped up opening, and
          it cost smoothness on fast scrolls. Never put it on the image: inside
          a skipped subtree, loading="lazy" does not fetch until the card is
          nearly on screen, and cards scroll into view blank.
        */}
        <div
          className={`pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/55 via-30% to-transparent ${songHits?.length ? 'to-80%' : 'to-70%'}`}
        />

        {/* One row, so two badges on a narrow card wrap under each other
            instead of running beneath the length. */}
        {(badges.length > 0 || length) && (
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start gap-1">
            <div className="flex min-w-0 flex-wrap gap-1">
              {badges.map(b => (
                <span key={b.label} title={b.title} className={`rounded-[3px] px-[5px] pt-1 pb-[3px] text-2xs font-bold uppercase leading-none tracking-[0.08em] ${b.tone}`}>
                  {b.label}
                </span>
              ))}
            </div>
            {length && (
              <span className="ml-auto shrink-0 rounded bg-black/75 px-1.5 py-1 text-xs font-semibold leading-none tabular-nums text-white">
                {length}
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-3 bottom-[11px]">
          <p className="truncate text-sm font-semibold leading-tight text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] 2xl:text-[15px]">
            {title}
          </p>
          {songHits && songHits.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs leading-snug text-white/85">
              <Music2 className="h-3 w-3 shrink-0 text-white/60" aria-hidden="true" />
              <span className="truncate">
                {songHits.map((hit, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="text-white/50"> · </span>}
                    <Marked text={hit.title} ranges={hit.ranges} />
                  </Fragment>
                ))}
              </span>
            </p>
          )}
          {/* Where, then when and how well: each line shortens on its own. */}
          {sub && <p className="mt-0.5 truncate text-xs leading-snug text-white/80">{sub}</p>}
          <p className="mt-0.5 truncate text-xs leading-snug tabular-nums text-white/80">{spec}</p>
        </div>
      </div>
    </button>
  );
});
