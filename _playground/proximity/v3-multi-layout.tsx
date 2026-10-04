import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, motionValue, useTransform, animate } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LazyImage } from '../../components/LazyImage';

// ─── Show data ────────────────────────────────────────────────────────────────

const SHOWS = [
  { ShowID: '3d97ae42ed27', Artist: 'Soundgarden',              ShowDate: '1996-09-20', VenueName: 'MTV Studios',            City: 'London',    Country: 'United Kingdom', EventOrFestival: 'MTV Live & Loud',       RecordingType: 'Proshot', DurationSec: '1513', ChecksumSHA1: '177ffa66f801fcd0b6607197acd1b7d167806012' },
  { ShowID: 'ccd7ed3c2fa4', Artist: 'Stone Temple Pilots',      ShowDate: '1993-11-17', VenueName: 'Sony Music Studios',     City: 'New York',  Country: 'United States',  EventOrFestival: 'MTV Unplugged',         RecordingType: '',        DurationSec: '1441', ChecksumSHA1: '5c31236be7144a6b5cbc181d81103e6424491869' },
  { ShowID: '3fe2d2713abb', Artist: 'Lenny Kravitz',            ShowDate: '1994-01-01', VenueName: '',                      City: 'New York',  Country: 'United States',  EventOrFestival: 'MTV Unplugged',         RecordingType: '',        DurationSec: '645',  ChecksumSHA1: 'b07670f36614d0122bfc56b75d784399ef24f9d7' },
  { ShowID: '3620031b5215', Artist: 'Stone Temple Pilots',      ShowDate: '2000-03-08', VenueName: 'Metropolis Studios',     City: 'New York',  Country: 'United States',  EventOrFestival: 'VH1 Storytellers',     RecordingType: '',        DurationSec: '1005', ChecksumSHA1: '3382a83f747fbc34e5f4a121262ac810a565be33' },
  { ShowID: 'e16f55a36df2', Artist: 'Audioslave',               ShowDate: '2003-06-07', VenueName: 'Nürburgring',           City: 'Nürburg',   Country: 'Germany',        EventOrFestival: 'Rock am Ring',         RecordingType: '',        DurationSec: '1350', ChecksumSHA1: '0e666f11b8e247d8f5808fa6fbe9a09de28db4ef' },
  { ShowID: '4dba0c8ff6ae', Artist: 'Nirvana',                  ShowDate: '1993-11-18', VenueName: 'Seattle',               City: 'WA',        Country: 'United States',  EventOrFestival: 'MTV Unplugged',        RecordingType: 'Proshot', DurationSec: '2281', ChecksumSHA1: '2b50db2dbb41002242d085fefb7282e67f743440' },
  { ShowID: '6cd303bce708', Artist: 'Rage Against the Machine', ShowDate: '1996-05-24', VenueName: 'Nürburgring',           City: 'Nürburg',   Country: 'Germany',        EventOrFestival: 'Rock am Ring',        RecordingType: '',        DurationSec: '1461', ChecksumSHA1: '1e6697438f014b61a427701100fb693efeda12f7' },
  { ShowID: '730be7647294', Artist: 'Red Hot Chili Peppers',    ShowDate: '1996-02-09', VenueName: 'Madison Square Garden', City: 'New York',  Country: 'United States',  EventOrFestival: 'Madison Square Gardens', RecordingType: 'Proshot', DurationSec: '2899', ChecksumSHA1: '55349b8dad9b5c99b3bcbed3b863c1b31ad305a3' },
  { ShowID: 'a939ab1baf17', Artist: 'Radiohead',                ShowDate: '1997-12-19', VenueName: '',                      City: 'New York',  Country: 'United States',  EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '2846', ChecksumSHA1: 'ed4d57089276d2636ecef1c91da17057969d6533' },
  { ShowID: '7a560b04c0fb', Artist: 'Stone Temple Pilots',      ShowDate: '1999-08-12', VenueName: 'House of Blues',        City: 'Las Vegas', Country: 'United States',  EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '2627', ChecksumSHA1: 'e7ff6ec817fdb6a12d881863b10c0f6822d5ad4d' },
  { ShowID: '6b3751fea69f', Artist: "Jane's Addiction",         ShowDate: '2003-09-30', VenueName: 'Brixton Academy',       City: 'London',    Country: 'United Kingdom', EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '3177', ChecksumSHA1: '96d60872896372f01299d8a83d91c69bae96e79d' },
];

