import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, motionValue, useTransform, animate } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LazyImage } from '../../components/LazyImage';

// ─── Real show data ────────────────────────────────────────────────────────────

const SHOWS = [
  { ShowID: '3d97ae42ed27', Artist: 'Soundgarden',              ShowDate: '1996-09-20', VenueName: 'MTV Studios',            City: 'London',    Country: 'United Kingdom', EventOrFestival: 'MTV Live & Loud',       RecordingType: 'Proshot', DurationSec: '1513', ChecksumSHA1: '177ffa66f801fcd0b6607197acd1b7d167806012' },
  { ShowID: 'ccd7ed3c2fa4', Artist: 'Stone Temple Pilots',      ShowDate: '1993-11-17', VenueName: 'Sony Music Studios',     City: 'New York',  Country: 'United States',  EventOrFestival: 'MTV Unplugged',         RecordingType: '',        DurationSec: '1441', ChecksumSHA1: '5c31236be7144a6b5cbc181d81103e6424491869' },
  { ShowID: '3fe2d2713abb', Artist: 'Lenny Kravitz',            ShowDate: '1994-01-01', VenueName: '',                      City: 'New York',  Country: 'United States',  EventOrFestival: 'MTV Unplugged',         RecordingType: '',        DurationSec: '645',  ChecksumSHA1: 'b07670f36614d0122bfc56b75d784399ef24f9d7' },
  { ShowID: '3620031b5215', Artist: 'Stone Temple Pilots',      ShowDate: '2000-03-08', VenueName: 'Metropolis Studios',     City: 'New York',  Country: 'United States',  EventOrFestival: 'VH1 Storytellers',     RecordingType: '',        DurationSec: '1005', ChecksumSHA1: '3382a83f747fbc34e5f4a121262ac810a565be33' },
  { ShowID: 'e16f55a36df2', Artist: 'Audioslave',               ShowDate: '2003-06-07', VenueName: 'Nürburgring',           City: 'Nürburg',   Country: 'Germany',        EventOrFestival: 'Rock am Ring',         RecordingType: '',        DurationSec: '1350', ChecksumSHA1: '0e666f11b8e247d8f5808fa6fbe9a09de28db4ef' },
  { ShowID: '4dba0c8ff6ae', Artist: 'Nirvana',                  ShowDate: '1993-11-18', VenueName: 'Seattle',               City: 'WA',        Country: 'United States',  EventOrFestival: 'MTV Unplugged',        RecordingType: 'Proshot', DurationSec: '2281', ChecksumSHA1: '2b50db2dbb41002242d085fefb7282e67f743440' },
  { ShowID: '6cd303bce708', Artist: 'Rage Against the Machine', ShowDate: '1996-05-24', VenueName: 'Nürburgring',           City: 'Nürburg',   Country: 'Germany',        EventOrFestival: 'Rock am Ring',         RecordingType: '',        DurationSec: '1461', ChecksumSHA1: '1e6697438f014b61a427701100fb693efeda12f7' },
  { ShowID: '730be7647294', Artist: 'Red Hot Chili Peppers',    ShowDate: '1996-02-09', VenueName: 'Madison Square Garden', City: 'New York',  Country: 'United States',  EventOrFestival: 'Madison Square Gardens', RecordingType: 'Proshot', DurationSec: '2899', ChecksumSHA1: '55349b8dad9b5c99b3bcbed3b863c1b31ad305a3' },
  { ShowID: 'a939ab1baf17', Artist: 'Radiohead',                ShowDate: '1997-12-19', VenueName: '',                      City: 'New York',  Country: 'United States',  EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '2846', ChecksumSHA1: 'ed4d57089276d2636ecef1c91da17057969d6533' },
  { ShowID: '7a560b04c0fb', Artist: 'Stone Temple Pilots',      ShowDate: '1999-08-12', VenueName: 'House of Blues',        City: 'Las Vegas', Country: 'United States',  EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '2627', ChecksumSHA1: 'e7ff6ec817fdb6a12d881863b10c0f6822d5ad4d' },
  { ShowID: '6b3751fea69f', Artist: "Jane's Addiction",         ShowDate: '2003-09-30', VenueName: 'Brixton Academy',       City: 'London',    Country: 'United Kingdom', EventOrFestival: '',                     RecordingType: 'Proshot', DurationSec: '3177', ChecksumSHA1: '96d60872896372f01299d8a83d91c69bae96e79d' },
];

