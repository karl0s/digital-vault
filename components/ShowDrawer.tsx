import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useIsPresent } from 'motion/react';
import { Clock, Music, ChevronLeft, ChevronRight, ChevronDown, Layers, Link2, Share2, Check, Copy } from 'lucide-react';
import { Show } from '../App';
import { CloseButton } from './CloseButton';
import type { ImageUrlGetter } from '../src/hooks/useShows';
import { scrollContainerToTop } from '../src/lib/motion';
import { showLink } from '../src/lib/url';
import { quality, videoName, audioName, containerName, channelsName, aspectName, sampleRateName, lengthName, sourceName } from '../src/lib/specs';
import { copiesOf } from '../src/lib/copies';

interface ShowDrawerProps {
  show: Show;
  onClose: () => void;
  getImageUrl?: ImageUrlGetter;
  /** Every loaded show — used to resolve the master / linked-record relationship. */
  shows?: Show[];
  /** Switch the open drawer to another show (a master or one of its linked records). */
  onOpenShow?: (show: Show) => void;
  /** Called once the drawer has finished sliding in (see the inert note in App). */
  onSettled?: () => void;
  /**
   * This show's Notes. They load separately from the shows (useShows'
   * getNotes), so they are passed in rather than read off `show`.
   */
  notes?: string;
}

/** "0:23:19" -> "23:19"; keeps the hour only when there is one. */
const shortTime = (t?: string): string => {
  if (!t) return '';
  const [h, m, s] = t.split(':');
  return h && h !== '0' && h !== '00' ? `${parseInt(h)}:${m}:${s}` : `${parseInt(m)}:${s}`;
};

const songCount = (setlist?: string): number =>
  setlist ? setlist.split(';').map(s => s.trim()).filter(s => s && s !== 'Encore break').length : 0;

/** How a master is named in a linked record's "Part of" label. */
const masterTitle = (m: Show): string =>
  [m.EventOrFestival || m.VenueName, m.ShowDate ? m.ShowDate.slice(0, 4) : ''].filter(Boolean).join(' ') || m.Artist;

const getRecordingBadgeStyle = (type: string): string => {
  const lower = type.toLowerCase();
  if (lower.includes('soundboard')) return 'bg-amber-500/15 text-amber-400 border border-amber-500/25';
  if (lower.includes('audience'))   return 'bg-sky-500/15 text-sky-400 border border-sky-500/25';
  if (lower.includes('proshot'))    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25';
  return 'bg-white/8 text-white/60 border border-white/12';
};