type Show = typeof SHOWS[number];

// ─── Flat card arrays for all sections ────────────────────────────────────────
// All cards are registered in one flat array. The pointer handler iterates over
// every card on every pointermove, using getBoundingClientRect() to compute
// distance. Cards in scrolled-off positions return off-screen rects → dist > radius
// → t ≈ 0, so they self-correct without any special-casing.

const ROW1   = SHOWS.slice(0, 8);                                                // Featured
const ROW2   = [...SHOWS.slice(4), ...SHOWS.slice(0, 1)];                        // Top Artists (8)
const GRID   = Array.from({ length: 21 }, (_, i) => SHOWS[i % SHOWS.length]);   // Search grid (21)

const ALL    = [...ROW1, ...ROW2, ...GRID];  // 37 cards total
const R1_END = ROW1.length;                  // 8
const R2_END = ROW1.length + ROW2.length;    // 16

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getColorFromString = (str: string): string => {
  const colors = ['bg-red-900','bg-blue-900','bg-green-900','bg-purple-900','bg-pink-900','bg-indigo-900','bg-yellow-900','bg-teal-900'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── useScrollRow hook ────────────────────────────────────────────────────────

function useScrollRow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft]   = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 2);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [update]);

  const scrollLeft  = () => scrollRef.current?.scrollBy({ left: -560, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left:  560, behavior: 'smooth' });

  return { scrollRef, showLeft, showRight, isHovered, setIsHovered, scrollLeft, scrollRight };
}

// ─── ProximityCard ────────────────────────────────────────────────────────────
//
// strength (analog, 0–1) → thumbnail scale only
// hover    (boolean-intent, 0 or 1, animated) → overlay / badge / duration
//
// The clip container (overflow-hidden + border-radius) is NEVER transformed.
// The motion.div that scales is inside it, so border-radius stays crisp.
// All geometry reads (r.width * 0.75, r.width * 0.375) are relative to the
// card's own rendered width — correct at any card size, any layout.

