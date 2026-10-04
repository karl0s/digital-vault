export default function FloatingGlassChip() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col">
      {/* Playground header */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5">
        <a
          href={`${base}/playground`}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest"
        >
          ← Playground
        </a>
        <span className="text-[10px] text-gray-700 font-mono">grid / v1-floating-glass-chip</span>
      </div>

      {/* Experiment canvas */}
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-wrap gap-3 justify-center max-w-xl">
          {['Proshot', 'Soundboard', 'Audience', 'Glastonbury', 'Rock am Ring', 'MTV Unplugged', 'Reading Festival', 'Pinkpop'].map(label => (
            <button
              key={label}
              className="
                px-4 py-1.5 rounded-full text-sm font-medium
                bg-white/8 border border-white/10
                hover:bg-white/14 hover:border-white/20
                backdrop-blur-md
                shadow-[0_2px_12px_rgba(0,0,0,0.4)]
                text-gray-200 hover:text-white
                transition-all duration-200
                cursor-pointer
              "
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
