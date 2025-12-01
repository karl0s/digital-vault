import { useState, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';

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
      className={`group cursor-pointer flex-shrink-0 w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[26rem] transition-all duration-300 ${focused ? 'relative z-20' : 'relative z-0'}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`
        relative overflow-hidden rounded-lg transition-all duration-300
        ${focused ? 'scale-110 ring-4 ring-white shadow-2xl shadow-white/30' : isHovered ? 'scale-105 shadow-2xl shadow-black/50' : 'scale-100'}
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
              {(focused || isHovered) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300" />
              )}
            </>
          ) : (
            // Placeholder with artist initials
            <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
              <div className="text-6xl text-white/40 font-bold">{artistInitials}</div>
              {/* Gradient overlay - only show on hover/focus */}
              {(focused || isHovered) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300" />
              )}
            </div>
          )}
          
          {/* Badges - only show on hover/focus */}
          {(focused || isHovered) && (
            <div className="absolute top-3 right-3 flex gap-2 animate-in fade-in duration-200">
              {show.ShowDate && (
                <div className={`px-2 py-1 rounded text-xs transition-colors ${focused ? 'bg-white text-black' : 'bg-[#E50914]'}`}>
                  {year}
                </div>
              )}
              {show.RecordingType && (
                <div className="bg-black/70 px-2 py-1 rounded text-xs">
                  {show.RecordingType}
                </div>
              )}
              {show.TVStandard && (
                <div className="bg-black/70 px-2 py-1 rounded text-xs">
                  {show.TVStandard}
                </div>
              )}
            </div>
          )}

          {/* Info overlay - hidden by default, visible on hover/focus */}
          {(focused || isHovered) && (
            <div className="absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 animate-in fade-in duration-200"
              style={{
                // GPU acceleration for smooth transitions
                transform: 'translateZ(0)',
              }}
            >
              <div className="space-y-1 text-xs text-gray-300">
                {show.ShowDate && <p>{show.ShowDate}</p>}
                {(show.EventOrFestival || show.VenueName) && (
                  <p className="truncate">
                    {[show.EventOrFestival, show.VenueName].filter(Boolean).join(', ')}
                  </p>
                )}
                {(show.City || show.Country) && (
                  <p className="truncate">
                    {[show.City, show.Country].filter(Boolean).join(', ')}
                  </p>
                )}
                {durationMin > 0 && <p>{durationText}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}