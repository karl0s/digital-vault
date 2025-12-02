import { useState, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';
import { motion, AnimatePresence } from 'motion/react';

interface ShowCardProps {
  show: Show;
  onClick: () => void;
  focused?: boolean;
  getImageUrl?: (checksum: string, index: number) => string | null;
}

export function ShowCard({ show, onClick, focused = false, getImageUrl }: ShowCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [prefetchedImages, setPrefetchedImages] = useState<string[]>([]);
  
  const year = show.ShowDate ? show.ShowDate.split('-')[0] : 'Unknown';
  const durationMin = Math.floor(parseInt(show.DurationSec || '0') / 60);
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Use ChecksumSHA1 for image path, fallback to placeholder
  const imageUrl = show.ChecksumSHA1 
    ? (getImageUrl ? getImageUrl(show.ChecksumSHA1, 1) : `/images/${show.ChecksumSHA1}_01.jpg`)
    : null;
  
  // Build display location
  const location = [show.City, show.Country].filter(Boolean).join(', ') || show.VenueName || 'Unknown';

  // Generate artist initials for placeholder
  const artistInitials = show.Artist
    .split(' ')
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate a consistent color based on artist name
  const getColorFromString = (str: string) => {
    const colors = [
      'bg-red-900',
      'bg-blue-900',
      'bg-green-900',
      'bg-purple-900',
      'bg-pink-900',
      'bg-indigo-900',
      'bg-yellow-900',
      'bg-teal-900',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Prefetch drawer images on hover (all 4 screenshots)
  useEffect(() => {
    if (isHovered && show.ChecksumSHA1 && prefetchedImages.length === 0) {
      const imagesToPrefetch = [1, 2, 3, 4].map(index => 
        getImageUrl 
          ? getImageUrl(show.ChecksumSHA1!, index)
          : `/images/${show.ChecksumSHA1}_0${index}.jpg`
      ).filter(Boolean) as string[];
      
      // Prefetch images in the background
      imagesToPrefetch.forEach(url => {
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
      
      setPrefetchedImages(imagesToPrefetch);
    }
  }, [isHovered, show.ChecksumSHA1, prefetchedImages.length, getImageUrl]);

  return (
    <div
      id={`show-${show.ShowID}`}
      data-show-year={year}
      className={`group cursor-pointer flex-shrink-0 w-full md:w-64 md:sm:w-72 md:md:w-80 md:lg:w-96 md:xl:w-[26rem] transition-all duration-300 ${focused ? 'relative z-20' : 'relative z-0'}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`
        relative overflow-hidden rounded-lg transition-all duration-300
        ${focused ? 'scale-110 ring-4 ring-white shadow-2xl shadow-white/30' : isHovered ? 'md:scale-105 shadow-2xl shadow-black/50' : 'scale-100'}
      `}
        style={{
          // Force GPU acceleration for smooth animations
          transform: 'translateZ(0)',
          willChange: focused || isHovered ? 'transform' : 'auto',
        }}
      >
        <div className="aspect-[4/3] bg-gray-800 relative">
          {imageUrl ? (
            <>
              <LazyImage
                src={imageUrl}
                alt={`${show.Artist} - ${show.VenueName}`}
                className="w-full h-full"
                placeholderColor={getColorFromString(show.Artist)}
              />
              {/* Gradient overlay - only show on hover/focus */}
              <AnimatePresence>
                {(focused || isHovered) && (
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>
            </>
          ) : (
            // Placeholder with artist initials
            <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
              <div className="text-6xl text-white/40 font-bold">{artistInitials}</div>
              {/* Gradient overlay - only show on hover/focus */}
              <AnimatePresence>
                {(focused || isHovered) && (
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* Badges - only show on hover/focus */}
          <AnimatePresence>
            {(focused || isHovered) && (
              <div className="absolute top-3 right-3 flex gap-2">
                {show.ShowDate && (
                  <motion.div 
                    className={`px-2 py-1 rounded text-xs transition-colors ${focused ? 'bg-white text-black' : 'bg-[#E50914]'}`}
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, delay: 0 }}
                  >
                    {year}
                  </motion.div>
                )}
                {show.RecordingType && (
                  <motion.div 
                    className="bg-black/70 px-2 py-1 rounded text-xs"
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                  >
                    {show.RecordingType}
                  </motion.div>
                )}
                {show.TVStandard && (
                  <motion.div 
                    className="bg-black/70 px-2 py-1 rounded text-xs"
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    {show.TVStandard}
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>

          {/* Info overlay - hidden by default, visible on hover/focus */}
          <AnimatePresence>
            {(focused || isHovered) && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  // GPU acceleration for smooth transitions
                  transform: 'translateZ(0)',
                }}
              >
                <div className="space-y-1 text-xs text-gray-300">
                  {show.ShowDate && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.15 }}
                    >
                      {show.ShowDate}
                    </motion.p>
                  )}
                  {(show.EventOrFestival || show.VenueName) && (
                    <motion.p 
                      className="truncate"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.2 }}
                    >
                      {[show.EventOrFestival, show.VenueName].filter(Boolean).join(', ')}
                    </motion.p>
                  )}
                  {(show.City || show.Country) && (
                    <motion.p 
                      className="truncate"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.25 }}
                    >
                      {[show.City, show.Country].filter(Boolean).join(', ')}
                    </motion.p>
                  )}
                  {durationMin > 0 && (
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.3 }}
                    >
                      {durationText}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}