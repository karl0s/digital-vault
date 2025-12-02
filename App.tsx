import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ArtistRow } from './components/ArtistRow';
import { ShowDrawer } from './components/ShowDrawer';
import { ImageLightbox } from './components/ImageLightbox';

export interface Show {
  ShowID: string;
  MasterDriveName: string;
  Artist: string;
  ShowDate: string;
  EventOrFestival?: string;
  VenueName: string;
  City: string;
  Country: string;
  RecordingType?: string;
  Generation?: string;
  Setlist: string;
  Lineage: string;
  SourceEquipment?: string;
  FolderName?: string;
  FolderPath: string;
  RepVideoCount: number | string;
  RepVideoFiles: string | string[];
  VideoCodec: string;
  Width: string;
  Height: string;
  DurationSec: string;
  Container: string;
  AspectRatio?: string;
  TVStandard?: string;
  AudioCodec?: string;
  AudioChannels?: string;
  AudioSampleRate?: string;
  FileCount: string;
  TotalSizeBytes?: string;
  TotalSizeHuman: string;
  ChecksumSHA1?: string;
  DuplicateOf?: string;
  Notes: string;
  ImageCount?: number;
  ImageURLs?: string[];
  LastScannedAt?: string;
  ExtractionWarnings?: string;
}

interface ShowsData {
  generated_at: string;
  items: Show[];
}

