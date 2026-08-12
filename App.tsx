
import { useRef, useState, useEffect, useMemo } from 'react';
import { TopNav } from './components/TopNav';
import { ArtistsView } from './components/ArtistsView';
import { ShowDrawer } from './components/ShowDrawer';
import { SearchResultsGrid } from './components/SearchResultsGrid';
import { HeroSearch } from './components/HeroSearch';
import { FeaturedRows } from './components/FeaturedRows';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useShows } from './src/hooks/useShows';
import { useSearchAndFilter } from './src/hooks/useSearchAndFilter';
import { useDebounce } from './src/hooks/useDebounce';
import { scrollToTop } from './src/lib/motion';

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

type ViewMode = 'hero' | 'artists';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'general' | undefined>(undefined);
  const [pillTransitionKey, setPillTransitionKey] = useState(0);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('hero');
  const [showAllMode, setShowAllMode] = useState(false);
  const navSearchRef = useRef<HTMLInputElement>(null);

  const { shows, getImageUrl, error } = useShows();
  const debouncedQuery = useDebounce(searchQuery, 150);
  const { filteredShows, songSuggestion } = useSearchAndFilter(shows, debouncedQuery);

  const allShowsSorted = useMemo(() =>
    [...shows].sort((a, b) => {
      const artistCmp = a.Artist.localeCompare(b.Artist);
      if (artistCmp !== 0) return artistCmp;
      const ad = a.ShowDate || '';
      const bd = b.ShowDate || '';
      if (!ad && !bd) {
        // Group undated shows by event/title (e.g. "TV Compilation 1..6") so
        // they cluster together deterministically instead of by array order.
        const byEvent = (a.EventOrFestival || '').localeCompare(b.EventOrFestival || '', undefined, { numeric: true });
        return byEvent !== 0 ? byEvent : a.ShowID.localeCompare(b.ShowID);
      }
      if (!ad) return 1;
      if (!bd) return -1;
      return bd.localeCompare(ad);
    }), [shows]);

  const isSearching = debouncedQuery.trim().length > 0;

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

  function handleShowAllShows() {
    setShowAllMode(true);
    setSearchQuery('');
    scrollToTop();
  }

  function handleCloseDrawer() { setSelectedShow(null); }

  function handleShowArtists() {
    setViewMode('artists');
    setSearchQuery('');
    setShowAllMode(false);
    scrollToTop();
  }

  /**
   * Selecting from the artist directory runs the exact-artist facet.
   * viewMode stays 'artists' so clearing the search returns to the directory
   * the user came from rather than dumping them on the homepage.
   */
  function handleArtistSelect(artist: string) {
    handleSearchChange(artist, 'artist');
    scrollToTop();
  }

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
            songSuggestion={songSuggestion}
            onShowClick={handleShowClick}
            onClear={() => { setSearchQuery(''); setViewMode('hero'); scrollToTop(); navSearchRef.current?.focus(); }}
            onSearch={(q) => handleSearchChange(q, 'general')}
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
            onClear={() => { setShowAllMode(false); scrollToTop(); navSearchRef.current?.focus(); }}
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

  // Outer AnimatePresence only switches between hero ↔ artists (not triggered by typing).
  // Searching from the artist directory renders results in place, so clearing
  // the query returns to the directory rather than the homepage.
  let mainContent: React.ReactNode;
  if (error) {
    // Every view depends on shows.json, so the failure is handled once here
    // rather than as an empty state in each of them.
    mainContent = (
      <motion.div
        key="error"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 md:px-8 pt-24 pb-16"
      >
        <div className="max-w-[1860px] mx-auto text-center" role="alert">
          <h2 className="text-2xl font-bold text-white">The archive didn’t load</h2>
          <p className="text-gray-400 text-sm mt-2">
            Something went wrong fetching the show catalogue. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer mt-5 px-4 py-1.5 rounded-full text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors duration-200"
          >
            Reload
          </button>
          <p className="text-gray-400 text-xs mt-6 font-mono">{error}</p>
        </div>
      </motion.div>
    );
  } else if (viewMode === 'artists' && !isSearching) {
    mainContent = <ArtistsView shows={shows} onArtistSelect={handleArtistSelect} />;
  } else if (viewMode === 'artists' && isSearching) {
    mainContent = (
      <motion.div
        key="search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        // Same gutter as the hero-mode results and ArtistsView. This used to
        // come from a conditional class on <main>, which went away with the
        // browse-mode cleanup.
        className="px-4 md:px-8 pt-10"
      >
        <SearchResultsGrid
          shows={filteredShows}
          query={debouncedQuery}
          searchType={searchType}
          transitionKey={pillTransitionKey}
          songSuggestion={songSuggestion}
          onShowClick={handleShowClick}
          onClear={() => { setSearchQuery(''); scrollToTop(); navSearchRef.current?.focus(); }}
          // Clearing here returns to the artist directory, not to all shows.
          clearLabel="Back to artists"
          onSearch={(q) => handleSearchChange(q, 'general')}
          getImageUrl={getImageUrl}
        />
      </motion.div>
    );
  } else {
    mainContent = heroContent;
  }

  // React 18 has no `inert` prop type; the attribute passes through as a string.
  // While the drawer is open this takes the whole page behind it out of the tab
  // order and the accessibility tree, which is the half of the modal contract
  // a focus trap alone can't provide.
  const backgroundInert = selectedShow ? ({ inert: '' } as Record<string, string>) : {};

  return (
    // reducedMotion="user" makes every motion/react animation honour the OS
    // setting: transform and layout animations are dropped, opacity is kept.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#141414] text-white">
        {/* The page's one h1. Visually hidden because the wordmark carries the
            brand visually, but heading navigation needs a real entry point. */}
        <h1 className="sr-only">The Vault — live concert archive</h1>

        <div {...backgroundInert}>
          <TopNav
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onLogoClick={() => { setSearchQuery(''); setViewMode('hero'); setShowAllMode(false); scrollToTop(); }}
            onArtistsClick={handleShowArtists}
            isArtistsActive={viewMode === 'artists'}
            searchInputRef={navSearchRef}
          />

          {/* overflow-x-clip, not -hidden: `hidden` makes this a scroll container,
              which breaks `position: sticky` for descendants (the A–Z rail in
              ArtistsView). `clip` suppresses horizontal overflow without one. */}
          <main className="pt-16 pb-8 overflow-x-clip">
            <AnimatePresence mode="wait">
              {mainContent}
            </AnimatePresence>
          </main>
        </div>

        <AnimatePresence>
          {selectedShow && (
            <ShowDrawer show={selectedShow} onClose={handleCloseDrawer} getImageUrl={getImageUrl} />
          )}
        </AnimatePresence>

      </div>
    </MotionConfig>
  );
}
