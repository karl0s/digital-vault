import { useEffect, useRef, useState } from 'react';

const ARCHIVO_URL = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';
const TEXT = 'THE VAULT';
const FS = 130;
const VW = 1060;
const VH = 300;
const BASELINE = 210;

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
  maxCyanOffset: number;
  maxPurpleBlur: number;
  minPurpleBlur: number;
  maxPurpleOffset: number;
  maxCyanBlur: number;
  minCyanBlur: number;
  irradiationMax: number;
  irradOffset: number;
  maxLetterBlur: number;
  purpleColor: string;
  cyanColor: string;
}

const DEFAULTS: Controls = {
  maxPurpleBlur: 13,
  minPurpleBlur: 10,
  maxPurpleOffset: 34,
  maxCyanOffset: 10,
  maxCyanBlur: 17,
  minCyanBlur: 0,
  irradiationMax: 18,
  irradOffset: 10,
  maxLetterBlur: 3,
  purpleColor: '#9333ea',
  cyanColor: '#06b6d4',
};

function Slider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest w-36 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-purple-500 h-0.5" />
      <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{value}</span>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest w-36 shrink-0">{label}</span>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-5 rounded cursor-pointer bg-transparent border-0" />
      <span className="text-[10px] font-mono text-gray-400">{value}</span>
    </div>
  );
}

