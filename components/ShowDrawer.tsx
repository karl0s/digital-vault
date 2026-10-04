import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useIsPresent } from 'motion/react';
import { Clock, Music, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Show } from '../App';
import { CloseButton } from './CloseButton';
import type { ImageUrlGetter } from '../src/hooks/useShows';

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

export function ShowDrawer({ show, onClose, getImageUrl, shows = [], onOpenShow, onSettled, notes = '' }: ShowDrawerProps) {
  // False while the drawer animates out, so finishing that animation is not
  // mistaken for having settled in.
  const isPresent = useIsPresent();
  // expandedFromIndex: which thumbnail was clicked (anchors the layoutId for open/close animation)
  // viewingIndex: which image is currently shown (changes on prev/next without affecting layoutId)
  const [expandedFromIndex, setExpandedFromIndex] = useState<number | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const isImageExpanded = expandedFromIndex !== null;
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = `drawer-title-${show.ShowID}`;
  const scrollRef = useRef<HTMLDivElement>(null);

  // A linked record points at its master; a master is pointed at by its linked records.
  const parent = show.ParentShowID ? shows.find(s => s.ShowID === show.ParentShowID) : undefined;
  const segments = shows
    .filter(s => s.ParentShowID === show.ShowID)
    .sort((a, b) => (a.SegmentStart || '').localeCompare(b.SegmentStart || '', undefined, { numeric: true }));

  // Moving between a master and its linked records swaps the show without
  // remounting the drawer, so reset per-show state and return to the top.
  useEffect(() => {
    setExpandedFromIndex(null);
    setNotesExpanded(false);
    setViewingIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
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
  function closeImage() { setExpandedFromIndex(null); }
  function prevImage() { setViewingIndex(i => (i > 0 ? i - 1 : images.length - 1)); }
  function nextImage() { setViewingIndex(i => (i < images.length - 1 ? i + 1 : 0)); }

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
        ).filter(el => el.offsetParent !== null);
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

  const durationSec = parseInt(show.DurationSec || '0');
  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.floor((durationSec % 3600) / 60);
  const durationFormatted = durationSec > 0
    ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`)
    : null;

  const setlistItems = show.Setlist ? show.Setlist.split(';').map(s => s.trim()).filter(Boolean) : [];

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
        className="fixed bottom-0 md:top-0 left-0 md:left-auto right-0 md:right-0 w-full md:w-[58vw] lg:w-[52vw] h-dvh md:h-full bg-[#181818] z-50 focus:outline-none"
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
              className="absolute inset-0 z-10 flex flex-col bg-[#0d0d0d]/97"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.18 }}
            >
              {/* Close — identical coords to the drawer close button so there's no jump on dismiss */}
              <CloseButton
                onClick={closeImage}
                className="absolute top-4 right-4 md:top-6 md:right-6"
              />

              {/* Counter — same vertical level, mirrored to the left */}
              {images.length > 1 && (
                <span className="absolute top-4 left-4 md:top-6 md:left-6 py-2 md:py-3 text-xs text-gray-400 tabular-nums">
                  {viewingIndex + 1} / {images.length}
                </span>
              )}

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
                    className="max-w-full max-h-[62vh] object-contain"
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

        {/* Close button — outside scroll div so it never occupies flow space on mobile */}
        {!isImageExpanded && (
          <CloseButton
            onClick={onClose}
            className="absolute top-4 right-4 md:fixed md:top-6 md:right-6 z-60"
          />
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} className="h-full overflow-y-auto">

          {/* Hero image — tall, cinematic */}
          <div className="relative h-56 md:h-[42vh] bg-[#0d0d0d] overflow-hidden">
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
              <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
                <span className="text-7xl md:text-9xl font-bold text-white/20"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                  {artistInitials}
                </span>
                <div className="absolute inset-0 bg-linear-to-t from-[#181818] via-[#181818]/40 to-transparent" />
              </div>
            )}

            {/* Artist info over hero */}
            <div className="absolute bottom-0 left-0 right-0 px-5 md:px-8 pb-5">
              {/* h2, not h1 — the page owns the single h1, and this heading is
                  also the dialog's accessible name via aria-labelledby. */}
              <h2
                id={titleId}
                className="text-white leading-none mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(32px, 5vw, 56px)',
                  letterSpacing: '0.04em',
                }}
              >
                {show.Artist}
              </h2>
              <p className="text-gray-400 text-sm md:text-base mb-3">
                {[
                  show.ShowDate || 'Date Unknown',
                  show.EventOrFestival
                    ? show.EventOrFestival
                    : show.VenueName || null,
                  show.EventOrFestival
                    ? show.Country
                    : [show.City, show.Country].filter(Boolean).join(', '),
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
                    {show.RecordingType}
                  </span>
                )}
                {durationFormatted && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/8 text-gray-300 border border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {durationFormatted}
                  </span>
                )}
                {show.TVStandard && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/8 text-gray-300 border border-white/10">
                    {show.TVStandard}
                  </span>
                )}
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
                  Screenshots
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3 flex items-center gap-1.5">
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

            {/* Setlist · Technical · Notes — 3-column flat layout, same visual style throughout */}
            <div className={`grid grid-cols-1 gap-6 ${
              setlistItems.length > 0 && notes ? 'md:grid-cols-3' :
              setlistItems.length > 0 || notes ? 'md:grid-cols-2' : ''
            }`}>

              {/* Setlist */}
              {setlistItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center gap-1.5">
                    <Music className="w-3 h-3" /> Setlist
                  </p>
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
                </div>
              )}

              {/* Technical */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                  Technical
                </p>
                <div className="space-y-2">
                  {[
                    show.VideoCodec  && { label: 'Video',       value: show.VideoCodec,       mono: true  },
                    show.AspectRatio && { label: 'Aspect',      value: show.AspectRatio,       mono: false },
                    show.TVStandard  && { label: 'Standard',    value: show.TVStandard,        mono: false },
                    show.Container   && { label: 'Container',   value: show.Container,         mono: true  },
                    show.AudioCodec  && { label: 'Audio',       value: show.AudioCodec,        mono: true  },
                    show.AudioChannels && { label: 'Channels',  value: `${show.AudioChannels}ch`, mono: false },
                    show.AudioSampleRate && { label: 'Sample rate', value: `${(parseInt(show.AudioSampleRate) / 1000).toFixed(1)} kHz`, mono: true },
                    show.TotalSizeHuman && { label: 'Size',     value: show.TotalSizeHuman,    mono: false },
                    show.FileCount   && { label: 'Files',       value: show.FileCount,         mono: false },
                  ].filter((row): row is TechRow => Boolean(row)).map(({ label, value, mono }) => (
                    <div key={label} className="flex items-start gap-3 text-sm">
                      <span className="text-gray-400 text-xs w-16 shrink-0 pt-px">{label}</span>
                      <span className={`text-gray-200 leading-snug ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">
                    Notes
                  </p>
                  <div>
                    <div className="relative">
                      <p className={`text-xs text-gray-400 whitespace-pre-wrap wrap-break-word font-mono leading-relaxed ${notesExpanded ? '' : 'max-h-40 overflow-hidden'}`}>
                        {notes}
                      </p>
                      {!notesExpanded && notes.length > 320 && (
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-[#181818] to-transparent pointer-events-none" />
                      )}
                    </div>
                    {!notesExpanded && notes.length > 320 && (
                      <button
                        onClick={() => setNotesExpanded(true)}
                        className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 hover:text-gray-400 transition-colors"
                      >
                        More <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                    {notesExpanded && (
                      <button
                        onClick={() => setNotesExpanded(false)}
                        className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 hover:text-gray-400 transition-colors"
                      >
                        Less <ChevronUp className="w-3 h-3" />
                      </button>
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
