
import { useRef, useState, useEffect, useMemo } from 'react';
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

type ViewMode = 'hero' | 'browse';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'general' | undefined>(undefined);
  const [pillTransitionKey, setPillTransitionKey] = useState(0);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('hero');
  const [showAllMode, setShowAllMode] = useState(false);
  const navSearchRef = useRef<HTMLInputElement>(null);

  const { shows, getImageUrl } = useShows();
  const debouncedQuery = useDebounce(searchQuery, 150);
  const { filteredShows, groupedShows, sortedArtists } = useSearchAndFilter(shows, debouncedQuery);

  const allShowsSorted = useMemo(() =>
    [...shows].sort((a, b) => {
      const artistCmp = a.Artist.localeCompare(b.Artist);
      if (artistCmp !== 0) return artistCmp;
      const ad = a.ShowDate || '';
      const bd = b.ShowDate || '';
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return bd.localeCompare(ad);
    }), [shows]);

  const isSearching = debouncedQuery.trim().length > 0;
  // isHeroMode drives layout (sidebar visibility, padding) — independent of search state
  const isHeroMode = viewMode === 'hero';

  // Auto-focus the nav search bar on initial load
  useEffect(() => {
    navSearchRef.current?.focus();
  }, []);

  // Escape clears search or all-shows mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) { setSearchQuery(''); navSearchRef.current?.focus(); }
        else if (showAllMode) { setShowAllMode(false); navSearchRef.current?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchQuery, showAllMode]);

  function handleShowClick(show: Show) {
    if (show.ChecksumSHA1) {
      [1, 2, 3, 4].forEach(index => {
        const url = getImageUrl(show.ChecksumSHA1!, index);
        if (url) { const img = new Image(); img.src = url; }
      });
    }
    setSelectedShow(show);
  }

  function handleSearchChange(query: string, type?: 'artist' | 'general') {
    setSearchQuery(query);
    setSearchType(query.trim() ? type : undefined);
    if (type !== undefined) setPillTransitionKey(k => k + 1);
    if (query.trim()) setShowAllMode(false);
  }

  function handleBrowseAll() {
    setViewMode('browse');
    setSearchQuery('');
  }

  function handleShowAllShows() {
    setShowAllMode(true);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Hero mode: HeroSearch (title + pills) is always mounted; only the slot below it transitions.
  // This means the nav search input never unmounts while the user is typing.
  const heroContent = (
    <motion.div
      key="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <HeroSearch onSearch={handleSearchChange} onBrowseAll={handleShowAllShows} isSearching={isSearching || showAllMode} />
      {/* Content slot: transitions between featured rows, all-shows, and search results */}
      {isSearching ? (
        <div className="px-4 md:px-8 pt-10">
          <SearchResultsGrid
            shows={filteredShows}
            query={debouncedQuery}
            searchType={searchType}
            transitionKey={pillTransitionKey}
            onShowClick={handleShowClick}
            onClear={() => { setSearchQuery(''); setViewMode('hero'); window.scrollTo({ top: 0, behavior: 'smooth' }); navSearchRef.current?.focus(); }}
            getImageUrl={getImageUrl}
          />
        </div>
      ) : showAllMode ? (
        <div className="px-4 md:px-8">
          <SearchResultsGrid
            shows={allShowsSorted}
            query="All Shows"
            searchType="general"
            onShowClick={handleShowClick}
            onClear={() => { setShowAllMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); navSearchRef.current?.focus(); }}
            getImageUrl={getImageUrl}
          />
        </div>
      ) : (
        <FeaturedRows
          shows={shows}
          onShowClick={handleShowClick}
          getImageUrl={getImageUrl}
        />
      )}
    </motion.div>
  );

  // Outer AnimatePresence only switches between hero ↔ browse (not triggered by typing)
  let mainContent: React.ReactNode;
  if (viewMode === 'hero') {
    mainContent = heroContent;
  } else if (isSearching) {
    mainContent = (
      <motion.div
        key="search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SearchResultsGrid
          shows={filteredShows}
          query={debouncedQuery}
          searchType={searchType}
          transitionKey={pillTransitionKey}
          onShowClick={handleShowClick}
          onClear={() => { setSearchQuery(''); setViewMode('hero'); window.scrollTo({ top: 0, behavior: 'smooth' }); navSearchRef.current?.focus(); }}
          getImageUrl={getImageUrl}
        />
      </motion.div>
    );
  } else {
    mainContent = browseContent;
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <TopNav
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onLogoClick={() => { setSearchQuery(''); setViewMode('hero'); setShowAllMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        artists={sortedArtists}
        onArtistJump={handleArtistJumpWithState}
        hasSidebar={!isHeroMode}
        searchInputRef={navSearchRef}
      />

      <div className="flex">
        {/* Sidebar only in browse mode */}
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
          className={`flex-1 ${isHeroMode ? '' : 'ml-0 md:ml-16'} pt-16 ${!isHeroMode && isSearching ? 'px-4 md:px-8' : ''} pb-8 overflow-x-hidden`}
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