export default function HalationPerLetter() {
  useGoogleFont(ARCHIVO_URL);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [ctrl, setCtrl] = useState<Controls>(DEFAULTS);
  const set = (key: keyof Controls) => (v: number | string) =>
    setCtrl(prev => ({ ...prev, [key]: v }));

  // Measured x position of each character from the hidden reference text
  const [xPositions, setXPositions] = useState<number[]>([]);
  const [totalWidth, setTotalWidth] = useState(0);
  const measureRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    document.fonts.ready.then(() => {
      if (!measureRef.current) return;
      const positions = TEXT.split('').map((_, i) =>
        measureRef.current!.getStartPositionOfChar(i).x
      );
      setXPositions(positions);
      setTotalWidth(measureRef.current.getBBox().width);
    });
  }, []);

  // Compute per-letter t values: -1 (leftmost visible) → 0 (center) → +1 (rightmost visible)
  const chars = TEXT.split('');
  const visibleIndices = chars.reduce<number[]>((acc, c, i) => (c !== ' ' ? [...acc, i] : acc), []);
  const N = visibleIndices.length;
  const mid = (N - 1) / 2;

  const charData = chars.map((char, i) => {
    const isSpace = char === ' ';
    const vi = isSpace ? -1 : visibleIndices.indexOf(i);
    const t = isSpace ? 0 : (vi - mid) / mid; // -1..+1
    const absT = Math.abs(t);
    return {
      char, i, t, absT, isSpace,
      // Cyan fringe: left letters push DOWN, right letters push UP
      cyanDy:     -t * ctrl.maxCyanOffset,
      cyanBlur:    ctrl.minCyanBlur + absT * (ctrl.maxCyanBlur - ctrl.minCyanBlur),
      // Purple bloom: same radial direction as cyan — bottom-left side, top-right side
      purpleDy:   -t * ctrl.maxPurpleOffset,
      purpleBlur:  ctrl.minPurpleBlur + absT * (ctrl.maxPurpleBlur - ctrl.minPurpleBlur),
      // Directional irradiation: white bleed follows radial direction (bottom-left → top-right)
      irradiation: 4 + absT * (ctrl.irradiationMax - 4),
      irradDx:     t * ctrl.irradOffset,
      irradDy:    -t * ctrl.irradOffset,
      // Letterform blur — uniform, scales with distance from centre.
      letterBlur: absT * ctrl.maxLetterBlur,
    };
  });

  const offsetX = totalWidth > 0 ? (VW - totalWidth) / 2 : 0;
  const ready = xPositions.length === chars.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5 shrink-0">
        <a href={`${base}/playground`}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest">
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">branding / v3-halation-per-letter</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div style={{ width: '100%', maxWidth: VW }}>
          <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', overflow: 'visible' }}>
            <defs>
              {charData.map(cd => cd.isSpace ? null : (
                <filter
                  key={cd.i}
                  id={`glow-${cd.i}`}
                  x="-300%" y="-600%"
                  width="700%" height="1300%"
                  colorInterpolationFilters="sRGB"
                >
                  {/* Purple bloom — offset slightly toward outside of word */}
                  <feFlood floodColor={ctrl.purpleColor} result="pc" />
                  <feComposite in="pc" in2="SourceAlpha" operator="in" result="pt" />
                  <feGaussianBlur in="pt" stdDeviation={cd.purpleBlur} result="pb-raw" />
                  <feOffset in="pb-raw" dy={cd.purpleDy} result="pb" />

                  {/* Cyan fringe — strong directional offset per letter position */}
                  <feFlood floodColor={ctrl.cyanColor} result="cc" />
                  <feComposite in="cc" in2="SourceAlpha" operator="in" result="ct" />
                  <feGaussianBlur in="ct" stdDeviation={cd.cyanBlur} result="cb-raw" />
                  <feOffset in="cb-raw" dy={cd.cyanDy} result="cb" />

                  {/* White irradiation — directional soft bleed following radial direction */}
                  <feGaussianBlur in="SourceAlpha" stdDeviation={cd.irradiation} result="ia-raw" />
                  <feOffset in="ia-raw" dx={cd.irradDx} dy={cd.irradDy} result="ia" />
                  <feFlood floodColor="#ffffff" result="wf" />
                  <feComposite in="wf" in2="ia" operator="in" result="irrad" />

                  {/* Letterform: uniform blur scales with distance from centre. */}
                  <feGaussianBlur in="SourceGraphic" stdDeviation={cd.letterBlur} result="soft-letter" />

                  <feBlend in="pb" in2="cb" mode="screen" result="colors" />
                  <feBlend in="colors" in2="irrad" mode="screen" result="full-glow" />
                  <feBlend in="full-glow" in2="soft-letter" mode="screen" />
                </filter>
              ))}
            </defs>

            {/* Hidden measurement text — positions characters exactly as rendered */}
            <text
              ref={measureRef}
              x={0} y={BASELINE}
              fontFamily="'Archivo Black', sans-serif"
              fontSize={FS}
              letterSpacing={4}
              visibility="hidden"
            >
              {TEXT}
            </text>

            {/* Per-letter filtered text */}
            {ready && charData.map(cd => cd.isSpace ? null : (
              <text
                key={cd.i}
                x={offsetX + xPositions[cd.i]}
                y={BASELINE}
                fill="white"
                fontFamily="'Archivo Black', sans-serif"
                fontSize={FS}
                filter={`url(#glow-${cd.i})`}
              >
                {cd.char}
              </text>
            ))}

            {!ready && (
              <text x={VW / 2} y={BASELINE} textAnchor="middle"
                fill="#333" fontFamily="'Archivo Black', sans-serif" fontSize={FS}>
                {TEXT}
              </text>
            )}
          </svg>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/5 px-8 py-6">
        <div className="max-w-xl space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-4">
            Per-letter controls
          </div>
          <ColorPicker label="Purple colour" value={ctrl.purpleColor}
            onChange={set('purpleColor') as (v: string) => void} />
          <Slider label="Purple blur (edge)" value={ctrl.maxPurpleBlur} min={0} max={100}
            onChange={set('maxPurpleBlur') as (v: number) => void} />
          <Slider label="Purple blur (center)" value={ctrl.minPurpleBlur} min={0} max={40}
            onChange={set('minPurpleBlur') as (v: number) => void} />
          <Slider label="Purple offset (edge)" value={ctrl.maxPurpleOffset} min={0} max={60}
            onChange={set('maxPurpleOffset') as (v: number) => void} />
          <ColorPicker label="Cyan colour" value={ctrl.cyanColor}
            onChange={set('cyanColor') as (v: string) => void} />
          <Slider label="Cyan offset (edge)" value={ctrl.maxCyanOffset} min={0} max={80}
            onChange={set('maxCyanOffset') as (v: number) => void} />
          <Slider label="Cyan blur (edge)" value={ctrl.maxCyanBlur} min={0} max={60}
            onChange={set('maxCyanBlur') as (v: number) => void} />
          <Slider label="Cyan blur (center)" value={ctrl.minCyanBlur} min={0} max={30}
            onChange={set('minCyanBlur') as (v: number) => void} />
          <Slider label="Irradiation (edge)" value={ctrl.irradiationMax} min={0} max={30}
            onChange={set('irradiationMax') as (v: number) => void} />
          <Slider label="Irrad direction" value={ctrl.irradOffset} min={0} max={40}
            onChange={set('irradOffset') as (v: number) => void} />
          <Slider label="Letter blur (edge)" value={ctrl.maxLetterBlur} min={0} max={12}
            onChange={set('maxLetterBlur') as (v: number) => void} />
          <button onClick={() => setCtrl(DEFAULTS)}
            className="mt-2 text-[10px] uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
