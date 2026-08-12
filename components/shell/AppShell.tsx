import { ReactNode, useEffect, useState } from 'react';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar, SidebarWidth } from './Sidebar';

/**
 * Page frame: fixed top bar, persistent sidebar on desktop, bottom tab bar on
 * phones, content in the remaining space.
 *
 * The sidebar is a flex sibling rather than a fixed overlay so the content
 * column reflows instead of sliding underneath it — the whole point of a
 * persistent rail is that it never covers what you are reading.
 */

const STORAGE_KEY = 'vault:sidebar';

interface AppShellProps {
  topBar: ReactNode;
  children: ReactNode;
  onMobileSearchClick: () => void;
}

function readStoredWidth(): SidebarWidth {
  if (typeof window === 'undefined') return 'expanded';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'rail' ? 'rail' : 'expanded';
  } catch {
    // Private browsing can throw on access, not just on write.
    return 'expanded';
  }
}

export function AppShell({ topBar, children, onMobileSearchClick }: AppShellProps) {
  const [width, setWidth] = useState<SidebarWidth>(readStoredWidth);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, width);
    } catch {
      // Persistence is a nicety; never let it break navigation.
    }
  }, [width]);

  return (
    <div className="min-h-dvh bg-[#141414] text-white">
      {topBar}

      <div className="flex pt-16">
        <Sidebar
          width={width}
          onToggleWidth={() => setWidth(w => (w === 'rail' ? 'expanded' : 'rail'))}
        />

        {/*
          min-w-0 is load-bearing: without it a flex child refuses to shrink
          below its content width, and one long row of cards pushes the whole
          column wider than the viewport.

          pb-20 on mobile clears the fixed tab bar so the last row of cards is
          not hidden behind it.
        */}
        <main className="min-w-0 flex-1 overflow-x-clip pb-20 md:pb-8">{children}</main>
      </div>

      <MobileTabBar onSearchClick={onMobileSearchClick} />
    </div>
  );
}
