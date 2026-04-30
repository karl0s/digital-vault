
import { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ArtistRow } from './components/ArtistRow';
import { ShowDrawer } from './components/ShowDrawer';
import { ImageLightbox } from './components/ImageLightbox';
import { SearchResultsGrid } from './components/SearchResultsGrid';
import { HeroSearch } from './components/HeroSearch';
import { FeaturedRows } from './components/FeaturedRows';
import { AnimatePresence, motion } from 'motion/react';
import { useShows } from './src/hooks/useShows';
import { useSearchAndFilter } from './src/hooks/useSearchAndFilter';
import { useScrollSpy } from './src/hooks/useScrollSpy';
import { useKeyboardNavigation } from './src/hooks/useKeyboardNavigation';
import { useDebounce } from './src/hooks/useDebounce';

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

// View mode controls what the main content area renders
type ViewMode = 'hero' | 'browse';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('hero');

  const { shows, getImageUrl } = useShows();
  const debouncedQuery = useDebounce(searchQuery, 80);
  const { filteredShows, groupedShows, sortedArtists } = useSearchAndFilter(shows, debouncedQuery);

  const isSearching = debouncedQuery.trim().length > 0;

  // Escape clears search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery) setSearchQuery('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchQuery]);

  function handleShowClick(show: Show) {
    if (show.ChecksumSHA1) {
      [1, 2, 3, 4].forEach(index => {
        const url = getImageUrl(show.ChecksumSHA1!, index);
        if (url) { const img = new Image(); img.src = url; }
      });
    }
    setSelectedShow(show);
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query);
  }

  function handleBrowseAll() {
    setViewMode('browse');
    setSearchQuery('');
  }

  function handleCloseDrawer() { setSelectedShow(null); }
  function handleImageClick(imageUrl: string) { setLightboxImage(imageUrl); }
  function handleCloseLightbox() { setLightboxImage(null); }

  function handleArtistJump(artist: string) {
    const element = document.getElementById(`artist-${artist.replace(/\s+/g, '-')}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const {
    focusedIndex,
    setFocusedIndex,
    setIsKeyboardMode,
  } = useKeyboardNavigation(sortedArtists, groupedShows, selectedShow, handleShowClick, handleArtistJump);

  const { currentArtistIndex, mainRef } = useScrollSpy(sortedArtists, focusedIndex);

  const handleArtistJumpWithState = (artist: string) => {
    setFocusedIndex(null);
    setIsKeyboardMode(false);
    setViewMode('browse');
    handleArtistJump(artist);
  };

  function getFocusedShowId() {
    if (!focusedIndex) return null;
    const { artistIndex, showIndex } = focusedIndex;
    const artist = sortedArtists[artistIndex];
    return groupedShows[artist]?.[showIndex]?.ShowID || null;
  }

  const currentArtist = sortedArtists[currentArtistIndex] || 'Browse Shows';
  const currentLetter = currentArtist ? currentArtist[0].toUpperCase() : '';

  const browseContent = (
    <motion.div
      key="browse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {sortedArtists.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No shows found</div>
      ) : (
        <div className="space-y-0">
          {sortedArtists.map((artist, index) => {
            const distanceFromCenter = Math.abs(index - currentArtistIndex);
            const opacity = distanceFromCenter === 0 ? 1 : distanceFromCenter === 1 ? 0.4 : 0.15;
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
                onArtistJump={handleArtistJumpWithState}
                currentArtist={currentArtist}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );

  // Determine what to render in the main area
  let mainContent: React.ReactNode;
  if (isSearching) {
    mainContent = (
      <SearchResultsGrid
        key="search"
        shows={filteredShows}
        query={debouncedQuery}
        onShowClick={handleShowClick}
        onClear={() => setSearchQuery('')}
        getImageUrl={getImageUrl}
      />
    );
  } else if (viewMode === 'hero') {
    mainContent = (
      <motion.div
        key="hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <HeroSearch
          value={searchQuery}
          onChange={handleSearchChange}
          totalShows={shows.length}
          onBrowseAll={handleBrowseAll}
        />
        <FeaturedRows
          shows={shows}
          onShowClick={handleShowClick}
          getImageUrl={getImageUrl}
        />
      </motion.div>
    );
  } else {
    mainContent = browseContent;
  }

  const isHeroMode = viewMode === 'hero' && !isSearching;

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <TopNav
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        artists={sortedArtists}
        onArtistJump={handleArtistJumpWithState}
        hideSearch={isHeroMode}
      />

      <div className="flex">
        {/* Sidebar hidden in hero mode */}
        {!isHeroMode && (
          <div className="hidden md:block">
            <Sidebar
              artists={sortedArtists}
              activeLetter={currentLetter}
              onLetterClick={(letter) => {
                setFocusedIndex(null);
                setIsKeyboardMode(false);
                setViewMode('browse');
                const element = document.getElementById(`artist-${letter}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              onArtistClick={handleArtistJumpWithState}
            />
          </div>
        )}

        <main
          ref={mainRef}
          className={`flex-1 ${isHeroMode ? '' : 'ml-0 md:ml-16'} ${isHeroMode ? 'pt-16' : 'pt-20 md:pt-24'} ${isSearching ? 'px-4 md:px-8' : ''} pb-8 overflow-x-hidden`}
        >
          <AnimatePresence mode="wait">
            {mainContent}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {selectedShow && (
          <ShowDrawer show={selectedShow} onClose={handleCloseDrawer} onImageClick={handleImageClick} getImageUrl={getImageUrl} />
        )}
      </AnimatePresence>

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={handleCloseLightbox} />}
    </div>
  );
}
