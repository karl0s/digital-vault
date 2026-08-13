
import { useRef, useState, useEffect, useMemo } from 'react';
import { TopNav } from './components/TopNav';
import { ArtistsView } from './components/ArtistsView';
import { ShowDrawer } from './components/ShowDrawer';
import { SearchResultsGrid } from './components/SearchResultsGrid';
import { HeroSearch } from './components/HeroSearch';
import { FeaturedRows } from './components/FeaturedRows';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useShows } from './src/hooks/useShows';
import { useDebounce } from './src/hooks/useDebounce';
import { scrollToTop } from './src/lib/motion';
import { AppShell } from './components/shell/AppShell';
import { FilterBar } from './components/filters/FilterBar';
import { ShowGrid } from './components/ShowGrid';
import { useBrowseResults } from './src/hooks/useBrowseResults';
import { isFiltered as computeIsFiltered } from './src/lib/url';
import { useFilterStore, initFilterUrlSync, selectFilterState } from './src/store/filters';
import { useShallow } from 'zustand/react/shallow';

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

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'general' | undefined>(undefined);
  const [pillTransitionKey, setPillTransitionKey] = useState(0);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  /**
   * PARKED — intentionally unreachable, do not delete as dead code.
   *
   * "All shows" mode renders the whole catalogue in one grid. Its only entry
   * point was the hero's "All Shows →" link, which now goes to the artist
   * directory instead, so nothing sets this to true today. It is kept for the
   * planned sidebar, which will link to it again.
   *
   * Everything reachable only from here is parked with it: `allShowsSorted`,
   * `handleShowAllShows`, the Escape-key branch below, and the `showAllMode`
   * render branch. A dead-code sweep will flag all of them — that is expected.
   */
  const [showAllMode, setShowAllMode] = useState(false);
  const navSearchRef = useRef<HTMLInputElement>(null);

  // Destination lives in the store so it is linkable; see src/lib/url.ts.
  const view = useFilterStore(s => s.view);
  const storeQuery = useFilterStore(s => s.q);
  const setStoreQuery = useFilterStore(s => s.setQuery);
  const clearAllFilters = useFilterStore(s => s.clearAll);
  // useShallow is required, not optional. selectFilterState builds a new object
  // on every call, and zustand v5 reads selectors through useSyncExternalStore,
  // which demands a stable snapshot — without it React re-renders forever with
  // "The result of getSnapshot should be cached". Shallow comparison works here
  // because the facet arrays are only ever replaced, never mutated in place.
  const filterState = useFilterStore(useShallow(selectFilterState));

  // Back/forward -> store. Once, at the root.
  useEffect(() => initFilterUrlSync(), []);

  /**
   * Changing destination clears the search.
   *
   * The query outranks the view when picking what to render, so without this,
   * clicking "Artists" in the sidebar while a search is live leaves you looking
   * at results while the nav claims you are in the directory.
   *
   * The store already clears its own `q`; this mirrors it for App's local
   * search state, which is still the source of truth until the query moves onto
   * the store in a later slice. The ref skips the mount run so a fresh load
   * does not scroll or wipe state it never set.
   */
  const viewMounted = useRef(false);
  useEffect(() => {
    if (!viewMounted.current) { viewMounted.current = true; return; }
    setSearchQuery('');
    setShowAllMode(false);
    scrollToTop();
  }, [view]);

  const { shows, getImageUrl, error } = useShows();
  const debouncedQuery = useDebounce(searchQuery, 150);

  // One pipeline: text query -> facets -> sort, plus the counts the bar needs.
  const { results, counts, histogram, songSuggestion } = useBrowseResults(shows, filterState);
  const filtered = computeIsFiltered(filterState);

  /**
   * The input stays local for responsiveness; only the debounced value reaches
   * the store, and therefore the URL. Writing on every keystroke would call
   * replaceState per character and thrash the address bar.
   */
  useEffect(() => {
    if (debouncedQuery !== storeQuery) setStoreQuery(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  /**
   * The return trip: when the store's query changes from somewhere else — back
   * button, Clear all, switching destination — pull it back into the input.
   * Guarded against the value we just pushed, or the two would ping-pong.
   */
  useEffect(() => {
    if (storeQuery !== debouncedQuery) setSearchQuery(storeQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeQuery]);


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

  // PARKED — see the showAllMode declaration above. No caller today; the
  // planned sidebar will wire this back up.
  function handleShowAllShows() {
    setShowAllMode(true);
    setSearchQuery('');
    scrollToTop();
  }

  function handleCloseDrawer() { setSelectedShow(null); }

  /**
   * Selecting from the artist directory runs the exact-artist facet.
   * viewMode stays 'artists' so clearing the search returns to the directory
   * the user came from rather than dumping them on the homepage.
   */
  function handleArtistSelect(artist: string) {
    handleSearchChange(artist, 'artist');
    scrollToTop();
  }

  /**
   * Browse: masthead, sticky filter bar, then results.
   *
   * The Featured strip renders ONLY when nothing is filtering. A curated row
   * sitting above filtered results ignores the filter the user just set, so it
   * reads either as broken or as results that do not match.
   *
   * The grid below always shows `results` — the full catalogue when nothing is
   * active, the filtered set otherwise — so the count in the bar always
   * describes what is on screen.
   */
  const browseContent = (
    <motion.div
      key="browse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <HeroSearch isSearching={filtered} />

      <FilterBar counts={counts} histogram={histogram} resultCount={results.length} />

      {!filtered && (
        <FeaturedRows shows={shows} onShowClick={handleShowClick} getImageUrl={getImageUrl} />
      )}

      <div className="mx-auto max-w-[1924px] px-4 pt-6 md:px-8">
        {!filtered && (
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            All shows
          </h2>
        )}
        <ShowGrid
          shows={results}
          onShowClick={handleShowClick}
          getImageUrl={getImageUrl}
          onClearFilters={clearAllFilters}
        />
      </div>
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
  } else if (view === 'artists' && !isSearching) {
    mainContent = <ArtistsView shows={shows} onArtistSelect={handleArtistSelect} />;
  } else if (view === 'artists' && isSearching) {
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
          shows={results}
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
    mainContent = browseContent;
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
      {/* The page's one h1. Visually hidden because the wordmark carries the
          brand visually, but heading navigation needs a real entry point. */}
      <h1 className="sr-only">The Vault — live concert archive</h1>

      <div {...backgroundInert}>
        <AppShell
          onMobileSearchClick={() => setMobileSearchOpen(true)}
          topBar={
            <TopNav
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              searchInputRef={navSearchRef}
              mobileSearchOpen={mobileSearchOpen}
              onMobileSearchOpenChange={setMobileSearchOpen}
            />
          }
        >
          <AnimatePresence mode="wait">
            {mainContent}
          </AnimatePresence>
        </AppShell>
      </div>

      <AnimatePresence>
        {selectedShow && (
          <ShowDrawer show={selectedShow} onClose={handleCloseDrawer} getImageUrl={getImageUrl} />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
