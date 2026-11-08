import { useEffect, useRef, useState } from 'react';
import { cn } from '../src/lib/cn';
import { jumpToY } from '../src/lib/motion';

/**
 * Phones: a letter index at the right edge while the A–Z list is on screen
 * (docs/ux-research/06-mobile-audit.md, R6). The list runs to some twenty
 * screens on a phone; a tap or a drag down the letters jumps to that letter,
 * with the letter shown large beside the thumb while dragging, as in the
 * phone's own contacts. The desktop list has no index: its columns fit a
 * screen or two (the rail there went on 2026-10-13, owner).
 *
 * Scroll-linked work is DOM only: the rail's top follows the filter bar, and
 * the letter at the top of the screen is lit, without re-rendering anything.
 * Only a drag re-renders, and only this component.
 */
export function LetterIndex({ letters, visible }: { letters: string[]; visible: boolean }) {
  const railRef = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ letter: string; y: number } | null>(null);

  // The bar's height changes (it folds while scrolling down), so the rail is
  // placed under it on every scroll frame, and the letter on screen is lit.
  useEffect(() => {
    const rail = railRef.current;
    if (!visible || !rail) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const barBottom = Math.max(0, document.querySelector('[data-filter-bar]')?.getBoundingClientRect().bottom ?? 0);
        rail.style.top = `${barBottom + 8}px`;
        let current = letters[0];
        for (const letter of letters) {
          const section = document.querySelector(`section[data-letter="${CSS.escape(letter)}"]`);
          if (section && section.getBoundingClientRect().top <= barBottom + 16) current = letter;
        }
        rail.querySelectorAll('[data-active]').forEach(el => el.removeAttribute('data-active'));
        rail.querySelector(`[data-index-letter="${CSS.escape(current)}"]`)?.setAttribute('data-active', '');
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [visible, letters]);

  function jumpTo(letter: string) {
    const section = document.querySelector(`section[data-letter="${CSS.escape(letter)}"]`);
    const bar = document.querySelector('[data-filter-bar]')?.getBoundingClientRect().height ?? 0;
    if (section) jumpToY(section.getBoundingClientRect().top + window.scrollY - bar - 4);
  }

  // The letter under the finger, from its height on the rail.
  function letterAt(clientY: number): string | null {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || !letters.length) return null;
    const i = Math.floor(((clientY - rect.top) / rect.height) * letters.length);
    return letters[Math.min(letters.length - 1, Math.max(0, i))];
  }

  function follow(e: React.PointerEvent) {
    const letter = letterAt(e.clientY);
    if (!letter) return;
    if (letter !== drag?.letter) jumpTo(letter);
    setDrag({ letter, y: e.clientY });
  }

  if (!letters.length) return null;

  return (
    <>
      <nav
        ref={railRef}
        aria-label="Jump to a letter"
        // touch-none: a drag on the rail moves through the letters, not the page.
        className={cn(
          'fixed right-0.5 z-30 flex w-7 touch-none select-none flex-col items-center justify-between md:hidden print:hidden',
          'bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] transition-opacity duration-200',
          visible ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
        )}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); follow(e); }}
        onPointerMove={e => { if (drag) follow(e); }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {letters.map(letter => (
          <button
            key={letter}
            type="button"
            tabIndex={visible ? 0 : -1}
            data-index-letter={letter}
            // The pointer handlers above do the jumping; this is the keyboard
            // and screen-reader path.
            onClick={e => { if (e.detail === 0) jumpTo(letter); }}
            aria-label={`Artists starting with ${letter === '#' ? 'a number' : letter}`}
            className="group flex min-h-0 flex-1 items-center justify-center text-xs font-semibold leading-none text-gray-300 data-active:text-white"
          >
            <span className="rounded-full px-1 py-0.5 group-data-active:bg-white/18">{letter}</span>
          </button>
        ))}
      </nav>
      {/* The letter under the thumb, large, while dragging. */}
      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-11 z-30 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#282828]/95 font-(family-name:--font-display) text-[2.125rem] leading-none text-white shadow-xl shadow-black/50 md:hidden"
          style={{ top: drag.y }}
        >
          {drag.letter}
        </div>
      )}
    </>
  );
}