export default function App() {
  const [shows, setShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string>('');
  const [focusedIndex, setFocusedIndex] = useState<{ artistIndex: number; showIndex: number } | null>(null);
  const [currentArtistIndex, setCurrentArtistIndex] = useState<number>(0);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [imageMapping, setImageMapping] = useState<Record<string, string>>({});
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    // Load test images mapping (optional, for demo purposes)
    fetch(`${base}test-images.json`)
      .then(res => res.json())
      .then((data: Record<string, string>) => {
        setImageMapping(data);
      })
      .catch(() => {
        console.log('No test images found, using local paths');
      });

    const loadShows = async () => {
      const url = `${base}shows.json`;

      try {
        console.log('Loading shows from:', url);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }

        const data = await response.json();

        // Support both formats: plain array OR { items: [...] }
        let items: Show[];

        if (Array.isArray(data)) {
          items = data as Show[];
        } else if (data && Array.isArray((data as any).items)) {
          items = (data as any).items as Show[];
        } else {
          throw new Error('Unexpected shows.json structure');
        }

        console.log(`✅ Successfully loaded ${items.length} shows from ${url}`);
        setShows(items);
      } catch (err) {
        console.error('⚠️ Failed to load shows.json, using sample data fallback.', err);
        setShows(SAMPLE_SHOWS);
      }
    };

    loadShows();
  }, []);


  // Helper function to get image URL (supports external URLs for testing)
  const getImageUrl = (checksum: string, index: number): string | null => {
    const key = `${checksum}_0${index}`;
    const base = import.meta.env.BASE_URL;

    // Check if we have a test image URL
    if (imageMapping[key]) {
      return imageMapping[key];
    }
    // Fallback to local path under correct base
    return `${base}images/${checksum}_0${index}.jpg`;
  };


  // Filter shows based on search query
  const filteredShows = shows.filter(show => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Check for field-specific filters (e.g., "artist:pearl jam", "type:soundboard", "song:alive")
    const fieldMatch = query.match(/^(\w+):(.+)$/);
    
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      const searchValue = value.toLowerCase().trim();
      
      switch (field) {
        case 'artist':
          return show.Artist.toLowerCase().includes(searchValue);
        case 'type':
          return show.RecordingType?.toLowerCase().includes(searchValue) || false;
        case 'country':
          return show.Country.toLowerCase().includes(searchValue);
        case 'city':
          return show.City.toLowerCase().includes(searchValue);
        case 'venue':
          return show.VenueName.toLowerCase().includes(searchValue);
        case 'event':
          return show.EventOrFestival?.toLowerCase().includes(searchValue) || false;
        case 'song':
          return show.Setlist.toLowerCase().includes(searchValue);
        case 'year':
          return show.ShowDate.includes(searchValue);
        case 'drive':
          return show.MasterDriveName.toLowerCase().includes(searchValue);
        case 'codec':
          return show.VideoCodec.toLowerCase().includes(searchValue);
        default:
          // Unknown field, fall back to general search
          return (
            show.Artist.toLowerCase().includes(query) ||
            show.VenueName.toLowerCase().includes(query) ||
            show.City.toLowerCase().includes(query) ||
            show.Country.toLowerCase().includes(query) ||
            show.ShowDate.includes(query) ||
            (show.EventOrFestival && show.EventOrFestival.toLowerCase().includes(query)) ||
            (show.RecordingType && show.RecordingType.toLowerCase().includes(query)) ||
            show.Setlist.toLowerCase().includes(query) ||
            show.Notes.toLowerCase().includes(query)
          );
      }
    }
    
    // General search (no field prefix)
    return (
      show.Artist.toLowerCase().includes(query) ||
      show.VenueName.toLowerCase().includes(query) ||
      show.City.toLowerCase().includes(query) ||
      show.Country.toLowerCase().includes(query) ||
      show.ShowDate.includes(query) ||
      (show.EventOrFestival && show.EventOrFestival.toLowerCase().includes(query)) ||
      (show.RecordingType && show.RecordingType.toLowerCase().includes(query)) ||
      show.Setlist.toLowerCase().includes(query) ||
      show.Notes.toLowerCase().includes(query)
    );
  });

  // Group shows by artist
  const groupedShows = filteredShows.reduce((acc, show) => {
    const artist = show.Artist;
    if (!acc[artist]) {
      acc[artist] = [];
    }
    acc[artist].push(show);
    return acc;
  }, {} as Record<string, Show[]>);

  // Sort artists alphabetically
  const sortedArtists = Object.keys(groupedShows).sort();

  // Scroll detection to update current artist based on viewport center
  useEffect(() => {
    let rafId: number;
    
    const handleScroll = () => {
      // Cancel any pending animation frame
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Use requestAnimationFrame for instant, smooth updates
      rafId = requestAnimationFrame(() => {
        if (!mainRef.current || sortedArtists.length === 0) return;

        const viewportHeight = window.innerHeight;
        const viewportCenter = viewportHeight / 2;
        const scrollY = window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;

        // Find the closest artist based on viewport center
        let closestArtistIndex = 0;
        let minDistance = Infinity;

        sortedArtists.forEach((artist, index) => {
          const element = document.getElementById(`artist-${artist.replace(/\s+/g, '-')}`);
          if (element) {
            const rect = element.getBoundingClientRect();
            const elementCenter = rect.top + rect.height / 2;
            const distance = Math.abs(elementCenter - viewportCenter);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestArtistIndex = index;
            }
          }
        });

        // Special case: at the very top - only force first artist if we're REALLY at the top
        if (scrollY < 50 && closestArtistIndex !== 0) {
          closestArtistIndex = 0;
        }

        // Special case: at the very bottom - force last artist
        if (scrollY + viewportHeight >= documentHeight - 100 && closestArtistIndex !== sortedArtists.length - 1) {
          closestArtistIndex = sortedArtists.length - 1;
        }

        // Only update if no keyboard focus is active
        if (focusedIndex === null) {
          setCurrentArtistIndex(closestArtistIndex);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [sortedArtists, focusedIndex]);

  // Update current artist when focused index changes (keyboard navigation)
  useEffect(() => {
    if (focusedIndex !== null) {
      setCurrentArtistIndex(focusedIndex.artistIndex);
    }
  }, [focusedIndex]);

  // Detect manual scroll (mouse wheel) to exit keyboard mode
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = () => {
      // User is manually scrolling with mouse/wheel - exit keyboard mode
      if (isKeyboardMode && focusedIndex !== null) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setFocusedIndex(null);
          setIsKeyboardMode(false);
        }, 100);
      }
    };

    const handleTouchStart = () => {
      // User is manually scrolling with touch - exit keyboard mode
      if (isKeyboardMode && focusedIndex !== null) {
        setFocusedIndex(null);
        setIsKeyboardMode(false);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      clearTimeout(scrollTimeout);
    };
  }, [isKeyboardMode, focusedIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in search or drawer is open
      if (selectedShow || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      // Initialize focus if not set
      if (focusedIndex === null && sortedArtists.length > 0) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
          e.preventDefault();
          setFocusedIndex({ artistIndex: 0, showIndex: 0 });
          setCurrentArtistIndex(0);
          setIsKeyboardMode(true);
          return;
        }
      }

      if (focusedIndex === null) return;

      const { artistIndex, showIndex } = focusedIndex;
      const currentArtist = sortedArtists[artistIndex];
      const currentArtistShows = groupedShows[currentArtist];

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          // Move right within current row - allow navigation through ALL shows
          if (showIndex < currentArtistShows.length - 1) {
            setFocusedIndex({ artistIndex, showIndex: showIndex + 1 });
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // Move left within current row
          if (showIndex > 0) {
            setFocusedIndex({ artistIndex, showIndex: showIndex - 1 });
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          // Move to next artist row
          if (artistIndex < sortedArtists.length - 1) {
            const nextArtist = sortedArtists[artistIndex + 1];
            const nextArtistShows = groupedShows[nextArtist];
            // Keep same horizontal position or go to last if out of bounds
            const newShowIndex = Math.min(showIndex, nextArtistShows.length - 1);
            const newArtistIndex = artistIndex + 1;
            setFocusedIndex({ artistIndex: newArtistIndex, showIndex: newShowIndex });
            setCurrentArtistIndex(newArtistIndex);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          // Move to previous artist row
          if (artistIndex > 0) {
            const prevArtist = sortedArtists[artistIndex - 1];
            const prevArtistShows = groupedShows[prevArtist];
            // Keep same horizontal position or go to last if out of bounds
            const newShowIndex = Math.min(showIndex, prevArtistShows.length - 1);
            const newArtistIndex = artistIndex - 1;
            setFocusedIndex({ artistIndex: newArtistIndex, showIndex: newShowIndex });
            setCurrentArtistIndex(newArtistIndex);
          }
          break;

        case 'Enter':
          e.preventDefault();
          // Open selected show
          const focusedShow = currentArtistShows[showIndex];
          if (focusedShow) {
            handleShowClick(focusedShow);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, sortedArtists, groupedShows, selectedShow]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex) {
      const { artistIndex, showIndex } = focusedIndex;
      const artist = sortedArtists[artistIndex];
      const show = groupedShows[artist]?.[showIndex];
      if (show) {
        const element = document.getElementById(`show-${show.ShowID}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [focusedIndex, sortedArtists, groupedShows]);

  const handleShowClick = (show: Show) => {
    setSelectedShow(show);
  };

  const handleCloseDrawer = () => {
    setSelectedShow(null);
  };

  const handleImageClick = (imageUrl: string) => {
    setLightboxImage(imageUrl);
  };

  const handleCloseLightbox = () => {
    setLightboxImage(null);
  };

  const handleArtistJump = (artist: string) => {
    // Clear keyboard focus when jumping to an artist
    setFocusedIndex(null);
    setIsKeyboardMode(false);
    
    const element = document.getElementById(`artist-${artist.replace(/\s+/g, '-')}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const getFocusedShowId = () => {
    if (!focusedIndex) return null;
    const { artistIndex, showIndex } = focusedIndex;
    const artist = sortedArtists[artistIndex];
    return groupedShows[artist]?.[showIndex]?.ShowID || null;
  };

  const currentArtist = sortedArtists[currentArtistIndex] || 'Browse Shows';

  // Calculate the active letter based on current artist
  const currentLetter = currentArtist ? currentArtist[0].toUpperCase() : '';

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <TopNav 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery}
        artists={sortedArtists}
        onArtistJump={handleArtistJump}
      />
      
      <div className="flex">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar 
            artists={sortedArtists}
            activeLetter={currentLetter}
            onLetterClick={(letter) => {
              // Clear keyboard focus when sidebar is clicked
              setFocusedIndex(null);
              setIsKeyboardMode(false);
              
              const element = document.getElementById(`artist-${letter}`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onArtistClick={handleArtistJump}
          />
        </div>
        
        <main ref={mainRef} className="flex-1 ml-0 md:ml-16 pt-20 md:pt-24 px-4 md:px-8 pb-8 overflow-x-hidden">
          {searchQuery && (
            <div className="mb-6 flex items-center gap-4">
              <p className="text-gray-400 text-sm md:text-base">
                Search results for <span className="text-white">"{searchQuery}"</span>
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {sortedArtists.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              No shows found
            </div>
          ) : (
            <div className="space-y-0">
              {sortedArtists.map((artist, index) => {
                // Calculate opacity based on distance from center
                const distanceFromCenter = Math.abs(index - currentArtistIndex);
                let opacity = 1;
                
                if (distanceFromCenter === 0) {
                  opacity = 1; // Center - fully visible
                } else if (distanceFromCenter === 1) {
                  opacity = 0.4; // Adjacent - faded
                } else {
                  opacity = 0.15; // Further away - very faded
                }

                return (
                  <ArtistRow
                    key={artist}
                    artist={artist}
                    shows={groupedShows[artist]}
                    onShowClick={handleShowClick}
                    focusedShowId={getFocusedShowId()}
                    opacity={opacity}
                    isCenter={index === currentArtistIndex}
                    getImageUrl={getImageUrl}
                    allArtists={sortedArtists}
                    onArtistJump={handleArtistJump}
                    currentArtist={currentArtist}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {selectedShow && (
        <ShowDrawer
          show={selectedShow}
          onClose={handleCloseDrawer}
          onImageClick={handleImageClick}
          getImageUrl={getImageUrl}
        />
      )}

      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={handleCloseLightbox}
        />
      )}
    </div>
  );
}

// Sample data for demo
const SAMPLE_SHOWS: Show[] = [
  {
    ShowID: "001",
    MasterDriveName: "Archive001",
    Artist: "Arcade Fire",
    ShowDate: "2024-06-15",
    EventOrFestival: "Glastonbury Festival",
    VenueName: "Pyramid Stage",
    City: "Pilton",
    Country: "United Kingdom",
    RecordingType: "Soundboard",
    Setlist: "Wake Up / Rebellion (Lies) / Ready to Start / The Suburbs",
    Lineage: "Soundboard > WAV > FLAC",
    FolderPath: "/archive/arcadefire/2024-06-15",
    RepVideoCount: 4,
    RepVideoFiles: "song1.mp4, song2.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5400",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "12.5 GB",
    Notes: "Excellent soundboard recording from headline set",
    ImageURLs: ["https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800"]
  },
  {
    ShowID: "002",
    MasterDriveName: "Archive002",
    Artist: "Arcade Fire",
    ShowDate: "2023-11-20",
    VenueName: "Madison Square Garden",
    City: "New York",
    Country: "USA",
    RecordingType: "Audience",
    Setlist: "Everything Now / Reflektor / No Cars Go",
    Lineage: "Audience recording",
    FolderPath: "/archive/arcadefire/2023-11-20",
    RepVideoCount: 3,
    RepVideoFiles: "track1.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4200",
    Container: "MP4",
    FileCount: "3",
    TotalSizeHuman: "9.2 GB",
    Notes: "Great audience recording from MSG show",
    ImageURLs: ["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"]
  },
  {
    ShowID: "003",
    MasterDriveName: "Archive003",
    Artist: "Beck",
    ShowDate: "2024-07-22",
    VenueName: "Red Rocks Amphitheatre",
    City: "Morrison",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Loser / Where It's At / E-Pro / Gamma Ray",
    Lineage: "Soundboard > Digital",
    FolderPath: "/archive/beck/2024-07-22",
    RepVideoCount: 4,
    RepVideoFiles: "set1.mp4, set2.mp4",
    VideoCodec: "H.265",
    Width: "1920",
    Height: "1080",
    DurationSec: "6300",
    Container: "MKV",
    FileCount: "4",
    TotalSizeHuman: "15.8 GB",
    Notes: "Stunning Red Rocks performance",
    ImageURLs: ["https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800"]
  },
  {
    ShowID: "004",
    MasterDriveName: "Archive004",
    Artist: "Blur",
    ShowDate: "2024-05-10",
    EventOrFestival: "Coachella",
    VenueName: "Main Stage",
    City: "Indio",
    Country: "USA",
    RecordingType: "Webcast",
    Setlist: "Song 2 / Girls & Boys / Parklife / Tender",
    Lineage: "HD Webcast capture",
    FolderPath: "/archive/blur/2024-05-10",
    RepVideoCount: 4,
    RepVideoFiles: "full_set.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5100",
    Container: "MP4",
    FileCount: "1",
    TotalSizeHuman: "11.2 GB",
    Notes: "Complete Coachella webcast in HD",
    ImageURLs: ["https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800"]
  },
  {
    ShowID: "005",
    MasterDriveName: "Archive005",
    Artist: "Coldplay",
    ShowDate: "2024-08-30",
    VenueName: "Wembley Stadium",
    City: "London",
    Country: "United Kingdom",
    RecordingType: "Soundboard",
    Setlist: "Yellow / The Scientist / Fix You / Viva La Vida / Sky Full of Stars",
    Lineage: "Soundboard matrix",
    FolderPath: "/archive/coldplay/2024-08-30",
    RepVideoCount: 5,
    RepVideoFiles: "show.mp4",
    VideoCodec: "H.264",
    Width: "3840",
    Height: "2160",
    DurationSec: "7200",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "28.5 GB",
    Notes: "4K recording of Wembley show",
    ImageURLs: ["https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800"]
  },
  {
    ShowID: "006",
    MasterDriveName: "Archive006",
    Artist: "Daft Punk",
    ShowDate: "2007-08-03",
    EventOrFestival: "Lollapalooza",
    VenueName: "Grant Park",
    City: "Chicago",
    Country: "USA",
    RecordingType: "Audience",
    Setlist: "Robot Rock / Around the World / Harder Better Faster Stronger / One More Time",
    Lineage: "Audience HD capture",
    FolderPath: "/archive/daftpunk/2007-08-03",
    RepVideoCount: 4,
    RepVideoFiles: "legendary_set.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5800",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "13.1 GB",
    Notes: "Legendary pyramid show at Lollapalooza",
    ImageURLs: ["https://images.unsplash.com/photo-1571266028243-d220c02dfea2?w=800"]
  },
  {
    ShowID: "007",
    MasterDriveName: "Archive007",
    Artist: "Elton John",
    ShowDate: "2024-03-18",
    VenueName: "Dodger Stadium",
    City: "Los Angeles",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Tiny Dancer / Rocket Man / Your Song / I'm Still Standing",
    Lineage: "Soundboard digital",
    FolderPath: "/archive/eltonjohn/2024-03-18",
    RepVideoCount: 4,
    RepVideoFiles: "full_show.mp4",
    VideoCodec: "H.265",
    Width: "1920",
    Height: "1080",
    DurationSec: "8100",
    Container: "MKV",
    FileCount: "4",
    TotalSizeHuman: "18.9 GB",
    Notes: "Farewell Yellow Brick Road final show",
    ImageURLs: ["https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800"]
  },
  {
    ShowID: "008",
    MasterDriveName: "Archive008",
    Artist: "Foo Fighters",
    ShowDate: "2024-09-14",
    VenueName: "The Forum",
    City: "Los Angeles",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Everlong / The Pretender / My Hero / Best of You / Times Like These",
    Lineage: "Soundboard recording",
    FolderPath: "/archive/foofighters/2024-09-14",
    RepVideoCount: 5,
    RepVideoFiles: "concert.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6900",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "16.2 GB",
    Notes: "Epic 2+ hour show at The Forum",
    ImageURLs: ["https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800"]
  },
  {
    ShowID: "009",
    MasterDriveName: "Archive009",
    Artist: "Gorillaz",
    ShowDate: "2024-06-28",
    EventOrFestival: "Primavera Sound",
    VenueName: "Parc del Fòrum",
    City: "Barcelona",
    Country: "Spain",
    RecordingType: "Webcast",
    Setlist: "Feel Good Inc / DARE / Clint Eastwood / On Melancholy Hill",
    Lineage: "Festival webcast",
    FolderPath: "/archive/gorillaz/2024-06-28",
    RepVideoCount: 4,
    RepVideoFiles: "primavera.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4800",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "10.5 GB",
    Notes: "Primavera Sound headline set",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  },
  {
    ShowID: "010",
    MasterDriveName: "Archive010",
    Artist: "Harry Styles",
    ShowDate: "2024-07-04",
    VenueName: "Slane Castle",
    City: "Slane",
    Country: "Ireland",
    RecordingType: "Soundboard",
    Setlist: "As It Was / Watermelon Sugar / Sign of the Times / Golden",
    Lineage: "Soundboard matrix",
    FolderPath: "/archive/harrystyles/2024-07-04",
    RepVideoCount: 4,
    RepVideoFiles: "slane.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5400",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "12.8 GB",
    Notes: "Historic Slane Castle performance",
    ImageURLs: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"]
  },
  {
    ShowID: "011",
    MasterDriveName: "Archive011",
    Artist: "Interpol",
    ShowDate: "2024-10-12",
    VenueName: "Brixton Academy",
    City: "London",
    Country: "United Kingdom",
    RecordingType: "Audience",
    Setlist: "Evil / Obstacle 1 / Slow Hands / C'mere",
    Lineage: "Audience recording",
    FolderPath: "/archive/interpol/2024-10-12",
    RepVideoCount: 4,
    RepVideoFiles: "brixton.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4500",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "9.8 GB",
    Notes: "Intense Brixton show",
    ImageURLs: ["https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800"]
  },
  {
    ShowID: "012",
    MasterDriveName: "Archive012",
    Artist: "Justice",
    ShowDate: "2024-04-25",
    EventOrFestival: "Coachella",
    VenueName: "Sahara Tent",
    City: "Indio",
    Country: "USA",
    RecordingType: "Webcast",
    Setlist: "Genesis / D.A.N.C.E. / We Are Your Friends / Civilization",
    Lineage: "HD webcast",
    FolderPath: "/archive/justice/2024-04-25",
    RepVideoCount: 4,
    RepVideoFiles: "coachella_set.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "3900",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "8.7 GB",
    Notes: "Electric Coachella performance",
    ImageURLs: ["https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800"]
  },
  {
    ShowID: "013",
    MasterDriveName: "Archive013",
    Artist: "Kendrick Lamar",
    ShowDate: "2024-08-11",
    VenueName: "Hollywood Bowl",
    City: "Los Angeles",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "HUMBLE. / DNA. / Alright / King Kunta / Swimming Pools",
    Lineage: "Soundboard digital",
    FolderPath: "/archive/kendricklamar/2024-08-11",
    RepVideoCount: 5,
    RepVideoFiles: "hollywood_bowl.mp4",
    VideoCodec: "H.265",
    Width: "3840",
    Height: "2160",
    DurationSec: "5700",
    Container: "MKV",
    FileCount: "5",
    TotalSizeHuman: "22.4 GB",
    Notes: "4K recording of Hollywood Bowl",
    ImageURLs: ["https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800"]
  },
  {
    ShowID: "014",
    MasterDriveName: "Archive014",
    Artist: "LCD Soundsystem",
    ShowDate: "2024-05-31",
    VenueName: "Brooklyn Steel",
    City: "New York",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Dance Yrself Clean / Daft Punk Is Playing at My House / All My Friends / Someone Great",
    Lineage: "Soundboard",
    FolderPath: "/archive/lcdsoundsystem/2024-05-31",
    RepVideoCount: 4,
    RepVideoFiles: "brooklyn.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6600",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "14.9 GB",
    Notes: "Marathon Brooklyn Steel show",
    ImageURLs: ["https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"]
  },
  {
    ShowID: "015",
    MasterDriveName: "Archive015",
    Artist: "Massive Attack",
    ShowDate: "2024-09-22",
    VenueName: "Royal Albert Hall",
    City: "London",
    Country: "United Kingdom",
    RecordingType: "Soundboard",
    Setlist: "Angel / Teardrop / Unfinished Sympathy / Safe From Harm",
    Lineage: "Soundboard recording",
    FolderPath: "/archive/massiveattack/2024-09-22",
    RepVideoCount: 4,
    RepVideoFiles: "royal_albert.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5200",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "11.7 GB",
    Notes: "Atmospheric Royal Albert Hall performance",
    ImageURLs: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"]
  },
  {
    ShowID: "016",
    MasterDriveName: "Archive016",
    Artist: "Nine Inch Nails",
    ShowDate: "2024-11-03",
    VenueName: "Red Rocks Amphitheatre",
    City: "Morrison",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Closer / Head Like a Hole / Hurt / The Hand That Feeds",
    Lineage: "Soundboard digital",
    FolderPath: "/archive/nineinchnails/2024-11-03",
    RepVideoCount: 4,
    RepVideoFiles: "red_rocks.mp4",
    VideoCodec: "H.265",
    Width: "1920",
    Height: "1080",
    DurationSec: "6000",
    Container: "MKV",
    FileCount: "4",
    TotalSizeHuman: "16.8 GB",
    Notes: "Intense Red Rocks show",
    ImageURLs: ["https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800"]
  },
  {
    ShowID: "017",
    MasterDriveName: "Archive017",
    Artist: "Oasis",
    ShowDate: "2024-07-14",
    VenueName: "Knebworth",
    City: "Stevenage",
    Country: "United Kingdom",
    RecordingType: "Soundboard",
    Setlist: "Rock 'n' Roll Star / Live Forever / Wonderwall / Don't Look Back in Anger / Champagne Supernova",
    Lineage: "Soundboard",
    FolderPath: "/archive/oasis/2024-07-14",
    RepVideoCount: 5,
    RepVideoFiles: "knebworth.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "7500",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "17.3 GB",
    Notes: "Legendary Knebworth reunion",
    ImageURLs: ["https://images.unsplash.com/photo-1501612780327-45045538702b?w=800"]
  },
  {
    ShowID: "018",
    MasterDriveName: "Archive018",
    Artist: "Pearl Jam",
    ShowDate: "2024-09-05",
    VenueName: "Fenway Park",
    City: "Boston",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Alive / Even Flow / Jeremy / Black / Yellow Ledbetter",
    Lineage: "Soundboard",
    FolderPath: "/archive/pearljam/2024-09-05",
    RepVideoCount: 5,
    RepVideoFiles: "fenway.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "8400",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "19.2 GB",
    Notes: "Epic Fenway Park show",
    ImageURLs: ["https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800"]
  },
  {
    ShowID: "019",
    MasterDriveName: "Archive019",
    Artist: "Queens of the Stone Age",
    ShowDate: "2024-06-07",
    EventOrFestival: "Rock am Ring",
    VenueName: "Main Stage",
    City: "Nürburg",
    Country: "Germany",
    RecordingType: "Webcast",
    Setlist: "No One Knows / Go With the Flow / Little Sister / Make It wit Chu",
    Lineage: "Festival webcast",
    FolderPath: "/archive/qotsa/2024-06-07",
    RepVideoCount: 4,
    RepVideoFiles: "rock_am_ring.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4700",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "10.3 GB",
    Notes: "Rock am Ring headline set",
    ImageURLs: ["https://images.unsplash.com/photo-1486653437422-c45fd422e96e?w=800"]
  },
  {
    ShowID: "020",
    MasterDriveName: "Archive020",
    Artist: "Radiohead",
    ShowDate: "2024-08-18",
    VenueName: "Glastonbury Festival",
    City: "Pilton",
    Country: "United Kingdom",
    RecordingType: "Webcast",
    Setlist: "Everything In Its Right Place / Paranoid Android / Karma Police / Fake Plastic Trees / Creep",
    Lineage: "BBC webcast",
    FolderPath: "/archive/radiohead/2024-08-18",
    RepVideoCount: 5,
    RepVideoFiles: "glastonbury.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "7200",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "16.5 GB",
    Notes: "Historic Glastonbury headline set",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  },
  {
    ShowID: "021",
    MasterDriveName: "Archive021",
    Artist: "The Strokes",
    ShowDate: "2024-10-28",
    VenueName: "Madison Square Garden",
    City: "New York",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Reptilia / Last Nite / Someday / Hard to Explain / Take It or Leave It",
    Lineage: "Soundboard",
    FolderPath: "/archive/thestrokes/2024-10-28",
    RepVideoCount: 5,
    RepVideoFiles: "msg.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5100",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "11.4 GB",
    Notes: "The Strokes return to MSG",
    ImageURLs: ["https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800"]
  },
  {
    ShowID: "022",
    MasterDriveName: "Archive022",
    Artist: "U2",
    ShowDate: "2024-12-01",
    VenueName: "Sphere",
    City: "Las Vegas",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "With or Without You / One / Beautiful Day / Where the Streets Have No Name / Sunday Bloody Sunday",
    Lineage: "Soundboard 4K",
    FolderPath: "/archive/u2/2024-12-01",
    RepVideoCount: 5,
    RepVideoFiles: "sphere.mp4",
    VideoCodec: "H.265",
    Width: "3840",
    Height: "2160",
    DurationSec: "6300",
    Container: "MKV",
    FileCount: "5",
    TotalSizeHuman: "31.2 GB",
    Notes: "Groundbreaking Sphere residency show in 4K",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  },
  {
    ShowID: "023",
    MasterDriveName: "Archive023",
    Artist: "Vampire Weekend",
    ShowDate: "2024-09-19",
    VenueName: "Central Park",
    City: "New York",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "A-Punk / Oxford Comma / Cousins / Harmony Hall / This Life",
    Lineage: "Soundboard",
    FolderPath: "/archive/vampireweekend/2024-09-19",
    RepVideoCount: 5,
    RepVideoFiles: "central_park.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4800",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "10.9 GB",
    Notes: "Beautiful Central Park show",
    ImageURLs: ["https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800"]
  },
  {
    ShowID: "024",
    MasterDriveName: "Archive024",
    Artist: "The White Stripes",
    ShowDate: "2024-06-19",
    VenueName: "Bonnaroo",
    City: "Manchester",
    Country: "USA",
    RecordingType: "Webcast",
    Setlist: "Seven Nation Army / Icky Thump / Fell in Love with a Girl / Blue Orchid",
    Lineage: "Festival webcast",
    FolderPath: "/archive/thewhitestripes/2024-06-19",
    RepVideoCount: 4,
    RepVideoFiles: "bonnaroo.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4200",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "9.1 GB",
    Notes: "Bonnaroo headline performance",
    ImageURLs: ["https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800"]
  },
  {
    ShowID: "025",
    MasterDriveName: "Archive025",
    Artist: "Yeah Yeah Yeahs",
    ShowDate: "2024-11-15",
    VenueName: "Terminal 5",
    City: "New York",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Maps / Heads Will Roll / Zero / Y Control / Date with the Night",
    Lineage: "Soundboard",
    FolderPath: "/archive/yeahyeahyeahs/2024-11-15",
    RepVideoCount: 5,
    RepVideoFiles: "terminal5.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4500",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "10.2 GB",
    Notes: "Intimate Terminal 5 show",
    ImageURLs: ["https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800"]
  },
  {
    ShowID: "026",
    MasterDriveName: "Archive026",
    Artist: "ZZ Top",
    ShowDate: "2024-07-31",
    VenueName: "Gruene Hall",
    City: "New Braunfels",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "La Grange / Tush / Sharp Dressed Man / Legs / Gimme All Your Lovin'",
    Lineage: "Soundboard",
    FolderPath: "/archive/zztop/2024-07-31",
    RepVideoCount: 5,
    RepVideoFiles: "texas.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5400",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "12.3 GB",
    Notes: "Texas blues legends at historic venue",
    ImageURLs: ["https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800"]
  },
  // Add more shows to Arcade Fire for testing horizontal scroll
  {
    ShowID: "027",
    MasterDriveName: "Archive027",
    Artist: "Arcade Fire",
    ShowDate: "2022-08-15",
    VenueName: "Coachella Valley",
    City: "Indio",
    Country: "USA",
    RecordingType: "Webcast",
    Setlist: "Neighborhood #1 (Tunnels) / No Cars Go / Haiti / Neighborhood #3 (Power Out)",
    Lineage: "HD Webcast",
    FolderPath: "/archive/arcadefire/2022-08-15",
    RepVideoCount: 4,
    RepVideoFiles: "coachella.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4800",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "11.8 GB",
    Notes: "Incredible Coachella performance",
    ImageURLs: ["https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800"]
  },
  {
    ShowID: "028",
    MasterDriveName: "Archive028",
    Artist: "Arcade Fire",
    ShowDate: "2021-10-05",
    VenueName: "Red Rocks Amphitheatre",
    City: "Morrison",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "We Exist / Sprawl II (Mountains Beyond Mountains) / Afterlife / Reflektor",
    Lineage: "Soundboard Digital",
    FolderPath: "/archive/arcadefire/2021-10-05",
    RepVideoCount: 4,
    RepVideoFiles: "redrocks.mp4",
    VideoCodec: "H.265",
    Width: "1920",
    Height: "1080",
    DurationSec: "5200",
    Container: "MKV",
    FileCount: "4",
    TotalSizeHuman: "14.2 GB",
    Notes: "Amazing Red Rocks show",
    ImageURLs: ["https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800"]
  },
  {
    ShowID: "029",
    MasterDriveName: "Archive029",
    Artist: "Arcade Fire",
    ShowDate: "2020-07-22",
    VenueName: "Austin City Limits",
    City: "Austin",
    Country: "USA",
    RecordingType: "Audience",
    Setlist: "Keep the Car Running / Rococo / The Lightning I, II",
    Lineage: "Audience HD",
    FolderPath: "/archive/arcadefire/2020-07-22",
    RepVideoCount: 3,
    RepVideoFiles: "acl.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "3900",
    Container: "MP4",
    FileCount: "3",
    TotalSizeHuman: "8.9 GB",
    Notes: "Great ACL taping",
    ImageURLs: ["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"]
  },
  {
    ShowID: "030",
    MasterDriveName: "Archive030",
    Artist: "Arcade Fire",
    ShowDate: "2019-09-30",
    VenueName: "Hollywood Bowl",
    City: "Los Angeles",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Month of May / City With No Children / Crown of Love / Neighborhood #2 (Laïka)",
    Lineage: "Soundboard Matrix",
    FolderPath: "/archive/arcadefire/2019-09-30",
    RepVideoCount: 4,
    RepVideoFiles: "bowl.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4600",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "10.5 GB",
    Notes: "Stellar Hollywood Bowl performance",
    ImageURLs: ["https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800"]
  },
  {
    ShowID: "031",
    MasterDriveName: "Archive031",
    Artist: "Arcade Fire",
    ShowDate: "2018-12-14",
    VenueName: "O2 Arena",
    City: "London",
    Country: "United Kingdom",
    RecordingType: "Soundboard",
    Setlist: "Here Comes the Night Time / Normal Person / Joan of Arc / Supersymmetry",
    Lineage: "Soundboard",
    FolderPath: "/archive/arcadefire/2018-12-14",
    RepVideoCount: 4,
    RepVideoFiles: "o2.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4900",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "11.1 GB",
    Notes: "Epic O2 Arena show",
    ImageURLs: ["https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800"]
  },
  {
    ShowID: "032",
    MasterDriveName: "Archive032",
    Artist: "Arcade Fire",
    ShowDate: "2017-06-08",
    VenueName: "Primavera Sound",
    City: "Barcelona",
    Country: "Spain",
    RecordingType: "Webcast",
    Setlist: "Black Mirror / Creature Comfort / Infinite Content / Put Your Money on Me",
    Lineage: "Festival Webcast",
    FolderPath: "/archive/arcadefire/2017-06-08",
    RepVideoCount: 4,
    RepVideoFiles: "primavera.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "4400",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "9.7 GB",
    Notes: "Fantastic Primavera set",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  },
  {
    ShowID: "033",
    MasterDriveName: "Archive033",
    Artist: "Arcade Fire",
    ShowDate: "2016-05-20",
    VenueName: "Bonnaroo",
    City: "Manchester",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "My Body Is a Cage / Ocean of Noise / Intervention / Black Wave/Bad Vibrations",
    Lineage: "Soundboard Digital",
    FolderPath: "/archive/arcadefire/2016-05-20",
    RepVideoCount: 4,
    RepVideoFiles: "bonnaroo.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "5000",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "11.4 GB",
    Notes: "Memorable Bonnaroo headline set",
    ImageURLs: ["https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800"]
  },
  // Add more Radiohead shows for testing
  {
    ShowID: "034",
    MasterDriveName: "Archive034",
    Artist: "Radiohead",
    ShowDate: "2023-11-10",
    VenueName: "Madison Square Garden",
    City: "New York",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "15 Step / Bodysnatchers / All I Need / Weird Fishes/Arpeggi / The Gloaming",
    Lineage: "Soundboard",
    FolderPath: "/archive/radiohead/2023-11-10",
    RepVideoCount: 5,
    RepVideoFiles: "msg.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6900",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "15.8 GB",
    Notes: "Stunning MSG performance",
    ImageURLs: ["https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"]
  },
  {
    ShowID: "035",
    MasterDriveName: "Archive035",
    Artist: "Radiohead",
    ShowDate: "2022-07-18",
    VenueName: "Red Rocks Amphitheatre",
    City: "Morrison",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "2 + 2 = 5 / There There / Go to Sleep / Myxomatosis / Scatterbrain",
    Lineage: "Soundboard Digital",
    FolderPath: "/archive/radiohead/2022-07-18",
    RepVideoCount: 5,
    RepVideoFiles: "redrocks.mp4",
    VideoCodec: "H.265",
    Width: "1920",
    Height: "1080",
    DurationSec: "7500",
    Container: "MKV",
    FileCount: "5",
    TotalSizeHuman: "17.2 GB",
    Notes: "Epic Red Rocks show",
    ImageURLs: ["https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800"]
  },
  {
    ShowID: "036",
    MasterDriveName: "Archive036",
    Artist: "Radiohead",
    ShowDate: "2021-09-14",
    EventOrFestival: "Lollapalooza",
    VenueName: "Grant Park",
    City: "Chicago",
    Country: "USA",
    RecordingType: "Webcast",
    Setlist: "Reckoner / House of Cards / Jigsaw Falling Into Place / Videotape",
    Lineage: "HD Webcast",
    FolderPath: "/archive/radiohead/2021-09-14",
    RepVideoCount: 4,
    RepVideoFiles: "lolla.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6200",
    Container: "MP4",
    FileCount: "4",
    TotalSizeHuman: "14.5 GB",
    Notes: "Incredible Lollapalooza headline",
    ImageURLs: ["https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800"]
  },
  {
    ShowID: "037",
    MasterDriveName: "Archive037",
    Artist: "Radiohead",
    ShowDate: "2020-06-29",
    EventOrFestival: "Glastonbury Festival",
    VenueName: "Pyramid Stage",
    City: "Pilton",
    Country: "United Kingdom",
    RecordingType: "Webcast",
    Setlist: "Airbag / Lucky / Climbing Up the Walls / No Surprises / The Tourist",
    Lineage: "BBC Webcast",
    FolderPath: "/archive/radiohead/2020-06-29",
    RepVideoCount: 5,
    RepVideoFiles: "glastonbury2.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6800",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "15.2 GB",
    Notes: "Another classic Glastonbury set",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  },
  {
    ShowID: "038",
    MasterDriveName: "Archive038",
    Artist: "Radiohead",
    ShowDate: "2019-10-22",
    VenueName: "Hollywood Bowl",
    City: "Los Angeles",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Bloom / Morning Mr Magpie / Little by Little / Feral / Lotus Flower",
    Lineage: "Soundboard Matrix",
    FolderPath: "/archive/radiohead/2019-10-22",
    RepVideoCount: 5,
    RepVideoFiles: "bowl.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "7100",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "16.1 GB",
    Notes: "Mesmerizing Hollywood Bowl performance",
    ImageURLs: ["https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800"]
  },
  {
    ShowID: "039",
    MasterDriveName: "Archive039",
    Artist: "Radiohead",
    ShowDate: "2018-08-03",
    VenueName: "Outside Lands",
    City: "San Francisco",
    Country: "USA",
    RecordingType: "Soundboard",
    Setlist: "Codex / Give Up the Ghost / Separator / The Daily Mail / Staircase",
    Lineage: "Soundboard",
    FolderPath: "/archive/radiohead/2018-08-03",
    RepVideoCount: 5,
    RepVideoFiles: "outsidelands.mp4",
    VideoCodec: "H.264",
    Width: "1920",
    Height: "1080",
    DurationSec: "6600",
    Container: "MP4",
    FileCount: "5",
    TotalSizeHuman: "14.8 GB",
    Notes: "Beautiful Outside Lands set",
    ImageURLs: ["https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800"]
  }
];