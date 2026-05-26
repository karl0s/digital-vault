import { useState, useEffect } from 'react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';
import { motion } from 'motion/react';

interface ShowCardProps {
  show: Show;
  onClick: () => void;
  focused?: boolean;
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

export function ShowCard({ show, onClick, focused = false, getImageUrl, searchMode }: ShowCardProps) {
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
              <motion.div
                className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent pointer-events-none"
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </>
          ) : (
            <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
              <span className="text-4xl font-bold text-white/20">{artistInitials}</span>
              <motion.div
                className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent pointer-events-none"
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </div>
          )}

          {/* Hover overlay — venue + duration */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none"
            animate={{ opacity: active ? 1 : 0, y: active ? 0 : 5 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="space-y-0.5">
              {searchMode === 'artist' && (
                <p className="text-xs text-gray-200 truncate leading-snug">{show.Artist}</p>
              )}
              {durationMin > 0 && (
                <p className="text-xs text-gray-500">{durationText}</p>
              )}
            </div>
          </motion.div>

          {/* Recording type badge — bottom-right on hover */}
          {show.RecordingType && (
            <motion.div
              className="absolute bottom-2 right-2 z-10 pointer-events-none"
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide ${getRecordingBadgeStyle(show.RecordingType)}`}>
                {show.RecordingType.split(' ')[0].toUpperCase()}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Always-visible metadata below card */}
      <div className="mt-2 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-white truncate leading-snug">{line1}</p>
          {year && (
            <span className="text-[11px] text-gray-600 shrink-0 tabular-nums">{year}</span>
          )}
        </div>
        {line2 && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5 leading-snug">{line2}</p>
        )}
      </div>
    </div>
  );
}
