
import { useState } from 'react';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ArtistRow } from './components/ArtistRow';
import { ShowDrawer } from './components/ShowDrawer';
import { ImageLightbox } from './components/ImageLightbox';
import { useShows } from './src/hooks/useShows';
import { useSearchAndFilter } from './src/hooks/useSearchAndFilter';
import { useScrollSpy } from './src/hooks/useScrollSpy';
import { useKeyboardNavigation } from './src/hooks/useKeyboardNavigation';

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
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Custom hooks for data and behavior
  const { shows, getImageUrl } = useShows();
  const { groupedShows, sortedArtists } = useSearchAndFilter(shows, searchQuery);
  const {
    focusedIndex,
    setFocusedIndex,
    isKeyboardMode,
    setIsKeyboardMode,
  } = useKeyboardNavigation(sortedArtists, groupedShows, selectedShow, handleShowClick, handleArtistJump);
  const { currentArtistIndex, mainRef } = useScrollSpy(sortedArtists, focusedIndex);

  // Handler functions
  function handleShowClick(show: Show) {
    setSelectedShow(show);
  }

  function handleCloseDrawer() {
    setSelectedShow(null);
  }

  function handleImageClick(imageUrl: string) {
    setLightboxImage(imageUrl);
  }

  function handleCloseLightbox() {
    setLightboxImage(null);
  }

  function handleArtistJump(artist: string) {
    // Clear keyboard focus when jumping to an artist
    setFocusedIndex(null);
    setIsKeyboardMode(false);
    
    const element = document.getElementById(`artist-${artist.replace(/\s+/g, '-')}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function getFocusedShowId() {
    if (!focusedIndex) return null;
    const { artistIndex, showIndex } = focusedIndex;
    const artist = sortedArtists[artistIndex];
    return groupedShows[artist]?.[showIndex]?.ShowID || null;
  }

  const currentArtist = sortedArtists[currentArtistIndex] || 'Browse Shows';
  const currentLetter = currentArtist ? currentArtist[0].toUpperCase() : '';

  const mainContent = sortedArtists.length === 0 ? (
    <div className="text-center py-20 text-gray-400">No shows found</div>
  ) : (
    <div className="space-y-0">
      {sortedArtists.map((artist, index) => {
        const distanceFromCenter = Math.abs(index - currentArtistIndex);
        let opacity = 1;
        if (distanceFromCenter === 0) opacity = 1;
        else if (distanceFromCenter === 1) opacity = 0.4;
        else opacity = 0.15;

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
  );

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <TopNav
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        artists={sortedArtists}
        onArtistJump={handleArtistJump}
      />

      <div className="flex">
        <div className="hidden md:block">
          <Sidebar
            artists={sortedArtists}
            activeLetter={currentLetter}
            onLetterClick={(letter) => {
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
              <button onClick={() => setSearchQuery('')} className="text-sm text-gray-400 hover:text-white transition-colors">
                Clear search
              </button>
            </div>
          )}

          {mainContent}
        </main>
      </div>

      {selectedShow && (
        <ShowDrawer show={selectedShow} onClose={handleCloseDrawer} onImageClick={handleImageClick} getImageUrl={getImageUrl} />
      )}

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={handleCloseLightbox} />}
    </div>
  );
}