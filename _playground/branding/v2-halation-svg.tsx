import { useEffect, useState } from 'react';

const ARCHIVO = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';

function useGoogleFont(href: string) {
  useEffect(() => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [href]);
}

interface Controls {
  purpleBlur: number;
  purpleColor: string;
  cyanBlur: number;
  cyanColor: string;
  cyanOffsetY: number;
  irradiation: number;
}

const DEFAULTS: Controls = {
  purpleBlur: 28,
  purpleColor: '#9333ea',
  cyanBlur: 16,
  cyanColor: '#06b6d4',
  cyanOffsetY: 14,
  irradiation: 7,
};

function Slider({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest w-32 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-purple-500 h-0.5"
      />
      <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{value}</span>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest w-32 shrink-0">{label}</span>
      <input
        type="color" value={value}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-5 rounded cursor-pointer bg-transparent border-0"
      />
      <span className="text-[10px] font-mono text-gray-400">{value}</span>
    </div>
  );
}

export default function HalationSVG() {
  useGoogleFont(ARCHIVO);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [c, setC] = useState<Controls>(DEFAULTS);
  const set = (key: keyof Controls) => (v: number | string) => setC(prev => ({ ...prev, [key]: v }));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5 shrink-0">
        <a href={`${base}/playground`} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest">
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">branding / v2-halation-svg</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div style={{ width: '100%', maxWidth: 960 }}>
          <svg
            viewBox="0 0 960 260"
            style={{ width: '100%', overflow: 'visible' }}
          >
            <defs>
              {/*
                LAYER STACK (bottom → top):
                1. Purple bloom  — SourceAlpha flooded purple, heavy gaussian blur
                2. Cyan bloom    — SourceAlpha flooded cyan, medium blur, offset down
                3. Irradiation   — SourceAlpha slightly blurred → white flood → soft white halo
                4. Source text   — sharp white letterforms on top
                All composited via screen blend (additive on dark bg)
              */}
              <filter
                id="chromatic-glow"
                x="-80%"
                y="-400%"
                width="260%"
                height="900%"
                colorInterpolationFilters="sRGB"
              >
                {/* === 1. PURPLE BLOOM === */}
                <feFlood floodColor={c.purpleColor} floodOpacity="1" result="purple-color" />
                <feComposite in="purple-color" in2="SourceAlpha" operator="in" result="purple-text" />
                <feGaussianBlur in="purple-text" stdDeviation={c.purpleBlur} result="purple-blur" />

                {/* === 2. CYAN BLOOM (offset down for chromatic fringe) === */}
                <feFlood floodColor={c.cyanColor} floodOpacity="1" result="cyan-color" />
                <feComposite in="cyan-color" in2="SourceAlpha" operator="in" result="cyan-text" />
                <feGaussianBlur in="cyan-text" stdDeviation={c.cyanBlur} result="cyan-pre" />
                <feOffset in="cyan-pre" dy={c.cyanOffsetY} dx="0" result="cyan-blur" />

                {/* === 3. WHITE IRRADIATION (soft glow just outside letterform) === */}
                <feGaussianBlur in="SourceAlpha" stdDeviation={c.irradiation} result="irrad-alpha" />
                <feFlood floodColor="#ffffff" floodOpacity="1" result="white-flood" />
                <feComposite in="white-flood" in2="irrad-alpha" operator="in" result="irradiation" />

                {/* === COMPOSITE: screen-blend all layers === */}
                <feBlend in="purple-blur" in2="cyan-blur" mode="screen" result="color-mix" />
                <feBlend in="color-mix" in2="irradiation" mode="screen" result="full-glow" />
                <feBlend in="full-glow" in2="SourceGraphic" mode="screen" />
              </filter>
            </defs>

            <text
              x="480"
              y="195"
              textAnchor="middle"
              fill="white"
              fontFamily="'Archivo Black', sans-serif"
              fontSize="148"
              letterSpacing="4"
              filter="url(#chromatic-glow)"
            >
              THE VAULT
            </text>
          </svg>
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/5 px-8 py-6">
        <div className="max-w-xl space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-4">
            Filter controls
          </div>
          <ColorPicker label="Purple colour" value={c.purpleColor} onChange={set('purpleColor') as (v: string) => void} />
          <Slider label="Purple blur" value={c.purpleBlur} min={0} max={80} onChange={set('purpleBlur') as (v: number) => void} />
          <ColorPicker label="Cyan colour" value={c.cyanColor} onChange={set('cyanColor') as (v: string) => void} />
          <Slider label="Cyan blur" value={c.cyanBlur} min={0} max={60} onChange={set('cyanBlur') as (v: number) => void} />
          <Slider label="Cyan offset Y" value={c.cyanOffsetY} min={-40} max={40} onChange={set('cyanOffsetY') as (v: number) => void} />
          <Slider label="Irradiation" value={c.irradiation} min={0} max={30} onChange={set('irradiation') as (v: number) => void} />
          <button
            onClick={() => setC(DEFAULTS)}
            className="mt-2 text-[10px] uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

    </div>
  );
}
