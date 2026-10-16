import { ReactNode } from 'react';
import { MobileTabBar } from './MobileTabBar';

/**
 * Page frame: the content, and the bottom tab bar on phones.
 *
 * There is no top bar or sidebar since 2026-10-13: search moved into the
 * sticky filter bar, and the sidebar's places became one page (Featured shows,
 * then every artist A–Z). The content keeps the width it had beside the
 * sidebar, centred — see src/lib/layout.ts.
 */

interface AppShellProps {
  children: ReactNode;
  onBrowse: () => void;
  onArtists: () => void;
  onSearch: () => void;
  activeTab: 'browse' | 'artists';
}

export function AppShell({ children, onBrowse, onArtists, onSearch, activeTab }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-[#141414] text-white print:bg-white print:text-black">
      {/*
        pb-20 on mobile clears the fixed tab bar so the last row of cards is
        not hidden behind it. overflow-x-clip, not hidden: hidden would make
        <main> a scroll container and break the sticky filter bar inside it.
      */}
      <main className="min-w-0 overflow-x-clip pb-20 md:pb-8">{children}</main>

      <MobileTabBar onBrowse={onBrowse} onArtists={onArtists} onSearch={onSearch} active={activeTab} />
    </div>
  );
}
