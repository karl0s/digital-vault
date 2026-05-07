import { useState, useEffect } from 'react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';
import { motion, AnimatePresence } from 'motion/react';

interface ShowCardProps {
  show: Show;
  onClick: () => void;
  focused?: boolean;
  getImageUrl?: (checksum: string, index: number) => string | null;
  searchMode?: boolean;
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

const getRecordingBadgeStyle = (type: string): string => {
  const lower = type.toLowerCase();
  if (lower.includes('soundboard')) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  if (lower.includes('audience')) return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
  if (lower.includes('proshot')) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  return 'bg-white/10 text-white/60';
};

export function ShowCard({ show, onClick, focused = false, getImageUrl, searchMode = false }: ShowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [prefetchedImages, setPrefetchedImages] = useState<string[]>([]);

  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  const durationMin = Math.floor(parseInt(show.DurationSec || '0') / 60);
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const imageUrl = show.ChecksumSHA1
    ? (getImageUrl ? getImageUrl(show.ChecksumSHA1, 1) : `/images/${show.ChecksumSHA1}_01.jpg`)
    : null;

  const location = [show.City, show.Country].filter(Boolean).join(', ');
  const locationLabel = show.EventOrFestival || show.VenueName || location;

  const artistInitials = show.Artist
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Prefetch drawer images on hover
  useEffect(() => {
    if (isHovered && show.ChecksumSHA1 && prefetchedImages.length === 0) {
      const urls = [1, 2, 3, 4].map(i =>
        getImageUrl ? getImageUrl(show.ChecksumSHA1!, i) : `/images/${show.ChecksumSHA1}_0${i}.jpg`
      ).filter(Boolean) as string[];
      urls.forEach(url => { const img = new Image(); img.src = url; });
      setPrefetchedImages(urls);
    }
  }, [isHovered, show.ChecksumSHA1, prefetchedImages.length, getImageUrl]);

  const active = focused || isHovered;

  return (
    <div
      id={`show-${show.ShowID}`}
      data-show-year={year}
      className={`group cursor-pointer w-full ${focused ? 'relative z-20' : 'relative z-0'}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className={`
          relative overflow-hidden rounded-md transition-transform duration-300 ease-out
          ${focused
            ? 'scale-[1.03] ring-2 ring-[#E50914] shadow-2xl shadow-black/70'
            : isHovered
              ? 'scale-[1.02] shadow-xl shadow-black/60'
              : ''}
        `}
        style={{ willChange: active ? 'transform' : 'auto' }}
      >
        <div className="aspect-4/3 bg-neutral-900 relative">
          {imageUrl ? (
            <>
              <LazyImage
                src={imageUrl}
                alt={`${show.Artist} - ${show.VenueName}`}
                className="w-full h-full object-cover object-center"
                placeholderColor={getColorFromString(show.Artist)}
              />
              <AnimatePresence>
                {active && (
                  <motion.div
                    className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
              <span className="text-4xl font-bold text-white/20">{artistInitials}</span>
              <AnimatePresence>
                {active && (
                  <motion.div
                    className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Recording type badge — top-right on hover */}
          <AnimatePresence>
            {active && show.RecordingType && (
              <motion.div
                className="absolute top-2 right-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide ${getRecordingBadgeStyle(show.RecordingType)}`}>
                  {show.RecordingType.split(' ')[0].toUpperCase()}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hover overlay — venue + duration */}
          <AnimatePresence>
            {active && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 p-3"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="space-y-0.5">
                  {searchMode && (
                    <p className="text-xs text-gray-200 truncate leading-snug">{show.Artist}</p>
                  )}
                  {durationMin > 0 && (
                    <p className="text-xs text-gray-500">{durationText}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Always-visible metadata below card */}
      <div className="mt-2 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-white truncate leading-snug">
            {searchMode
              ? (show.EventOrFestival || show.VenueName || show.Artist)
              : show.Artist}
          </p>
          {year && (
            <span className="text-[11px] text-gray-600 shrink-0 tabular-nums">{year}</span>
          )}
        </div>
        {locationLabel && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5 leading-snug">{locationLabel}</p>
        )}
      </div>
    </div>
  );
}
