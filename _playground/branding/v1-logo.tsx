import { useEffect } from 'react';

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

export default function LogoPlayground() {
  useGoogleFont(ARCHIVO);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const archivo = "'Archivo Black', sans-serif";

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Playground header */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5">
        <a
          href={`${base}/playground`}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest"
        >
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">branding / v1-logo</span>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-16 space-y-20">

        {/* Current — Bebas Neue (live) */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 block mb-2">Current — Bebas Neue</label>
          <p className="text-[10px] text-gray-700 mb-6">The live wordmark for reference</p>
          <div className="bg-[#1a1a1a] rounded-xl p-12 flex items-center">
            <span className="text-2xl tracking-[0.15em] text-white" style={{ fontFamily: 'var(--font-display)' }}>
              THE VAULT
            </span>
          </div>
        </section>

        {/* Archivo Black — direct comparison */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 block mb-2">Archivo Black — reference match</label>
          <p className="text-[10px] text-gray-700 mb-6">Heavy rounded grotesque — closest free match to the BLUR reference image</p>
          <div className="bg-[#1a1a1a] rounded-xl p-12 flex items-center">
            <span className="text-4xl text-white" style={{ fontFamily: archivo, fontWeight: 900, letterSpacing: '0.05em' }}>
              THE VAULT
            </span>
          </div>
        </section>

        {/* Archivo Black — stacked */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 block mb-2">Archivo Black — stacked</label>
          <p className="text-[10px] text-gray-700 mb-6">Two-line treatment, "THE" as a small eyebrow</p>
          <div className="bg-[#1a1a1a] rounded-xl p-12 flex items-start">
            <div style={{ fontFamily: archivo, fontWeight: 900 }} className="leading-none">
              <div className="text-xs tracking-[0.5em] text-gray-500 mb-1">THE</div>
              <div className="text-6xl text-white" style={{ letterSpacing: '0.03em' }}>VAULT</div>
            </div>
          </div>
        </section>

        {/* Archivo Black — weighted contrast */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 block mb-2">Archivo Black — weighted contrast</label>
          <p className="text-[10px] text-gray-700 mb-6">Dim "THE", bright "VAULT" — draws eye to the name</p>
          <div className="bg-[#1a1a1a] rounded-xl p-12 flex items-center">
            <span style={{ fontFamily: archivo, fontWeight: 900, letterSpacing: '0.05em' }} className="text-4xl">
              <span className="text-gray-600">THE </span>
              <span className="text-white">VAULT</span>
            </span>
          </div>
        </section>

        {/* Archivo Black — halation preview (rough) */}
        <section>
          <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 block mb-2">Archivo Black — halation / glow (text-shadow approximation)</label>
          <p className="text-[10px] text-gray-700 mb-6">CSS text-shadow layering to approximate the chromatic blur reference — next iteration will use stacked DOM layers for accuracy</p>
          <div className="bg-[#0a0a0a] rounded-xl p-12 flex items-center">
            <span
              style={{
                fontFamily: archivo,
                fontWeight: 900,
                fontSize: '4rem',
                letterSpacing: '0.05em',
                color: '#ffffff',
                textShadow: [
                  '0 0 80px #9333ea',
                  '0 0 40px #9333ea',
                  '0 0 120px #7c3aed',
                  '0 0 60px #22d3ee',
                  '0 0 20px #ffffff',
                ].join(', '),
              }}
            >
              THE VAULT
            </span>
          </div>
        </section>

      </div>
    </div>
  );
}