type Show = typeof SHOWS[number];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getColorFromString = (str: string): string => {
  const colors = ['bg-red-900','bg-blue-900','bg-green-900','bg-purple-900','bg-pink-900','bg-indigo-900','bg-yellow-900','bg-teal-900'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── ProximityCard ─────────────────────────────────────────────────────────────
//
// Two independent MotionValues drive this card:
//
//   strength  (0–1, proximity-based)  → thumbnail scale only
//   hover     (0–1, bounds-based)     → overlay / badge / duration content
//
// `strength` is analog: it fades with cursor distance from card centre.
// `hover`    is boolean in intent but animated: it snaps to 1 when the cursor
//            enters the image rectangle (all 4 sides), 0 when it exits — but
//            Framer Motion animates the transition so it's a smooth fade, not
//            an instant flip. Identical to the existing ShowCard hover, just
//            triggered by image-rect containment instead of onMouseEnter/Leave.

function ProximityCard({ show, strength, hover, imgBase, peakScale }: {
  show: Show;
  strength: MotionValue<number>;
  hover: MotionValue<number>;
  imgBase: string;
  peakScale: number;
}) {
  const peakScaleRef = useRef(peakScale);
  useEffect(() => { peakScaleRef.current = peakScale; }, [peakScale]);

  // Scale: proximity-driven (analog)
  const thumbnailScale = useTransform(strength, v => 1 + v * (peakScaleRef.current - 1));

  // Overlay content: hover-driven (boolean trigger, smooth animated transition)
  // hover goes 0→1 over ~150ms on enter, 1→0 over ~200ms on exit.
  // useTransform maps hover directly to the animated style values.
  const contentY = useTransform(hover, [0, 1], [5, 0]);

  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  const durationMin = Math.floor(parseInt(show.DurationSec || '0') / 60);
  const hours = Math.floor(durationMin / 60);
  const durationText = hours > 0 ? `${hours}h ${durationMin % 60}m` : `${durationMin}m`;
  const location = [show.City, show.Country].filter(Boolean).join(', ');
  const contextLabel = show.EventOrFestival || show.VenueName || location;
  const imageUrl = `${imgBase}/images/${show.ChecksumSHA1}_01.jpg`;
  const bgColor = getColorFromString(show.Artist);

  return (
    <div className="cursor-pointer w-full">
      {/* Clip container — holds border-radius and overflow, never transforms */}
      <div className="relative overflow-hidden rounded-md">
        {/* Scale target — separate from the clip so border-radius never distorts */}
        <motion.div
          className="aspect-4/3 bg-neutral-900 relative"
          style={{ scale: thumbnailScale, willChange: 'transform' }}
        >
          <LazyImage
            src={imageUrl}
            alt={`${show.Artist} — ${show.VenueName || show.City}`}
            className="w-full h-full"
            placeholderColor={bgColor}
          />

          {/* Gradient overlay — opacity driven by hover MotionValue directly */}
          <motion.div
            className="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent pointer-events-none"
            style={{ opacity: hover }}
          />

          {/* Duration — fades + slides up on hover, same as ShowCard */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none"
            style={{ opacity: hover, y: contentY }}
          >
            {durationMin > 0 && (
              <p className="text-xs text-gray-500">{durationText}</p>
            )}
          </motion.div>

          {/* Recording type badge — fades on hover, same as ShowCard */}
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

      {/* Metadata below — identical to ShowCard */}
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

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULTS = { radius: 300, peakScale: 1.04 };
type Settings = typeof DEFAULTS;

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
        className="w-full cursor-pointer"
        style={{ accentColor: 'white' }}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProximityRow() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const rowAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const cardRefs   = useRef<(HTMLDivElement | null)[]>([]);

  // strength: analog 0–1 from cursor distance → thumbnail scale
  const strengths = useRef<MotionValue<number>[]>(SHOWS.map(() => motionValue(0)));
  // hover: boolean-intent 0 or 1, animated on transition → overlay/badge/content
  const hovers    = useRef<MotionValue<number>[]>(SHOWS.map(() => motionValue(0)));

  // Track which cards are currently "inside" the image rect so we only
  // animate the hover MotionValue on enter/exit, not on every pointermove.
  const wasInsideRef   = useRef<boolean[]>(SHOWS.map(() => false));
  // Per-card running hover animations, cancelled when state flips again
  const hoverAnimsRef  = useRef<Array<{ stop: () => void } | null>>(SHOWS.map(() => null));
  // Row-level leave animations (strength fade-out)
  const leaveAnims     = useRef<Array<{ stop: () => void }>>([]);
  const isInsideRef    = useRef(false);

  const settingsRef = useRef<Settings>({ ...DEFAULTS });
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Scroll fade/arrow state
  const updateGradients = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 2);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateGradients();
    el.addEventListener('scroll', updateGradients, { passive: true });
    const ro = new ResizeObserver(updateGradients);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateGradients); ro.disconnect(); };
  }, [updateGradients]);

  // ─── Proximity + bounds handlers ─────────────────────────────────────────────

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (leaveAnims.current.length) {
      leaveAnims.current.forEach(a => a.stop());
      leaveAnims.current = [];
    }
    if (!isInsideRef.current) {
      isInsideRef.current = true;
      setIsRowHovered(true);
    }

    const { radius } = settingsRef.current;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const r = card.getBoundingClientRect();
      // Thumbnail occupies the top 75% of the card wrapper (aspect-ratio 4:3)
      const thumbH = r.width * 0.75;

      // ── Proximity scale (analog, distance from thumbnail centre) ──
      const cx   = r.left + r.width / 2;
      const cy   = r.top  + thumbH / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      strengths.current[i].set(Math.max(0, 1 - dist / radius));

      // ── Overlay hover (boolean: is cursor inside the thumbnail rectangle?) ──
      const inside = (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.top + thumbH
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
    setIsRowHovered(false);

    // Fade strengths back to 0
    leaveAnims.current = strengths.current.map(mv =>
      animate(mv, 0, { duration: 0.45, ease: [0.16, 1, 0.3, 1] }),
    );

    // Fade hover overlays back to 0 and reset tracking
    SHOWS.forEach((_, i) => {
      wasInsideRef.current[i] = false;
      hoverAnimsRef.current[i]?.stop();
      hoverAnimsRef.current[i] = animate(
        hovers.current[i], 0, { duration: 0.2, ease: 'easeOut' },
      );
    });
  }, []);

  useEffect(() => {
    const el = rowAreaRef.current;
    if (!el) return;
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [onPointerMove, onPointerLeave]);

  const scrollLeft  = () => scrollRef.current?.scrollBy({ left: -560, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left:  560, behavior: 'smooth' });
  const set = <K extends keyof Settings>(k: K, v: number) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5">
        <a
          href={`${base}/playground`}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest"
        >
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">proximity / v2-proximity-row</span>
      </div>

      <div ref={rowAreaRef} className="flex-1 flex flex-col justify-center">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-3 px-4 md:px-8">
          Featured
        </h2>

        <div className="relative group/row">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto px-8 pb-6 scrollbar-hide"
          >
            {SHOWS.map((show, idx) => (
              <div
                key={show.ShowID}
                ref={el => { cardRefs.current[idx] = el; }}
                className="shrink-0 md:w-[calc((100vw-64px-36px)/4)] lg:w-[calc((100vw-64px-48px)/5)] xl:w-[calc((100vw-64px-60px)/6)] 2xl:w-[calc((min(100vw,1924px)-64px-72px)/6.5)]"
              >
                <ProximityCard
                  show={show}
                  strength={strengths.current[idx]}
                  hover={hovers.current[idx]}
                  imgBase={base}
                  peakScale={settings.peakScale}
                />
              </div>
            ))}
          </div>

          {showLeft && (
            <div className="absolute left-0 top-0 bottom-6 w-24 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to right, #141414 20%, transparent)' }} />
          )}
          {showLeft && (
            <button onClick={scrollLeft} aria-label="Scroll left"
              className={`cursor-pointer absolute left-2 top-0 bottom-6 z-20 flex items-center transition-opacity duration-200 ${isRowHovered ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4 text-white" />
              </div>
            </button>
          )}
          {showRight && (
            <div className="absolute right-0 top-0 bottom-6 w-24 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to left, #141414 20%, transparent)' }} />
          )}
          {showRight && (
            <button onClick={scrollRight} aria-label="Scroll right"
              className={`cursor-pointer absolute right-2 top-0 bottom-6 z-20 flex items-center justify-end transition-opacity duration-200 ${isRowHovered ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-white/5 bg-black/25 px-12 py-8">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-10">
          <Slider
            label="Proximity Radius"
            hint="How far from each card centre the effect begins"
            value={settings.radius} min={80} max={600} step={20}
            format={v => `${v}px`}
            onChange={v => set('radius', v)}
          />
          <Slider
            label="Peak Scale"
            hint="Max thumbnail size when cursor is at card centre"
            value={settings.peakScale} min={1.00} max={1.25} step={0.01}
            format={v => `${v.toFixed(2)}×`}
            onChange={v => set('peakScale', v)}
          />
        </div>
      </div>
    </div>
  );
}