const getColorFromString = (str: string): string => {
  const colors = [
    'bg-red-900', 'bg-blue-900', 'bg-green-900', 'bg-purple-900',
    'bg-pink-900', 'bg-indigo-900', 'bg-yellow-900', 'bg-teal-900',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const LAYOUT_TRANSITION = { duration: 0.38, ease: [0.16, 1, 0.3, 1] as const };

/** One row of the drawer's Technical column. */
type TechRow = { label: string; value: string; mono: boolean };

/**
 * Lineage as chains of steps, for the Technical panel: " | " separates sources
 * or passes, an arrow ("->", "=>", ">>", ">", "→") the steps of one. A
 * lineage with no arrows (a sentence, "Pro-shot") is a single step. Tapers'
 * names never reach it: shows.json carries none (CLAUDE.md, Tapers are never
 * named).
 */
function lineageChains(text?: string): string[][] {
  if (!text) return [];
  return text.split(/\s+\|\s+/)
    .map(segment => segment.split(/\s*(?:-+>+|=+>+|>+|→)\s*/).map(step => step.trim()).filter(Boolean))
    .filter(chain => chain.length > 0);
}

export function ShowDrawer({ show, onClose, getImageUrl, shows = [], onOpenShow, onSettled, notes = '' }: ShowDrawerProps) {
  // False while the drawer animates out, so finishing that animation is not
  // mistaken for having settled in.
  const isPresent = useIsPresent();
  // expandedFromIndex: which thumbnail was clicked (anchors the layoutId for open/close animation)
  // viewingIndex: which image is currently shown (changes on prev/next without affecting layoutId)
  const [expandedFromIndex, setExpandedFromIndex] = useState<number | null>(null);
  // Below md the Technical panel folds behind a toggle; from md it is always open.
  const [techOpen, setTechOpen] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const isImageExpanded = expandedFromIndex !== null;
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = `drawer-title-${show.ShowID}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLDivElement>(null);
  // Set while the header is docked; a tap on it then scrolls back to the top.
  const dockedRef = useRef(false);
  const viewerBackRef = useRef<HTMLButtonElement>(null);

  // A linked record points at its master; a master is pointed at by its linked records.
  const parent = show.ParentShowID ? shows.find(s => s.ShowID === show.ParentShowID) : undefined;
  const segments = shows
    .filter(s => s.ParentShowID === show.ShowID)
    .sort((a, b) => (a.SegmentStart || '').localeCompare(b.SegmentStart || '', undefined, { numeric: true }));

  // Moving between a master and its linked records swaps the show without
  // remounting the drawer, so reset per-show state and return to the top.
  useEffect(() => {
    setExpandedFromIndex(null);
    setTechOpen(false);
    setViewingIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [show.ShowID]);

  /**
   * The docking header. It is sticky with a negative `top`, so it rides up
   * until only its foot — the title — is left on screen, then stays. `--p`
   * (0 at rest, 1 docked) is written straight from the scroll position onto
   * the drawer, and the `drawer-dock-*` rules in styles/globals.css follow it:
   * the title shrinks, the fade under it appears, the close button settles
   * into the bar. Written to the DOM, not state, so scrolling never
   * re-renders the drawer.
   *
   * Measured at rest and docked, again whenever the drawer changes size (the
   * header's vh height, rewrapped titles) and once the fonts have loaded.
   * Until the first measure the header is simply not sticky yet.
   */
  useEffect(() => {
    const drawer = drawerRef.current, hero = heroRef.current, title = heroTitleRef.current, scroller = scrollRef.current;
    if (!drawer || !hero || !title || !scroller) return;
    let range = 1;
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, scroller.scrollTop / range));
      drawer.style.setProperty('--p', p.toFixed(4));
      dockedRef.current = p > 0.98;
      drawer.toggleAttribute('data-docked', dockedRef.current);
    };
    const measure = () => {
      drawer.style.setProperty('--p', '0');
      hero.style.height = '';
      hero.style.top = '';
      const height = hero.offsetHeight;
      // The close button sits outside the scroll area. Read at rest (--p 0,
      // so untransformed), or a second measure would read its docked place.
      const close = drawer.querySelector<HTMLElement>('.drawer-dock-close');
      const d = drawer.getBoundingClientRect(), c = close?.getBoundingClientRect();
      drawer.style.setProperty('--p', '1');
      const docked = title.offsetHeight;
      range = Math.max(1, height - docked);
      // A fixed height, so the title shrinking never moves the content below it.
      hero.style.height = `${height}px`;
      hero.style.top = `${-range}px`;
      // Docked, the close button's centre sits on the bar's.
      if (c) drawer.style.setProperty('--close-dy', `${docked / 2 - (c.top - d.top + c.height / 2)}px`);
      onScroll();
    };
    // After the first frame, not in it: measuring forces two layouts of the
    // whole drawer, and in the click's frame that delayed the slide-in
    // (npm run perf, open at 4x 116 -> 166 ms). Nothing can scroll before then.
    let live = true;
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { if (live) measure(); }); });
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (live) measure(); });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    // Skips the call observe() makes at once; later calls are real resizes.
    let initial = true;
    const ro = new ResizeObserver(() => { if (initial) initial = false; else measure(); });
    ro.observe(drawer);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [show.ShowID]);

  /**
   * Which way the drawer leaves. Read from matchMedia rather than a one-off
   * window.innerWidth snapshot, which never updated — rotate a tablet with the
   * drawer open and it used to exit sideways off a phone-shaped viewport.
   */
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsMobile(!mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Move focus in on open, restore it to the card that opened the drawer on
  // close. Without this, focus stays on a card behind an inert subtree.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const images = show.ChecksumSHA1
    ? [1, 2, 3, 4].map(i => getImageUrl ? getImageUrl(show.ChecksumSHA1!, i) : `/images/${show.ChecksumSHA1}_0${i}.jpg`).filter(Boolean) as string[]
    : [];

  // The header shows the card's thumbnail straight away — almost always
  // cached from the card just clicked — and fades the original in over it.
  // Keyed by src, so moving to a linked record starts the fade over.
  const heroThumb = show.ChecksumSHA1 && getImageUrl ? getImageUrl(show.ChecksumSHA1, 1, 'thumb') : null;
  const [heroLoadedSrc, setHeroLoadedSrc] = useState<string | null>(null);
  const heroReady = !heroThumb || heroLoadedSrc === images[0];

  function openImage(idx: number) {
    setExpandedFromIndex(idx);
    setViewingIndex(idx);
  }
  // Back to the thumbnails, with focus on the one the viewer was opened from.
  function closeImage() {
    const from = expandedFromIndex;
    setExpandedFromIndex(null);
    requestAnimationFrame(() =>
      drawerRef.current?.querySelector<HTMLElement>(`[data-thumb="${from}"]`)?.focus({ preventScroll: true }));
  }
  function prevImage() { setViewingIndex(i => (i > 0 ? i - 1 : images.length - 1)); }
  function nextImage() { setViewingIndex(i => (i < images.length - 1 ? i + 1 : 0)); }

  useEffect(() => {
    if (isImageExpanded) viewerBackRef.current?.focus({ preventScroll: true });
  }, [isImageExpanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (isImageExpanded) closeImage(); else onClose(); }
      if (isImageExpanded) {
        if (e.key === 'ArrowLeft') prevImage();
        if (e.key === 'ArrowRight') nextImage();
      }
      // Focus trap. The background is inert, so without this Tab would fall
      // through to the browser chrome and strand the user outside the drawer.
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.offsetParent !== null && !el.closest('[inert]'));
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        // Focus sitting on the drawer container itself (right after open).
        if (active === drawerRef.current) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isImageExpanded]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // One length format everywhere: "1h 05m", "43 min" (F17).
  const durationFormatted = lengthName(show.DurationSec) || null;

  const setlistItems = show.Setlist ? show.Setlist.split(';').map(s => s.trim()).filter(Boolean) : [];

  // The Setlist heading is always drawn, so a show without songs says so
  // instead of letting Technical take the place people read as the setlist.
  const emptySetlistText = segments.length > 0
    ? "Each act's songs are on its own page, under On this recording"
    : show.ContentType === 'Documentary'
      ? 'Documentary, no setlist'
      : 'No setlist yet';

  // Specs in traders' words (src/lib/specs.ts). PAL/NTSC only for SD: on an
  // HD record the field is unreliable (most 1080-line copies say NTSC), and the
  // quality label says what matters. Size and file count describe the whole
  // folder, which can hold more than this show, so the row says so.
  const q = quality(show);
  const folder = [show.TotalSizeHuman, show.FileCount && `${show.FileCount} ${show.FileCount === '1' ? 'file' : 'files'}`].filter(Boolean).join(' · ');
  const techRows = [
    show.VideoCodec  && { label: 'Video',       value: videoName(show.VideoCodec),            mono: false },
    q                && { label: 'Resolution',  value: q.resolution,                          mono: false },
    show.AspectRatio && { label: 'Aspect',      value: aspectName(show.AspectRatio),          mono: false },
    q?.tier !== 'hd' && show.TVStandard && { label: 'Standard', value: show.TVStandard,       mono: false },
    show.Container   && { label: 'Container',   value: containerName(show.Container),         mono: false },
    show.AudioCodec  && { label: 'Audio',       value: audioName(show.AudioCodec),            mono: false },
    channelsName(show.AudioChannels) && { label: 'Channels', value: channelsName(show.AudioChannels), mono: false },
    sampleRateName(show.AudioSampleRate) && { label: 'Sample rate', value: sampleRateName(show.AudioSampleRate), mono: false },
    folder           && { label: 'Folder',      value: folder,                                mono: false },
  ].filter((row): row is TechRow => Boolean(row));
  const lineage = lineageChains(show.Lineage);

  /**
   * Share one exact recording (F4). The share sheet on touch devices, titled
   * with a line that says which copy; elsewhere "Copy link" puts the link
   * alone on the clipboard as plain text — so it pastes into an address bar
   * or a chat as a working link — and, as rich text, that line linked to the
   * show, so it pastes into an email as "30 Seconds to Mars · 2010-06-05 ·
   * Rock am Ring · HD 1080 · 43 min". A trader replying to the owner names the
   * copy, not just the show.
   */
  const reference = [
    show.Artist,
    show.ShowDate || 'undated',
    show.EventOrFestival || show.VenueName,
    q?.label,
    durationFormatted,
  ].filter(Boolean).join(' · ');

  /**
   * Every recording of this show, side by side (F2): the question traders
   * come with is which copy is best, and look-alike cards could not answer it.
   * The specs that tell copies apart, the open one marked; the others open in
   * place, like a linked record.
   */
  const copies = copiesOf(show);
  const copySpecs = (c: Show) => {
    const cq = quality(c);
    return [
      sourceName(c.RecordingType),
      videoName(c.VideoCodec),
      containerName(c.Container),
      [audioName(c.AudioCodec), channelsName(c.AudioChannels)].filter(Boolean).join(' '),
      cq?.tier !== 'hd' && c.TVStandard,
      c.TotalSizeHuman,
      c.ParentShowID && 'excerpt',
    ].filter(Boolean).join(' · ');
  };
  const shareSheet = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [show.ShowID]);
  async function share(e: React.MouseEvent) {
    // The docked header scrolls to the top on a click; this click is the button's.
    e.stopPropagation();
    const url = showLink(show.ShowID);
    if (shareSheet) {
      try { await navigator.share({ title: reference, url }); } catch { /* dismissed */ }
      return;
    }
    const html = `<a href="${url}">${reference.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a>`;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([url], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
    } catch {
      // No rich clipboard (older browsers): the link alone still works.
      try { await navigator.clipboard.writeText(url); } catch { return; }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  const techId = `drawer-tech-${show.ShowID}`;

  const artistInitials = show.Artist
    .split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/75 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Drawer — overflow-y-auto moved to inner div so overlay can cover full drawer height */}
      <motion.div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed bottom-0 md:top-0 left-0 md:left-auto right-0 md:right-0 w-full md:w-[58vw] lg:w-[52vw] 2xl:w-[41.6vw] 3xl:w-[33.3vw] h-dvh md:h-full bg-[#181818] z-50 focus:outline-none"
        initial={{ x: isMobile ? 0 : '100%', y: isMobile ? '100%' : 0 }}
        animate={{ x: 0, y: 0 }}
        exit={{ x: isMobile ? 0 : '100%', y: isMobile ? '100%' : 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={() => { if (isPresent) onSettled?.(); }}
      >
        {/* In-drawer image viewer */}
        <AnimatePresence>
          {isImageExpanded && (
            <motion.div
              key="img-overlay"
              // Above the sticky header (z-20), below the drawer's close button (z-60).
              className="absolute inset-0 z-30 flex flex-col bg-[#0d0d0d]/97 cursor-zoom-out"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.18 }}
              // A click on the dark around the picture goes back, as Esc and Back do.
              onClick={e => { if (!(e.target as HTMLElement).closest('button, img, a')) closeImage(); }}
            >
              {/* Back to the thumbnails: the close button's twin, mirrored on
                  the left. The drawer's own close button stays over the viewer
                  and still closes the show, so × means one thing everywhere.
                  drawer-dock-back moves both with the docked header. */}
              <button
                ref={viewerBackRef}
                type="button"
                onClick={closeImage}
                aria-label="Back to the show"
                className="drawer-dock-back absolute top-4 left-4 md:top-6 md:left-6 p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Where you are, set like the docked header bar. */}
              <div className="drawer-dock-follow absolute top-4 md:top-6 left-16 md:left-[88px] right-16 md:right-20 h-9 md:h-12 flex flex-col justify-center pointer-events-none">
                <p
                  className="text-white text-[22px] md:text-2xl leading-none truncate"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
                >
                  {show.Artist}
                </p>
                <p className="mt-1 text-xs text-gray-400 tabular-nums">
                  {images.length > 1 ? `Screenshot ${viewingIndex + 1} of ${images.length}` : 'Screenshot'}
                  {/* The original JPEG in a tab of its own, at 100%: the viewer
                      fits the drawer, too small to judge an encode (F14). */}
                  {' · '}
                  <a
                    href={images[viewingIndex]}
                    target="_blank"
                    rel="noopener"
                    className="pointer-events-auto underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white/60 transition-colors"
                  >
                    Open full size
                  </a>
                </p>
              </div>

              {/* Image — top padding clears the absolutely-positioned close button */}
              <div className="flex-1 flex items-center justify-center min-h-0 px-6 pt-14 md:pt-20">
                <motion.div
                  layoutId={`drawer-img-${show.ShowID}-${expandedFromIndex}`}
                  style={{ borderRadius: 8 }}
                  transition={LAYOUT_TRANSITION}
                >
                  <img
                    src={images[viewingIndex]}
                    alt={`Screenshot ${viewingIndex + 1}`}
                    className="max-w-full max-h-[62vh] object-contain cursor-default"
                    style={{ display: 'block', borderRadius: 8 }}
                  />
                </motion.div>
              </div>

              {/* Footer: prev / dots / next */}
              {images.length > 1 && (
                <div className="flex items-center justify-center gap-4 py-5 shrink-0">
                  <button
                    onClick={prevImage}
                    className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                  {/* The dot stays 6–8px; the button around it is 24×24 so the
                      target clears the WCAG minimum. Padding, not a bigger dot. */}
                  <div className="flex items-center">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setViewingIndex(i)}
                        className="p-2 flex items-center justify-center"
                        aria-label={`Go to image ${i + 1}`}
                        aria-current={i === viewingIndex ? 'true' : undefined}
                      >
                        <span
                          className={`block rounded-full transition-[width,height,background-color] duration-200 ${
                            i === viewingIndex
                              ? 'w-2 h-2 bg-white'
                              : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={nextImage}
                    className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close button — outside scroll div so it never occupies flow space
            on mobile. Shown over the image viewer too: it always closes the show. */}
        <CloseButton
          onClick={onClose}
          className="drawer-dock-close absolute top-4 right-4 md:fixed md:top-6 md:right-6 z-60"
        />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto"
          {...(isImageExpanded ? ({ inert: '' } as Record<string, string>) : {})}
        >

          {/* Hero image. A minimum height, not a fixed one: the title sits in
              the flow at its foot, so a header shorter than the title grows
              to hold it instead of clipping it. Sizes per breakpoint were
              picked by the owner on 2026-10-12 (docs/frontend.md). Sticky:
              it docks as a bar on scroll (the docking effect above). */}
          <div
            ref={heroRef}
            className="drawer-dock-hero sticky z-20 flex flex-col justify-end min-h-56 md:min-h-[21.5vh] bg-[#0d0d0d]"
          >
            {/* Clipped here rather than on the header, so the fade under the
                docked bar can hang below it. */}
            <div className="absolute inset-0 overflow-hidden">
            {images.length > 0 ? (
              <>
                {/* Decorative: it sits at 55% behind a gradient, and the artist
                    name is the heading directly on top of it. The 55% is on
                    the wrapper, not each image, so thumbnail and original
                    never add up to a brighter header mid-fade. */}
                <div className="absolute inset-0 opacity-55">
                  {heroThumb && (
                    <img
                      src={heroThumb}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  )}
                  <img
                    src={images[0]}
                    alt=""
                    onLoad={() => setHeroLoadedSrc(images[0])}
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
                      heroReady ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-[#181818] via-[#181818]/50 to-transparent" />
              </>
            ) : (
              <div className={`absolute inset-0 ${getColorFromString(show.Artist)} flex items-center justify-center`}>
                <span className="text-7xl md:text-9xl font-bold text-white/20"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                  {artistInitials}
                </span>
                <div className="absolute inset-0 bg-linear-to-t from-[#181818] via-[#181818]/40 to-transparent" />
              </div>
            )}
            </div>

            {/* Artist info over hero — in the flow, so it sets the header's
                floor. The right padding clears the close button. Docked, a
                tap on it scrolls back to the top. */}
            <div
              ref={heroTitleRef}
              onClick={() => { if (dockedRef.current) scrollContainerToTop(scrollRef.current); }}
              className="drawer-dock-title relative px-5 md:px-8 pr-16 md:pr-20"
            >
              {/* h2, not h1 — the page owns the single h1, and this heading is
                  also the dialog's accessible name via aria-labelledby. */}
              <h2
                id={titleId}
                className="drawer-dock-name text-white leading-none"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
              >
                {show.Artist}
              </h2>
              <p className="drawer-dock-sub text-gray-400">
                {/* Date · event · venue · city, country: the place always, event
                    or not (F9), each part once. */}
                {[
                  show.ShowDate || 'Undated',
                  show.EventOrFestival || null,
                  show.VenueName && show.VenueName !== show.EventOrFestival && show.VenueName !== show.City ? show.VenueName : null,
                  [show.City, show.Country].filter(Boolean).join(', '),
                ].filter(Boolean).join(' · ')}
              </p>

              {/* Metadata badges: content type, recording type, duration, TV standard */}
              <div className="flex flex-wrap gap-1.5">
                {show.ContentType && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
                    {show.ContentType}
                  </span>
                )}
                {show.RecordingType && (
                  <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${getRecordingBadgeStyle(show.RecordingType)}`}>
                    {sourceName(show.RecordingType)}
                  </span>
                )}
                {durationFormatted && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/8 text-gray-300 border border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {durationFormatted}
                  </span>
                )}
                {q && (
                  <span
                    title={q.resolution}
                    className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/8 text-gray-300 border border-white/10"
                  >
                    {q.label}
                  </span>
                )}
                {q?.tier !== 'hd' && show.TVStandard && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/8 text-gray-300 border border-white/10">
                    {show.TVStandard}
                  </span>
                )}
                {/* An action among facts, so a pill, not a badge (F4). */}
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-100 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                >
                  {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : shareSheet ? <Share2 className="h-3 w-3" aria-hidden="true" /> : <Link2 className="h-3 w-3" aria-hidden="true" />}
                  {copied ? 'Copied' : shareSheet ? 'Share' : 'Copy link'}
                </button>
                <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 md:px-8 py-6 space-y-6">

            {/* Linked record: where it was cut from */}
            {parent && (
              <button
                onClick={() => onOpenShow?.(parent)}
                className="w-full flex items-center gap-3 text-left px-3.5 py-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group/parent"
              >
                <Layers className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-300 min-w-0">
                  <span className="text-gray-400">Part of </span>
                  <span className="text-white font-medium">{masterTitle(parent)}</span>
                  <span className="text-gray-400"> · {parent.Artist}</span>
                  {show.SegmentStart && show.SegmentEnd && (
                    <span className="text-gray-400 tabular-nums"> · {shortTime(show.SegmentStart)}–{shortTime(show.SegmentEnd)}</span>
                  )}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto shrink-0 group-hover/parent:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Screenshots */}
            {images.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
                  Screenshots
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      data-thumb={idx}
                      onClick={() => openImage(idx)}
                      className="shrink-0 w-[42%] md:w-full group/thumb hover:ring-2 hover:ring-white/30 transition-shadow"
                      style={{ borderRadius: 4 }}
                    >
                      <motion.div
                        layoutId={`drawer-img-${show.ShowID}-${idx}`}
                        style={{ borderRadius: 4 }}
                        transition={LAYOUT_TRANSITION}
                      >
                        <img
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full aspect-4/3 object-cover group-hover/thumb:opacity-90 transition-opacity"
                          style={{ display: 'block', borderRadius: 4 }}
                          loading="eager"
                        />
                      </motion.div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Master: every act cut from this recording, in running order */}
            {segments.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" /> On this recording
                </p>
                <ol className="divide-y divide-white/5 border-y border-white/5">
                  {segments.map(seg => {
                    const n = songCount(seg.Setlist);
                    return (
                      <li key={seg.ShowID}>
                        <button
                          onClick={() => onOpenShow?.(seg)}
                          className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-white/5 transition-colors group/seg"
                        >
                          <span className="text-xs text-gray-400 tabular-nums w-24 shrink-0">
                            {shortTime(seg.SegmentStart)}–{shortTime(seg.SegmentEnd)}
                          </span>
                          <span className="text-sm text-white flex-1 min-w-0 truncate">{seg.Artist}</span>
                          {n > 0 && (
                            <span className="text-xs text-gray-400 shrink-0">{n} {n === 1 ? 'song' : 'songs'}</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0 group-hover/seg:text-gray-300 transition-colors" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Every recording of this show, when there is more than one */}
            {copies.length > 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-1.5">
                  <Copy className="w-3 h-3" /> {copies.length} recordings of this show
                </p>
                <ol className="divide-y divide-white/5 border-y border-white/5">
                  {copies.map(c => {
                    const cq = quality(c);
                    const n = songCount(c.Setlist);
                    const current = c.ShowID === show.ShowID;
                    const row = (
                      <>
                        <span className="w-[4.5rem] shrink-0 text-sm font-medium text-white tabular-nums">{cq?.label ?? '—'}</span>
                        <span className="w-16 shrink-0 text-sm text-gray-200 tabular-nums">{lengthName(c.DurationSec) || '—'}</span>
                        <span className="min-w-0 flex-1 text-xs leading-snug text-gray-400">{copySpecs(c)}</span>
                        {n > 0 && <span className="hidden md:inline shrink-0 text-xs text-gray-400">{n} {n === 1 ? 'song' : 'songs'}</span>}
                      </>
                    );
                    return (
                      <li key={c.ShowID}>
                        {current ? (
                          <div className="flex items-baseline gap-3 py-2.5 px-2 -mx-2 rounded bg-white/6" aria-current="true">
                            {row}
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-gray-300">This copy</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onOpenShow?.(c)}
                            className="w-full flex items-baseline gap-3 py-2.5 px-2 -mx-2 text-left rounded hover:bg-white/5 transition-colors group/copy"
                          >
                            {row}
                            <ChevronRight className="w-4 h-4 self-center text-gray-500 shrink-0 group-hover/copy:text-gray-300 transition-colors" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Main column: Setlist, then Notes. Side column: Technical, in a
                panel so it reads as reference detail rather than content. The
                Setlist heading is always drawn, so Technical can never take
                its place. Below md the columns stack and Technical folds
                behind a "Technical details" toggle. */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-start">
              <div className="min-w-0 space-y-6">

              {/* Setlist */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-1.5">
                  <Music className="w-3 h-3" /> Setlist
                </p>
                {setlistItems.length > 0 ? (
                  <ol className="space-y-2">
                    {setlistItems.map((song, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-400 tabular-nums text-xs w-5 shrink-0 pt-px text-right">
                          {idx + 1}
                        </span>
                        <span className="text-gray-200 leading-snug">{song}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm italic text-gray-400">{emptySetlistText}</p>
                )}
              </div>

              {/* Notes */}
              {notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                    Notes
                  </p>
                  {/* In full (owner, 2026-10-12): no clamp, no More. */}
                  <p className="text-[0.8125rem] text-gray-400 whitespace-pre-wrap wrap-break-word font-mono leading-relaxed">
                    {notes}
                  </p>
                </div>
              )}

              </div>

              {/* Technical */}
              {(techRows.length > 0 || show.Generation || lineage.length > 0) && (
                <div className="border-t border-white/6 pt-4 md:rounded-lg md:border md:bg-white/4 md:p-4">
                  <button
                    type="button"
                    onClick={() => setTechOpen(open => !open)}
                    aria-expanded={techOpen}
                    aria-controls={techId}
                    className="md:hidden w-full flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Technical details
                    <ChevronDown className={`w-3 h-3 transition-transform ${techOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <p className="hidden md:block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                    Technical
                  </p>
                  <div id={techId} className={`${techOpen ? 'block' : 'hidden'} md:block space-y-2 mt-4 md:mt-0`}>
                    {techRows.map(({ label, value, mono }) => (
                      <div key={label} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-400 text-xs w-16 shrink-0 pt-px">{label}</span>
                        <span className={`text-gray-200 leading-snug ${mono ? 'font-mono' : ''}`}>{value}</span>
                      </div>
                    ))}

                    {/* Provenance: how this copy came to be, the second thing a
                        trader compares after the specs. Under a hairline so it
                        reads as its own group. */}
                    {(show.Generation || lineage.length > 0) && (
                      <div className={`space-y-2 ${techRows.length > 0 ? 'border-t border-white/6 pt-3 mt-3' : ''}`}>
                        {show.Generation && (
                          <div className="flex items-start gap-3 text-sm">
                            <span className="text-gray-400 text-xs w-16 shrink-0 pt-px">Generation</span>
                            <span className="text-gray-200 leading-snug">{show.Generation}</span>
                          </div>
                        )}
                        {lineage.length > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-400 text-xs">Lineage</span>
                            {/* One step per line on a thin rule, top to bottom: the
                                source first, the file last. */}
                            {lineage.map((chain, i) => (
                              <ol key={i} className={`${i > 0 ? 'mt-3' : 'mt-1.5'} ml-[3px] border-l border-white/12 pl-3 space-y-1`}>
                                {chain.map((step, j) => (
                                  <li
                                    key={j}
                                    className="relative text-gray-200 leading-snug wrap-break-word before:absolute before:-left-[15px] before:top-[0.5em] before:size-[5px] before:rounded-full before:bg-gray-500"
                                  >
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      </motion.div>
    </>
  );
}
