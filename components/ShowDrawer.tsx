import { useEffect, useState } from 'react';
import { X, Clock, HardDrive, Film, Music, Info, ChevronDown } from 'lucide-react';
import { Show } from '../App';
import { LazyImage } from './LazyImage';

interface ShowDrawerProps {
  show: Show;
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
  getImageUrl?: (checksum: string, index: number) => string | null;
}

export function ShowDrawer({ show, onClose, onImageClick, getImageUrl }: ShowDrawerProps) {
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const year = show.ShowDate ? show.ShowDate.split('-')[0] : 'Unknown';
  const durationSec = parseInt(show.DurationSec || '0');
  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.floor((durationSec % 3600) / 60);
  const seconds = durationSec % 60;
  const durationFormatted = durationSec > 0 
    ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`)
    : 'Unknown';
  
  const setlistItems = show.Setlist ? show.Setlist.split(';').map(s => s.trim()).filter(Boolean) : [];
  
  // Parse RepVideoFiles if it's a string
  const videoFiles = typeof show.RepVideoFiles === 'string'
    ? show.RepVideoFiles.split(';').map(f => f.trim()).filter(Boolean)
    : show.RepVideoFiles || [];

  // Get images using ChecksumSHA1 - up to 4 screenshots
  const images = show.ChecksumSHA1 
    ? [1, 2, 3, 4].map(index => 
        getImageUrl 
          ? getImageUrl(show.ChecksumSHA1!, index)
          : `/images/${show.ChecksumSHA1}_0${index}.jpg`
      ).filter(Boolean) as string[]
    : [];

  // Build location string
  const locationParts = [show.City, show.Country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : '';

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

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-50 fade-in"
        onClick={onClose}
      />

      {/* Drawer - slide from right on desktop, slide from bottom on mobile */}
      <div 
        className="fixed top-0 md:top-0 right-0 md:right-0 bottom-0 left-0 md:left-auto w-full md:w-[60vw] h-full md:h-auto bg-[#181818] z-50 overflow-y-auto drawer-slide-in md:drawer-slide-in-right"
      >
        <div className="relative">
          {/* Fixed Close button */}
          <button
            onClick={onClose}
            className="fixed top-4 right-4 z-[60] p-2 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header with hero image */}
          <div className="relative h-48 md:h-80 bg-[#181818]">
            {images.length > 0 ? (
              <>
                <LazyImage
                  src={images[0]}
                  alt={show.Artist}
                  className="w-full h-full object-cover opacity-50"
                  style={{ objectPosition: '0% 25%' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/50 to-transparent backdrop-blur-[3px]" />
              </>
            ) : (
              // Placeholder with artist initials
              <div className={`w-full h-full ${getColorFromString(show.Artist)} flex items-center justify-center`}>
                <div className="text-6xl md:text-9xl text-white/30 font-bold">{artistInitials}</div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/50 to-transparent backdrop-blur-[3px]" />
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
              <h1 className="text-white mb-1 md:mb-2 text-xl md:text-3xl">
                {show.Artist}
              </h1>
              <p className="text-base md:text-xl text-gray-300 mb-2 md:mb-3">
                {show.ShowDate || 'Date Unknown'}
                {show.VenueName && ` · ${show.VenueName}`}
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                {year !== 'Unknown' && <span className="px-3 py-1 bg-white/10 rounded">{year}</span>}
                {show.RecordingType && <span className="px-3 py-1 bg-white/10 rounded">{show.RecordingType}</span>}
                {durationSec > 0 && <span className="px-3 py-1 bg-white/10 rounded">{durationFormatted}</span>}
                {show.Width && show.Height && <span className="px-3 py-1 bg-white/10 rounded">{show.Width}×{show.Height}</span>}
                {show.VideoCodec && <span className="px-3 py-1 bg-white/10 rounded">{show.VideoCodec}</span>}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-8 space-y-4 md:space-y-6">
            {/* Location & Event summary */}
            {(locationStr || show.EventOrFestival) && (
              <div className="space-y-2">
                {locationStr && <p className="text-gray-300 text-sm md:text-base">{locationStr}</p>}
                {show.EventOrFestival && (
                  <p className="text-[#E50914] text-sm">🎪 {show.EventOrFestival}</p>
                )}
              </div>
            )}

            {/* Screenshots - 2x2 grid on mobile, 1x4 on desktop */}
            {images.length > 0 && show.ChecksumSHA1 && (
              <div>
                <h3 className="text-sm text-gray-400 mb-3 md:mb-4 flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  Screenshots
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => onImageClick(url)}
                      className="aspect-video bg-black/30 rounded overflow-hidden hover:ring-2 hover:ring-white/50 transition-all"
                    >
                      <LazyImage
                        src={url}
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Details - 1 column on mobile, 2 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <h3 className="text-sm text-gray-400 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Video
                </h3>
                <div className="space-y-2 text-sm">
                  {show.RecordingType && (
                    <div>
                      <span className="text-gray-400">Type:</span>{' '}
                      <span className="text-white">{show.RecordingType}</span>
                    </div>
                  )}
                  {show.VideoCodec && (
                    <div>
                      <span className="text-gray-400">Codec:</span>{' '}
                      <span className="text-white">{show.VideoCodec}</span>
                    </div>
                  )}
                  {show.Width && show.Height && (
                    <div>
                      <span className="text-gray-400">Resolution:</span>{' '}
                      <span className="text-white">{show.Width}×{show.Height}</span>
                    </div>
                  )}
                  {show.AspectRatio && (
                    <div>
                      <span className="text-gray-400">Aspect:</span>{' '}
                      <span className="text-white">{show.AspectRatio}</span>
                    </div>
                  )}
                  {show.TVStandard && (
                    <div>
                      <span className="text-gray-400">Standard:</span>{' '}
                      <span className="text-white">{show.TVStandard}</span>
                    </div>
                  )}
                  {show.Container && (
                    <div>
                      <span className="text-gray-400">Container:</span>{' '}
                      <span className="text-white">{show.Container}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm text-gray-400">Audio & Storage</h3>
                <div className="space-y-2 text-sm">
                  {show.AudioCodec && (
                    <div>
                      <span className="text-gray-400">Audio:</span>{' '}
                      <span className="text-white">{show.AudioCodec}</span>
                    </div>
                  )}
                  {show.AudioChannels && (
                    <div>
                      <span className="text-gray-400">Channels:</span>{' '}
                      <span className="text-white">{show.AudioChannels}ch</span>
                    </div>
                  )}
                  {show.AudioSampleRate && (
                    <div>
                      <span className="text-gray-400">Sample Rate:</span>{' '}
                      <span className="text-white">{(parseInt(show.AudioSampleRate) / 1000).toFixed(1)}kHz</span>
                    </div>
                  )}
                  {show.TotalSizeHuman && (
                    <div>
                      <span className="text-gray-400">Size:</span>{' '}
                      <span className="text-white">{show.TotalSizeHuman}</span>
                    </div>
                  )}
                  {show.FileCount && (
                    <div>
                      <span className="text-gray-400">Files:</span>{' '}
                      <span className="text-white">{show.FileCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Setlist and Notes/Source - Side by side */}
            <div className="grid grid-cols-2 gap-6">
              {/* Setlist */}
              {setlistItems.length > 0 && (
                <div>
                  <h3 className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Setlist
                  </h3>
                  <div className="space-y-2">
                    {setlistItems.map((song, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <span className="text-gray-500 min-w-[2rem]">{idx + 1}.</span>
                        <span className="text-white">{song}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes and Source/Files column */}
              <div className="space-y-4">
                {/* Notes - Accordion (collapsed by default) */}
                {show.Notes && (
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                      className="w-full flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 transition-colors text-left"
                    >
                      <h3 className="text-sm text-gray-400">Notes</h3>
                      <ChevronDown 
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                          isNotesExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isNotesExpanded && (
                      <div className="bg-black/30 p-4 max-h-96 overflow-y-auto">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {show.Notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Source / Lineage - Accordion (collapsed by default) */}
                {(show.Lineage || show.FolderPath || videoFiles.length > 0 || show.MasterDriveName) && (
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setIsSourceExpanded(!isSourceExpanded)}
                      className="w-full flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 transition-colors text-left"
                    >
                      <h3 className="text-sm text-gray-400">Source & Files</h3>
                      <ChevronDown 
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                          isSourceExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isSourceExpanded && (
                      <div className="bg-black/30 p-4 space-y-3 text-sm">
                        {show.MasterDriveName && (
                          <div>
                            <span className="text-gray-400 block mb-1">Drive:</span>
                            <span className="text-white text-xs">{show.MasterDriveName}</span>
                          </div>
                        )}
                        {show.FolderPath && (
                          <div>
                            <span className="text-gray-400 block mb-1">Path:</span>
                            <span className="text-white font-mono text-xs break-all">{show.FolderPath}</span>
                          </div>
                        )}
                        {show.Lineage && (
                          <div>
                            <span className="text-gray-400 block mb-1">Lineage:</span>
                            <span className="text-white text-xs">{show.Lineage}</span>
                          </div>
                        )}
                        {videoFiles.length > 0 && (
                          <div>
                            <span className="text-gray-400 block mb-2">Video Files ({videoFiles.length}):</span>
                            <div className="space-y-1 pl-4 max-h-40 overflow-y-auto">
                              {videoFiles.map((file, idx) => (
                                <div key={idx} className="text-gray-300 font-mono text-xs">
                                  {file}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>
      </div>
    </>
  );
}