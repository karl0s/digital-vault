
import { useRef, useState, useEffect, useCallback } from 'react';
import { ArtistDirectory } from './components/ArtistDirectory';
import { ShowDrawer } from './components/ShowDrawer';
import { SearchResultsGrid } from './components/SearchResultsGrid';
import { HeroSearch } from './components/HeroSearch';
import { FeaturedRows } from './components/FeaturedRows';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useShows } from './src/hooks/useShows';
import { useDebounce } from './src/hooks/useDebounce';
import { scrollToTop, scrollToY } from './src/lib/motion';
import { CONTENT_WIDTH } from './src/lib/layout';
import { AppShell } from './components/shell/AppShell';
import { FilterBar } from './components/filters/FilterBar';
import { ShowGrid } from './components/ShowGrid';
import { useBrowseResults } from './src/hooks/useBrowseResults';
import { isFiltered as computeIsFiltered, LEGACY_VIEW_PARAM } from './src/lib/url';
import { useFilterStore, initFilterUrlSync, selectFilterState } from './src/store/filters';
import { startHoverPreload } from './src/lib/hoverPreload';
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
  /** What the record is; absent means a live show. Only 'Documentary' so far. */
  ContentType?: string;
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
  /** "Yes" keeps the record in shows.json but off the site (see useShows). */
  Hidden?: string;
  /**
   * Set on a record cut from a longer multi-artist recording (a festival
   * broadcast, a talk-show compilation): the ShowID of that master recording.
   * The drawer links back to it, and the master lists every record pointing at it.
   */
  ParentShowID?: string;
  /** Where this record sits on the master's timeline, "H:MM:SS". */
  SegmentStart?: string;
  SegmentEnd?: string;
  /**
   * Absent on the site's own load: Notes ship separately in show-notes.json
   * (scripts/site-data.mjs). Read them through useShows' getNotes, never here.
   */
  Notes?: string;
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const directoryRef = useRef<HTMLElement>(null);

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
  // Cards' hover stills fetched before the hover, on mouse devices only.
  useEffect(() => startHoverPreload(), []);

  const { shows, getImageUrl, getNotes, error } = useShows();
  const debouncedQuery = useDebounce(searchQuery, 150);

  // One pipeline: text query -> facets -> sort, plus the counts the bar needs.
  const { results, counts, histogram, songSuggestion, groups } = useBrowseResults(shows, filterState, getNotes);
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
   * button, Clear all, All artists — pull it back into the input. Guarded
   * against the value we just pushed, or the two would ping-pong.
   */
  useEffect(() => {
    if (storeQuery !== debouncedQuery) setSearchQuery(storeQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeQuery]);

  // Focus the search on load where there is a keyboard to type with. Not on a
  // phone: there the field sits under the masthead and focus would raise the
  // keyboard over the page before anyone asked for it.
  useEffect(() => {
    if (window.matchMedia('(min-width: 48rem)').matches) searchInputRef.current?.focus({ preventScroll: true });
  }, []);

  // Escape clears the search, but not while a show is open: there Escape
  // closes the show (ShowDrawer), and the results behind it must survive so
  // the next copy can be opened (F5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery && !selectedShow) { setSearchQuery(''); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchQuery, selectedShow]);

  // Stable, because every memoised ShowCard receives it as `onSelect`.
  const handleShowClick = useCallback((show: Show) => {
    if (show.ChecksumSHA1) {
      [1, 2, 3, 4].forEach(index => {
        const url = getImageUrl(show.ChecksumSHA1!, index);
        if (url) { const img = new Image(); img.src = url; }
      });
    }
    setSelectedShow(show);
  }, [getImageUrl]);

  function handleSearchChange(query: string, type?: 'artist' | 'general') {
    setSearchQuery(query);
    setSearchType(query.trim() ? type : undefined);
    if (type !== undefined) setPillTransitionKey(k => k + 1);
  }

  /**
   * Picking from the artist list runs the exact-artist facet. The store gets
   * the name at once rather than after the search debounce, so the results
   * replace the list in the same frame as the click. Stable, because the
   * memoised ArtistDirectory receives it.
   */
  const handleArtistSelect = useCallback((artist: string) => {
    setSearchQuery(artist);
    setSearchType('artist');
    setPillTransitionKey(k => k + 1);
    setStoreQuery(artist);
    scrollToTop();
  }, [setStoreQuery]);

  /**
   * The phone's Artists tab, All artists on an artist's results, and an old
   * ?view=artists link: clear everything and jump to the A–Z list. The list
   * only renders while nothing filters, so it clears first and scrolls once
   * the list is on the page — and opens the masthead without its animation
   * (`instantMasthead`), which would otherwise move the list mid-scroll.
   */
  const [instantMasthead, setInstantMasthead] = useState(false);
  const [directoryJump, setDirectoryJump] = useState(0);
  const goToDirectory = useCallback(() => {
    setInstantMasthead(true);
    setSearchQuery('');
    setSearchType(undefined);
    clearAllFilters();
    setDirectoryJump(n => n + 1);
  }, [clearAllFilters]);
  useEffect(() => {
    if (!directoryJump) return;
    const raf = requestAnimationFrame(() => {
      // The bar is measured now, not earlier: it is a row taller while
      // filtering (count and sort) and only drops it in this render, so a
      // margin taken before would land the list under it.
      const list = directoryRef.current;
      const bar = document.querySelector<HTMLElement>('[data-filter-bar]')?.offsetHeight ?? 0;
      if (list) scrollToY(list.getBoundingClientRect().top + window.scrollY - bar);
      setInstantMasthead(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [directoryJump]);

  // An old link to the Artists page lands on the list. Once, when the shows
  // arrive; clearing writes the canonical URL, which drops the old param.
  const legacyLink = useRef(new URLSearchParams(window.location.search).get(LEGACY_VIEW_PARAM) === 'artists');
  useEffect(() => {
    if (!legacyLink.current || shows.length === 0) return;
    legacyLink.current = false;
    goToDirectory();
  }, [shows.length, goToDirectory]);

  /**
   * Whether the artist list fills the screen under the bar: lights "All
   * artists" and the phone's Artists tab. Read on scroll, but React only
   * re-renders when the answer flips.
   */
  const [directoryInView, setDirectoryInView] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const list = directoryRef.current;
        const bar = document.querySelector('[data-filter-bar]')?.getBoundingClientRect().bottom ?? 0;
        const r = list?.getBoundingClientRect();
        setDirectoryInView(Boolean(r) && r!.top <= bar + 2 && r!.bottom > bar + 120);
      });
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      cancelAnimationFrame(raf);
    };
  }, [filtered, shows.length]);

  // The phone tab bar. Search focuses the bar's field inside the tap — it is
  // always mounted and sticky, so iOS raises the keyboard.
  const handleBrowseTab = useCallback(() => {
    if (filtered) { setSearchQuery(''); setSearchType(undefined); clearAllFilters(); }
    scrollToTop();
  }, [filtered, clearAllFilters]);
  const handleSearchTab = useCallback(() => searchInputRef.current?.focus(), []);

  function handleCloseDrawer() { setSelectedShow(null); }

  const hasQuery = filterState.q.trim().length > 0;

  /**
   * The one page: masthead, sticky filter bar, then content.
   *
   * Nothing filtering: Featured shows, then every artist A–Z. A curated row
   * above filtered results would ignore the filter just set, so it renders
   * only here. Filtering: a query gets the titled results (its title, a
   * Clear, and the song hint for names like Kiss); facets alone get the plain
   * grid, whose count is in the bar.
   */
  const browseContent = (
    <motion.div
      key="browse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <HeroSearch isSearching={filtered} instant={instantMasthead} />

      <FilterBar
        counts={counts}
        histogram={histogram}
        resultCount={results.length}
        filtered={filtered}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
      />

      {!filtered ? (
        <>
          <FeaturedRows shows={shows} onShowClick={handleShowClick} getImageUrl={getImageUrl} />
          <ArtistDirectory ref={directoryRef} shows={shows} onArtistSelect={handleArtistSelect} />
        </>
      ) : hasQuery ? (
        <SearchResultsGrid
          shows={results}
          query={filterState.q}
          searchType={searchType}
          transitionKey={pillTransitionKey}
          songSuggestion={songSuggestion}
          groups={groups}
          onShowClick={handleShowClick}
          onArtistSelect={handleArtistSelect}
          // An artist picked from the list goes back to the list; a typed
          // search clears in place and returns to the field.
          onClear={searchType === 'artist'
            ? goToDirectory
            : () => { setSearchQuery(''); setStoreQuery(''); scrollToTop(); searchInputRef.current?.focus(); }}
          onSearch={(q) => handleSearchChange(q, 'general')}
          getImageUrl={getImageUrl}
        />
      ) : (
        <div className={`${CONTENT_WIDTH} pt-6`}>
          <ShowGrid
            shows={results}
            onShowClick={handleShowClick}
            getImageUrl={getImageUrl}
            onClearFilters={clearAllFilters}
          />
        </div>
      )}
    </motion.div>
  );

  let mainContent: React.ReactNode;
  if (error) {
    // Everything depends on the show data, so the failure is handled once here.
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
  } else {
    mainContent = browseContent;
  }

  // React 18 has no `inert` prop type; the attribute passes through as a string.
  // While the drawer is open this takes the whole page behind it out of the tab
  // order and the accessibility tree, which is the half of the modal contract
  // a focus trap alone can't provide.
  //
  // It goes on once the drawer has finished sliding in and comes off once it
  // has finished sliding out — not at the click. Toggling it restyles every
  // element behind it (~24,000 on Browse), and doing that inside the click
  // held the drawer's first frame back by ~100 ms on a Mac and ~0.5 s on a
  // phone-class CPU. Nothing is reachable in between: the backdrop covers the
  // page for the whole animation, and focus moves into the drawer and is
  // trapped from its first frame.
  const [drawerSettled, setDrawerSettled] = useState(false);
  const backgroundInert = drawerSettled ? ({ inert: '' } as Record<string, string>) : {};

  return (
    // reducedMotion="user" makes every motion/react animation honour the OS
    // setting: transform and layout animations are dropped, opacity is kept.
    <MotionConfig reducedMotion="user">
      {/* The page's one h1. Visually hidden because the wordmark carries the
          brand visually, but heading navigation needs a real entry point. */}
      <h1 className="sr-only">The Vault — live concert archive</h1>

      <div {...backgroundInert}>
        <AppShell
          onBrowse={handleBrowseTab}
          onArtists={goToDirectory}
          onSearch={handleSearchTab}
          activeTab={directoryInView && !filtered ? 'artists' : 'browse'}
        >
          {/* presenceAffectsLayout={false} is a performance guard. At its
              default, AnimatePresence hands every motion component beneath it
              a new context object on each render, re-rendering all of them
              straight past React.memo. When the cards still held motion.divs
              that was ~4,600 components redrawn on every drawer open and
              close — ~450 ms on a fast Mac. The flag only matters for `layout`
              animations reacting to a sibling entering or leaving, and nothing
              under here uses them. */}
          <AnimatePresence mode="wait" presenceAffectsLayout={false}>
            {mainContent}
          </AnimatePresence>
        </AppShell>
      </div>

      <AnimatePresence onExitComplete={() => setDrawerSettled(false)}>
        {selectedShow && (
          <ShowDrawer
            show={selectedShow}
            onClose={handleCloseDrawer}
            getImageUrl={getImageUrl}
            shows={shows}
            onOpenShow={handleShowClick}
            onSettled={() => setDrawerSettled(true)}
            notes={getNotes(selectedShow)}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
