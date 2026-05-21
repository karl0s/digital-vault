import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';
import { CloseButton } from './CloseButton';

interface ShowDrawerProps {
  show: Show;
  onClose: () => void;
  getImageUrl?: (checksum: string, index: number) => string | null;
}

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

const LAYOUT_TRANSITION = { duration: 0.38, ease: [0.16, 1, 0.3, 1] };

export function ShowDrawer({ show, onClose, getImageUrl }: ShowDrawerProps) {
  // expandedFromIndex: which thumbnail was clicked (anchors the layoutId for open/close animation)
  // viewingIndex: which image is currently shown (changes on prev/next without affecting layoutId)
  const [expandedFromIndex, setExpandedFromIndex] = useState<number | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);
  const isImageExpanded = expandedFromIndex !== null;

  const images = show.ChecksumSHA1
    ? [1, 2, 3, 4].map(i => getImageUrl ? getImageUrl(show.ChecksumSHA1!, i) : `/images/${show.ChecksumSHA1}_0${i}.jpg`).filter(Boolean) as string[]
    : [];

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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
        className="fixed bottom-0 md:top-0 left-0 md:left-auto right-0 md:right-0 w-full md:w-[58vw] lg:w-[52vw] h-[88vh] md:h-full bg-[#181818] z-50"
        initial={{ x: isMobile ? 0 : '100%', y: isMobile ? '100%' : 0 }}
        animate={{ x: 0, y: 0 }}
        exit={{ x: isMobile ? 0 : '100%', y: isMobile ? '100%' : 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
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
                <span className="absolute top-4 left-4 md:top-6 md:left-6 py-2 md:py-3 text-xs text-gray-500 tabular-nums">
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
                  <div className="flex gap-1.5 items-center">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setViewingIndex(i)}
                        className={`rounded-full transition-all duration-200 ${
                          i === viewingIndex
                            ? 'w-2 h-2 bg-white'
                            : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                        }`}
                        aria-label={`Go to image ${i + 1}`}
                      />
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

        {/* Scrollable content */}
        <div className="h-full overflow-y-auto">
          {/* Close button — hidden when image viewer is open to avoid z-index conflict with fixed positioning */}
          {!isImageExpanded && (
            <CloseButton
              onClick={onClose}
              className="sticky md:fixed top-4 md:top-6 right-4 md:right-6 z-60 ml-auto mr-4 mt-4 md:m-0 block"
            />
          )}

          {/* Hero image — tall, cinematic */}
          <div className="relative h-56 md:h-[42vh] bg-[#0d0d0d] overflow-hidden">
            {images.length > 0 ? (
              <>
                <img
                  src={images[0]}
                  alt={show.Artist}
                  className="w-full h-full object-cover object-top opacity-55"
                />
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
              <h1
                className="text-white leading-none mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(32px, 5vw, 56px)',
                  letterSpacing: '0.04em',
                }}
              >
                {show.Artist}
              </h1>
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

              {/* Metadata badges: recording type, duration, TV standard */}
              <div className="flex flex-wrap gap-1.5">
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

            {/* Screenshots */}
            {images.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-3">
                  Screenshots
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => openImage(idx)}
                      className="group/thumb hover:ring-2 hover:ring-white/30 transition-all"
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

            {/* Setlist · Technical · Notes — 3-column flat layout, same visual style throughout */}
            <div className={`grid grid-cols-1 gap-6 ${
              setlistItems.length > 0 && show.Notes ? 'md:grid-cols-3' :
              setlistItems.length > 0 || show.Notes ? 'md:grid-cols-2' : ''
            }`}>

              {/* Setlist */}
              {setlistItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-4 flex items-center gap-1.5">
                    <Music className="w-3 h-3" /> Setlist
                  </p>
                  <ol className="space-y-2">
                    {setlistItems.map((song, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-700 tabular-nums text-xs w-5 shrink-0 pt-px text-right">
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-4">
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
                  ].filter(Boolean).map(({ label, value, mono }) => (
                    <div key={label} className="flex items-start gap-3 text-sm">
                      <span className="text-gray-700 text-xs w-16 shrink-0 pt-px">{label}</span>
                      <span className={`text-gray-200 leading-snug ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {show.Notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-4">
                    Notes
                  </p>
                  <div className="relative">
                    <p className={`text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed ${notesExpanded ? '' : 'max-h-24 overflow-hidden'}`}>
                      {show.Notes}
                    </p>
                    {!notesExpanded && show.Notes.length > 200 && (
                      <>
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-[#181818] to-transparent pointer-events-none" />
                        <button
                          onClick={() => setNotesExpanded(true)}
                          className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          More
                        </button>
                      </>
                    )}
                    {notesExpanded && (
                      <button
                        onClick={() => setNotesExpanded(false)}
                        className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 hover:text-gray-400 transition-colors block"
                      >
                        Less
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
