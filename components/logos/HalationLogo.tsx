import { useEffect, useRef, useState } from 'react';

// v5 halation logo — per-letter SVG filters with radial chromatic aberration.
// See _playground/branding/v1-logo.md for full technique documentation.
//
// Scaling: the SVG coordinate space is fixed at 1060×300 with all values at
// playground scale. Setting CSS width/height via the `scale` prop makes the
// SVG renderer scale EVERYTHING proportionally — font size, blur radii, offsets.
// Only the CSS-space global blur needs explicit scaling.
// scale=1 → playground size (130px letters). scale≈0.19 → nav size (~25px letters).

const TEXT = 'THE VAULT';
const VW   = 1060;
const VH   = 300;
const BASE = 210;
const FS   = 130;
const LS   = -2;

const PURPLE = '#9333ea';
const CYAN   = '#06b6d4';

// v5 locked defaults — all values in SVG coordinate space (scale=1)
const D = {
  maxPurpleBlur:   18,
  minPurpleBlur:   3,
  maxPurpleOffset: 45,
  maxCyanOffset:   9,
  maxCyanBlur:     17,
  minCyanBlur:     0,
  irradiationMax:  12,
  irradOffset:     19,
  irradOpacity:    38,  // 0–100
  maxLetterBlur:   7,
  maxHBlur:        9.5,
  globalBlur:      1,   // CSS px at scale=1; multiplied by scale before use
};

interface HalationLogoProps {
  scale?: number;           // 1 = playground size. ~0.19 for nav.
  className?: string;
  style?: React.CSSProperties;  // overrides SVG element style (e.g. width:'100%' for responsive)
}

export function HalationLogo({ scale = 1, className, style }: HalationLogoProps) {
  const [xPositions, setXPositions] = useState<number[]>([]);
  const [totalWidth, setTotalWidth]  = useState(0);
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

  const chars = TEXT.split('');
  const visibleIndices = chars.reduce<number[]>((acc, c, i) =>
    c !== ' ' ? [...acc, i] : acc, []
  );
  const mid = (visibleIndices.length - 1) / 2;

  const charData = chars.map((char, i) => {
    const isSpace = char === ' ';
    const vi = isSpace ? -1 : visibleIndices.indexOf(i);
    const t    = isSpace ? 0 : (vi - mid) / mid;
    const absT = Math.abs(t);
    return {
      char, i, t, absT, isSpace,
      cyanDy:     -t * D.maxCyanOffset,
      cyanBlur:    D.minCyanBlur + absT * (D.maxCyanBlur - D.minCyanBlur),
      purpleDy:   -t * D.maxPurpleOffset,
      purpleBlur:  D.minPurpleBlur + absT * (D.maxPurpleBlur - D.minPurpleBlur),
      irradiation: 4 + absT * (D.irradiationMax - 4),
      irradDx:     t  * D.irradOffset,
      irradDy:    -t  * D.irradOffset,
      smearBlur:   absT * D.maxLetterBlur,
      smearDy:    -t   * D.maxLetterBlur,
      hBlur:       absT * D.maxHBlur,
    };
  });

  const offsetX = totalWidth > 0 ? (VW - totalWidth) / 2 : 0;
  const ready   = xPositions.length === chars.length;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={VW * scale}
      height={VH * scale}
      className={className}
      aria-label="The Vault"
      style={{
        overflow:   'visible',
        filter:     D.globalBlur > 0 ? `blur(${D.globalBlur * scale}px)` : undefined,
        opacity:    ready ? 1 : 0,
        transition: 'opacity 0.15s',
        ...style,
      }}
    >
      <defs>
        {charData.map(cd => cd.isSpace ? null : (
          <filter
            key={cd.i}
            id={`hl-glow-${cd.i}`}
            x="-300%" y="-600%"
            width="700%" height="1300%"
            colorInterpolationFilters="sRGB"
          >
            {/* Purple bloom */}
            <feFlood floodColor={PURPLE} result="pc" />
            <feComposite in="pc" in2="SourceAlpha" operator="in" result="pt" />
            <feGaussianBlur in="pt" stdDeviation={cd.purpleBlur} result="pb-raw" />
            <feOffset in="pb-raw" dy={cd.purpleDy} result="pb" />

            {/* Cyan fringe */}
            <feFlood floodColor={CYAN} result="cc" />
            <feComposite in="cc" in2="SourceAlpha" operator="in" result="ct" />
            <feGaussianBlur in="ct" stdDeviation={cd.cyanBlur} result="cb-raw" />
            <feOffset in="cb-raw" dy={cd.cyanDy} result="cb" />

            {/* White irradiation — opacity-controlled */}
            <feGaussianBlur in="SourceAlpha" stdDeviation={cd.irradiation} result="ia-raw" />
            <feOffset in="ia-raw" dx={cd.irradDx} dy={cd.irradDy} result="ia" />
            <feFlood floodColor="#ffffff" result="wf" />
            <feComposite in="wf" in2="ia" operator="in" result="irrad-raw" />
            <feComponentTransfer in="irrad-raw" result="irrad">
              <feFuncA type="linear" slope={D.irradOpacity / 100} />
            </feComponentTransfer>

            {/* Vertical directional smear */}
            <feGaussianBlur in="SourceAlpha" stdDeviation={`${cd.smearBlur * 0.4} ${cd.smearBlur}`} result="smear-blur" />
            <feOffset in="smear-blur" dy={cd.smearDy} result="smear-shifted" />
            <feComposite in="wf" in2="smear-shifted" operator="in" result="letter-smear" />

            {/* Horizontal taper blur */}
            <feGaussianBlur in="SourceAlpha" stdDeviation={`${cd.hBlur} ${cd.hBlur * 0.6}`} result="h-blur" />
            <feComposite in="wf" in2="h-blur" operator="in" result="h-smear" />

            {/* Composite: glows → irrad → v-smear → h-smear → sharp letter */}
            <feBlend in="pb" in2="cb" mode="screen" result="colors" />
            <feBlend in="colors" in2="irrad" mode="screen" result="glow-base" />
            <feBlend in="glow-base" in2="letter-smear" mode="screen" result="with-vsmear" />
            <feBlend in="with-vsmear" in2="h-smear" mode="screen" result="with-hsmear" />
            <feBlend in="with-hsmear" in2="SourceGraphic" mode="screen" />
          </filter>
        ))}
      </defs>

      {/* Hidden measurement element — positions each character exactly */}
      <text
        ref={measureRef}
        x={0} y={BASE}
        fontFamily="'Archivo', sans-serif" fontWeight={700}
        fontSize={FS} letterSpacing={LS}
        visibility="hidden"
      >
        {TEXT}
      </text>

      {ready && charData.map(cd => cd.isSpace ? null : (
        <text
          key={cd.i}
          x={offsetX + xPositions[cd.i]}
          y={BASE}
          fill="white"
          fontFamily="'Archivo', sans-serif" fontWeight={700}
          fontSize={FS}
          filter={`url(#hl-glow-${cd.i})`}
        >
          {cd.char}
        </text>
      ))}
    </svg>
  );
}
