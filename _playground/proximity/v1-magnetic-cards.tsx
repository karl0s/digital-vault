import { useRef, useState, useEffect, useCallback } from 'react';

// ─── Mock show data ────────────────────────────────────────────────────────────

const CARDS = [
  {
    id: 1, artist: 'Radiohead', year: '1997', venue: 'Glastonbury', type: 'PROSHOT',
    bg: 'radial-gradient(ellipse at 30% 70%, #3730a3 0%, #1e1b4b 55%, #0a0920 100%)',
    accent: '#818cf8',
  },
  {
    id: 2, artist: "Jane's Addiction", year: '2003', venue: 'Brixton Academy', type: 'PROSHOT',
    bg: 'radial-gradient(ellipse at 70% 35%, #c2410c 0%, #7c2d12 55%, #1a0500 100%)',
    accent: '#fb923c',
  },
  {
    id: 3, artist: 'Soundgarden', year: '1996', venue: 'Weenie Roast', type: 'AUDIENCE',
    bg: 'radial-gradient(ellipse at 40% 70%, #0f766e 0%, #134e4a 55%, #011614 100%)',
    accent: '#2dd4bf',
  },
  {
    id: 4, artist: 'RHCP', year: '1999', venue: 'Woodstock', type: 'PROSHOT',
    bg: 'radial-gradient(ellipse at 65% 35%, #b91c1c 0%, #7f1d1d 55%, #300808 100%)',
    accent: '#fca5a5',
  },
  {
    id: 5, artist: 'Smashing Pumpkins', year: '1993', venue: 'Lollapalooza', type: 'SOUNDBOARD',
    bg: 'radial-gradient(ellipse at 35% 65%, #52525b 0%, #27272a 55%, #07070a 100%)',
    accent: '#d4d4d8',
  },
  {
    id: 6, artist: 'Foo Fighters', year: '2000', venue: 'Reading Festival', type: 'AUDIENCE',
    bg: 'radial-gradient(ellipse at 70% 30%, #1d4ed8 0%, #1e3a8a 55%, #060f26 100%)',
    accent: '#93c5fd',
  },
  {
    id: 7, artist: 'Kings of Leon', year: '2008', venue: 'Glastonbury', type: 'PROSHOT',
    bg: 'radial-gradient(ellipse at 40% 70%, #b45309 0%, #78350f 55%, #1a0a00 100%)',
    accent: '#fcd34d',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

// Gap between cards in px — must match the gap style on the flex container below
const GAP_PX = 16;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = { radius: 200, peakScale: 1.5, gaussian: 0.5 };
type Settings = typeof DEFAULTS;

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({
  label, hint, value, min, max, step, format, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number;
  step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-500">{label}</div>
          <div className="text-[8px] text-gray-700 mt-0.5 leading-tight">{hint}</div>
        </div>
        <span className="text-[12px] font-mono text-white shrink-0 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: 'white' }}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MagneticCards() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // rowRef     — the fixed-height pointer-tracking zone
  // containerRef — the flex row (used to measure available width)
  // cardRefs   — outer card wrappers (flex-basis is set here to resize)
  const rowRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRef = useRef<HTMLDivElement>(null);

  const settingsRef = useRef<Settings>({ ...DEFAULTS });
  const debugRef = useRef(false);
  const W_base_ref = useRef<number>(0);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [debug, setDebug] = useState(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    debugRef.current = debug;
    if (!debug && ringRef.current) ringRef.current.style.opacity = '0';
  }, [debug]);

  const set = <K extends keyof Settings>(k: K, v: number) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  // ─── Proximity handler — sets flex-basis, not CSS transform ─────────────────
  //
  // Width conservation law: sum(final card widths) = W_total always.
  // When card A grows by +Δ, the rest collectively shrink by -Δ.
  // Achieved by: raw = W_base × (1 + t × (peakScale-1)), then normalize by k = W_total / sum(raw).
  //
  // Height is handled for free: each card thumbnail has aspect-ratio: 4/3, so as the
  // flex-basis (width) changes, height changes proportionally. No CSS transform needed.
  // Items-end + container bottom-anchored = thumbnail bottom edge stays fixed.

  const onPointerMove = useCallback((e: PointerEvent) => {
    clearTimeout(leaveTimerRef.current);

    const { radius, peakScale, gaussian } = settingsRef.current;
    const sigma = radius / 3;
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.getBoundingClientRect().width;
    const N = CARDS.length;
    const W_total = containerWidth - (N - 1) * GAP_PX;
    const W_base = W_total / N;
    W_base_ref.current = W_base;

    // Compute proximity weight t ∈ [0,1] for each card
    const weights = cardRefs.current.map(card => {
      if (!card) return 0;
      const r = card.getBoundingClientRect();
      // Aim for thumbnail center: horizontal mid, vertical = top + thumbnailHeight/2
      const thumbH = r.width * 0.75; // aspect-ratio 4:3
      const cx = r.left + r.width / 2;
      const cy = r.top + thumbH / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const tL = Math.max(0, 1 - dist / radius);
      const tG = Math.exp(-(dist * dist) / (2 * sigma * sigma));
      return tL * (1 - gaussian) + tG * gaussian;
    });

    // Raw desired widths, then normalize so they sum exactly to W_total
    const rawWidths = weights.map(t => W_base * (1 + t * (peakScale - 1)));
    const rawSum = rawWidths.reduce((a, b) => a + b, 0);
    const k = W_total / rawSum;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      card.style.flexBasis = `${rawWidths[i] * k}px`;
      card.style.flexGrow = '0';
      card.style.flexShrink = '0';
      card.style.transition = 'none';
    });

    // Debug ring
    if (debugRef.current && ringRef.current && rowRef.current) {
      const cr = rowRef.current.getBoundingClientRect();
      const r = settingsRef.current.radius;
      Object.assign(ringRef.current.style, {
        left: `${e.clientX - cr.left}px`,
        top: `${e.clientY - cr.top}px`,
        width: `${r * 2}px`,
        height: `${r * 2}px`,
        marginLeft: `-${r}px`,
        marginTop: `-${r}px`,
        opacity: '1',
      });
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    const W_base = W_base_ref.current;
    if (!W_base) return;

    // Animate each card back to equal width, then restore natural flex-1
    cardRefs.current.forEach(card => {
      if (!card) return;
      card.style.transition = 'flex-basis 600ms cubic-bezier(0.16, 1, 0.3, 1)';
      card.style.flexBasis = `${W_base}px`;
      card.style.flexGrow = '0';
      card.style.flexShrink = '0';
    });

    if (ringRef.current) ringRef.current.style.opacity = '0';

    leaveTimerRef.current = setTimeout(() => {
      cardRefs.current.forEach(card => {
        if (!card) return;
        card.style.transition = '';
        card.style.flexBasis = '';
        card.style.flexGrow = '1';
        card.style.flexShrink = '1';
      });
    }, 650);
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      clearTimeout(leaveTimerRef.current);
    };
  }, [onPointerMove, onPointerLeave]);

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
        <span className="text-[10px] text-gray-700 font-mono">proximity / v1-magnetic-cards</span>
      </div>

      {/* Demo canvas */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gray-600">
          Move your cursor over the cards
        </p>

        {/*
          Fixed-height tracking zone. Cards grow upward into this reserved space.
          420px accommodates peakScale up to ~2.5 without clipping on typical screen widths.
        */}
        <div
          ref={rowRef}
          className="relative w-full px-16"
          style={{ maxWidth: '1440px', height: '420px' }}
        >
          {/* Debug influence ring */}
          <div
            ref={ringRef}
            className="absolute pointer-events-none rounded-full"
            style={{
              opacity: 0,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 65%)',
              transition: 'opacity 0.25s',
            }}
          />

          {/*
            Card flex row — absolute, bottom-anchored within the tracking zone.
            items-end keeps all card-wrapper bottoms at the same Y.
            Combined with bottom-0, the thumbnail bottom edge is fixed for all cards.
            As a card's flex-basis grows, its thumbnail grows via aspect-ratio upward.
          */}
          <div
            ref={containerRef}
            className="absolute bottom-0 flex items-end"
            style={{ left: '64px', right: '64px', gap: `${GAP_PX}px` }}
          >
            {CARDS.map((card, idx) => (
              <div
                key={card.id}
                ref={el => { cardRefs.current[idx] = el; }}
                style={{ flex: '1 1 0', minWidth: 0 }}
              >
                {/* Thumbnail — width driven by parent flex-basis, height auto via aspect-ratio */}
                <div
                  className="relative overflow-hidden rounded-lg"
                  style={{ aspectRatio: '4/3', background: card.bg }}
                >
                  {/* Film grain */}
                  <div
                    className="absolute inset-0 opacity-[0.15] mix-blend-screen pointer-events-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
                      backgroundSize: '200px',
                    }}
                  />
                  {/* Vignette */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 58%)' }}
                  />
                  {/* Accent dot */}
                  <div
                    className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full"
                    style={{ background: card.accent, boxShadow: `0 0 8px 2px ${card.accent}55` }}
                  />
                  {/* Type badge */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[7px] px-1.5 py-[3px] rounded font-bold tracking-widest bg-black/55 text-white/40 border border-white/8">
                      {card.type}
                    </span>
                  </div>
                  {/* Venue */}
                  <div className="absolute bottom-2.5 left-3 right-3">
                    <span className="text-[9px] font-mono text-white/30 truncate block">{card.venue}</span>
                  </div>
                </div>

                {/* Text — in normal flow below thumbnail, never transformed */}
                <div className="mt-2 px-0.5">
                  <p className="text-[12px] font-medium text-white truncate leading-snug">{card.artist}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{card.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls panel */}
      <div className="border-t border-white/5 bg-black/25 px-12 py-8">
        <div className="max-w-3xl mx-auto space-y-7">
          <div className="grid grid-cols-3 gap-10">
            <Slider
              label="Radius" hint="Cursor influence range"
              value={settings.radius} min={40} max={500} step={10}
              format={v => `${v}px`}
              onChange={v => set('radius', v)}
            />
            <Slider
              label="Peak Scale" hint="Max width multiplier at center"
              value={settings.peakScale} min={1.02} max={2.5} step={0.02}
              format={v => `${v.toFixed(2)}×`}
              onChange={v => set('peakScale', v)}
            />
            <Slider
              label="Falloff Curve" hint="Linear → Gaussian"
              value={settings.gaussian} min={0} max={1} step={0.05}
              format={v => v === 0 ? 'Linear' : v === 1 ? 'Gaussian' : `${Math.round(v * 100)}%`}
              onChange={v => set('gaussian', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setDebug(d => !d)}
              className={`text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded border transition-all duration-150 ${
                debug
                  ? 'border-white/20 text-white/60 bg-white/6'
                  : 'border-white/6 text-gray-600 hover:text-gray-400 hover:border-white/12'
              }`}
            >
              {debug ? '◉' : '○'} Influence ring
            </button>
            <button
              onClick={() => setSettings({ ...DEFAULTS })}
              className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-700 hover:text-gray-400 transition-colors"
            >
              Reset defaults ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