function ProximityCard({ show, strength, hover, imgBase, peakScale }: {
  show: Show;
  strength: MotionValue<number>;
  hover: MotionValue<number>;
  imgBase: string;
  peakScale: number;
}) {
  const peakRef = useRef(peakScale);
  useEffect(() => { peakRef.current = peakScale; }, [peakScale]);

  const scale    = useTransform(strength, v => 1 + v * (peakRef.current - 1));
  const contentY = useTransform(hover, [0, 1], [5, 0]);

  const year        = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  const durationMin = Math.floor(parseInt(show.DurationSec || '0') / 60);
  const hours       = Math.floor(durationMin / 60);
  const durationText = hours > 0 ? `${hours}h ${durationMin % 60}m` : `${durationMin}m`;
  const location     = [show.City, show.Country].filter(Boolean).join(', ');
  const contextLabel = show.EventOrFestival || show.VenueName || location;
  const imageUrl     = `${imgBase}/images/${show.ChecksumSHA1}_01.jpg`;
  const bgColor      = getColorFromString(show.Artist);

  return (
    <div className="cursor-pointer w-full">
      {/* Clip layer — border-radius lives here, never transforms */}
      <div className="relative overflow-hidden rounded-md">
        {/* Scale layer — transforms without affecting the clip boundary */}
        <motion.div
          className="aspect-4/3 bg-neutral-900 relative"
          style={{ scale, willChange: 'transform' }}
        >
          <LazyImage
            src={imageUrl}
            alt={`${show.Artist} — ${show.VenueName || show.City}`}
            className="w-full h-full"
            placeholderColor={bgColor}
          />
          <motion.div
            className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent pointer-events-none"
            style={{ opacity: hover }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none"
            style={{ opacity: hover, y: contentY }}
          >
            {durationMin > 0 && <p className="text-xs text-gray-500">{durationText}</p>}
          </motion.div>
          {show.RecordingType && (
            <motion.div
              className="absolute bottom-2 right-2 z-10 pointer-events-none"
              style={{ opacity: hover }}
            >
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide bg-black text-white border border-white/10">
                {show.RecordingType.split(' ')[0].toUpperCase()}
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>

      <div className="mt-2 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-white truncate leading-snug">{show.Artist}</p>
          {year && <span className="text-[11px] text-gray-600 shrink-0 tabular-nums">{year}</span>}
        </div>
        {contextLabel && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5 leading-snug">{contextLabel}</p>
        )}
      </div>
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ label, hint, value, min, max, step, format, onChange }: {
  label: string; hint: string; value: number; min: number; max: number;
  step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-500">{label}</div>
          <div className="text-[8px] text-gray-700 mt-0.5">{hint}</div>
        </div>
        <span className="text-[12px] font-mono text-white shrink-0">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full cursor-pointer" style={{ accentColor: 'white' }}
      />
    </div>
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = { radius: 300, peakScale: 1.04 };
type Settings = typeof DEFAULTS;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MultiLayout() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Single pointer-tracking zone covers all sections
  const demoRef  = useRef<HTMLDivElement>(null);
  // Flat array of card refs across all sections — same order as ALL[]
  const cardRefs = useRef<(HTMLDivElement | null)[]>(Array(ALL.length).fill(null));

  // One MotionValue pair per card, indexed to match cardRefs
  const strengths     = useRef<MotionValue<number>[]>(ALL.map(() => motionValue(0)));
  const hovers        = useRef<MotionValue<number>[]>(ALL.map(() => motionValue(0)));
  const wasInsideRef  = useRef<boolean[]>(ALL.map(() => false));
  const hoverAnimsRef = useRef<Array<{ stop: () => void } | null>>(ALL.map(() => null));
  const leaveAnims    = useRef<Array<{ stop: () => void }>>([]);
  const isInsideRef   = useRef(false);

  const row1 = useScrollRow();
  const row2 = useScrollRow();

  const settingsRef = useRef<Settings>({ ...DEFAULTS });
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [isAreaHovered, setIsAreaHovered] = useState(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ─── Pointer handler — single loop over all 37 cards ─────────────────────────

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (leaveAnims.current.length) {
      leaveAnims.current.forEach(a => a.stop());
      leaveAnims.current = [];
    }
    if (!isInsideRef.current) {
      isInsideRef.current = true;
      setIsAreaHovered(true);
    }

    const { radius } = settingsRef.current;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const r = card.getBoundingClientRect();

      // thumbH scales with the card's actual rendered width — correct at any size/layout
      const thumbH = r.width * 0.75;
      const cx     = r.left + r.width / 2;
      const cy     = r.top  + thumbH / 2;

      // strength: analog, distance from thumbnail centre
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      strengths.current[i].set(Math.max(0, 1 - dist / radius));

      // hover: boolean — is cursor inside the 4-sided image rectangle?
      const inside = (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.top + thumbH
      );

      if (inside !== wasInsideRef.current[i]) {
        wasInsideRef.current[i] = inside;
        hoverAnimsRef.current[i]?.stop();
        hoverAnimsRef.current[i] = animate(
          hovers.current[i],
          inside ? 1 : 0,
          { duration: inside ? 0.15 : 0.2, ease: 'easeOut' },
        );
      }
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    isInsideRef.current = false;
    setIsAreaHovered(false);

    leaveAnims.current = strengths.current.map(mv =>
      animate(mv, 0, { duration: 0.45, ease: [0.16, 1, 0.3, 1] }),
    );
    ALL.forEach((_, i) => {
      wasInsideRef.current[i] = false;
      hoverAnimsRef.current[i]?.stop();
      hoverAnimsRef.current[i] = animate(hovers.current[i], 0, { duration: 0.2, ease: 'easeOut' });
    });
  }, []);

  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [onPointerMove, onPointerLeave]);

  const set = <K extends keyof Settings>(k: K, v: number) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  // Helper to render the scroll arrows + fades for a row
  const RowChrome = ({ row }: { row: ReturnType<typeof useScrollRow> }) => (
    <>
      {row.showLeft && (
        <div className="absolute left-0 top-0 bottom-6 w-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, #141414 20%, transparent)' }} />
      )}
      {row.showLeft && (
        <button onClick={row.scrollLeft} aria-label="Scroll left"
          className={`cursor-pointer absolute left-2 top-0 bottom-6 z-20 flex items-center transition-opacity duration-200 ${row.isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-white" />
          </div>
        </button>
      )}
      {row.showRight && (
        <div className="absolute right-0 top-0 bottom-6 w-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, #141414 20%, transparent)' }} />
      )}
      {row.showRight && (
        <button onClick={row.scrollRight} aria-label="Scroll right"
          className={`cursor-pointer absolute right-2 top-0 bottom-6 z-20 flex items-center justify-end transition-opacity duration-200 ${row.isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        </button>
      )}
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5 shrink-0">
        <a href={`${base}/playground`}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest">
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">proximity / v3-multi-layout</span>
      </div>

      {/* ── Demo area — single pointer zone covers all sections ─────────────── */}
      <div ref={demoRef} className="flex-1 overflow-y-auto py-8">

        {/* ── Row 1: Featured (horizontal scroll) ───────────────────────────── */}
        <div className="mb-10"
          onMouseEnter={() => row1.setIsHovered(true)}
          onMouseLeave={() => row1.setIsHovered(false)}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-3 px-8">
            Featured
          </h2>
          <div className="relative group/row">
            <div ref={row1.scrollRef} className="flex gap-3 overflow-x-auto px-8 pb-6 scrollbar-hide">
              {ROW1.map((show, localIdx) => {
                const g = localIdx; // global index 0–7
                return (
                  <div key={`r1-${show.ShowID}-${localIdx}`}
                    ref={el => { cardRefs.current[g] = el; }}
                    className="shrink-0 md:w-[calc((100vw-64px-36px)/4)] lg:w-[calc((100vw-64px-48px)/5)] xl:w-[calc((100vw-64px-60px)/6)] 2xl:w-[calc((min(100vw,1924px)-64px-72px)/6.5)]">
                    <ProximityCard show={show} strength={strengths.current[g]} hover={hovers.current[g]} imgBase={base} peakScale={settings.peakScale} />
                  </div>
                );
              })}
            </div>
            <RowChrome row={row1} />
          </div>
        </div>

        {/* ── Row 2: Top Artists (horizontal scroll) ────────────────────────── */}
        <div className="mb-12"
          onMouseEnter={() => row2.setIsHovered(true)}
          onMouseLeave={() => row2.setIsHovered(false)}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-3 px-8">
            Top Artists
          </h2>
          <div className="relative group/row">
            <div ref={row2.scrollRef} className="flex gap-3 overflow-x-auto px-8 pb-6 scrollbar-hide">
              {ROW2.map((show, localIdx) => {
                const g = R1_END + localIdx; // global index 8–15
                return (
                  <div key={`r2-${show.ShowID}-${localIdx}`}
                    ref={el => { cardRefs.current[g] = el; }}
                    className="shrink-0 md:w-[calc((100vw-64px-36px)/4)] lg:w-[calc((100vw-64px-48px)/5)] xl:w-[calc((100vw-64px-60px)/6)] 2xl:w-[calc((min(100vw,1924px)-64px-72px)/6.5)]">
                    <ProximityCard show={show} strength={strengths.current[g]} hover={hovers.current[g]} imgBase={base} peakScale={settings.peakScale} />
                  </div>
                );
              })}
            </div>
            <RowChrome row={row2} />
          </div>
        </div>

        {/* ── Grid: Search Results — CSS grid matching SearchResultsGrid ──────── */}
        <div className="px-8 max-w-[1860px] mx-auto">
          {/* Header matches SearchResultsGrid */}
          <div className="mb-6">
            <h2 className="text-4xl font-bold text-white">"soundgarden"</h2>
            <p className="text-gray-500 text-sm mt-1">
              Found <span className="text-gray-300 tabular-nums">{GRID.length}</span> shows
            </p>
          </div>

          {/* Grid — exact class from SearchResultsGrid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 gap-y-6">
            {GRID.map((show, localIdx) => {
              const g = R2_END + localIdx; // global index 16–36
              return (
                <div key={`grid-${show.ShowID}-${localIdx}`}
                  ref={el => { cardRefs.current[g] = el; }}>
                  <ProximityCard show={show} strength={strengths.current[g]} hover={hovers.current[g]} imgBase={base} peakScale={settings.peakScale} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-12" /> {/* bottom breathing room */}
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/5 bg-black/25 px-12 py-8 shrink-0">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-10">
          <Slider
            label="Proximity Radius" hint="Distance from thumbnail centre where scaling begins"
            value={settings.radius} min={80} max={600} step={20}
            format={v => `${v}px`} onChange={v => set('radius', v)}
          />
          <Slider
            label="Peak Scale" hint="Max thumbnail size at cursor centre"
            value={settings.peakScale} min={1.00} max={1.25} step={0.01}
            format={v => `${v.toFixed(2)}×`} onChange={v => set('peakScale', v)}
          />
        </div>
      </div>
    </div>
  );
}
