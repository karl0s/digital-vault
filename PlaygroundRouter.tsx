import React, { useEffect, useState } from 'react';

const modules = import.meta.glob('./_playground/**/*.tsx');

function getRouteSlug(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = window.location.pathname;
  const withoutBase = path.startsWith(base) ? path.slice(base.length) : path;
  return withoutBase.replace(/^\/playground\/?/, '').replace(/\/$/, '');
}

function slugToModuleKey(slug: string): string {
  return `./_playground/${slug}.tsx`;
}

function moduleKeyToSlug(key: string): string {
  return key.replace('./_playground/', '').replace('.tsx', '');
}

function slugToLabel(slug: string): string {
  const parts = slug.split('/');
  return parts[parts.length - 1]
    .replace(/-/g, ' ')
    .replace(/^v(\d+)\s/, 'v$1 — ');
}

function slugToCategory(slug: string): string {
  const parts = slug.split('/');
  return parts.length > 1 ? parts[0] : 'uncategorised';
}

// ─── Index ───────────────────────────────────────────────────────────────────

function PlaygroundIndex() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const slugs = Object.keys(modules).map(moduleKeyToSlug).sort();

  const grouped: Record<string, string[]> = {};
  for (const slug of slugs) {
    const cat = slugToCategory(slug);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(slug);
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white px-8 py-12">
      <div className="max-w-2xl mx-auto">
        <a
          href={`${base}/`}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-10 inline-block tracking-widest uppercase"
        >
          ← The Vault
        </a>
        <h1 className="text-3xl font-bold mb-1 tracking-tight">Playground</h1>
        <p className="text-gray-500 text-sm mb-10">Local experiments — not deployed</p>

        {slugs.length === 0 ? (
          <p className="text-gray-600 text-sm">
            No playgrounds yet. Create{' '}
            <code className="text-gray-400">playground/category/v1-name.tsx</code> to get started.
          </p>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, catSlugs]) => (
              <div key={category}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 mb-3">
                  {category}
                </div>
                <ul className="space-y-2">
                  {catSlugs.map(slug => (
                    <li key={slug}>
                      <a
                        href={`${base}/playground/${slug}`}
                        className="group flex items-baseline gap-3 hover:text-white text-gray-300 transition-colors"
                      >
                        <span className="text-sm">{slugToLabel(slug)}</span>
                        <span className="text-[10px] text-gray-600 group-hover:text-gray-500 font-mono transition-colors">
                          /playground/{slug}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Individual playground ────────────────────────────────────────────────────

function PlaygroundPage({ slug }: { slug: string }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const key = slugToModuleKey(slug);
  const loader = modules[key];

  if (!loader) {
    return (
      <div className="min-h-screen bg-[#141414] text-white px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <a
            href={`${base}/playground`}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-10 inline-block tracking-widest uppercase"
          >
            ← Playground
          </a>
          <p className="text-gray-500 text-sm">
            No playground found at <code className="text-gray-400">playground/{slug}.tsx</code>
          </p>
        </div>
      </div>
    );
  }

  const LazyComponent = React.lazy(loader as () => Promise<{ default: React.ComponentType }>);

  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#141414] flex items-center justify-center">
          <div className="text-gray-600 text-sm tracking-widest uppercase">Loading…</div>
        </div>
      }
    >
      <LazyComponent />
    </React.Suspense>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function PlaygroundRouter() {
  const [slug, setSlug] = useState(getRouteSlug);

  useEffect(() => {
    const onPop = () => setSlug(getRouteSlug());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return slug ? <PlaygroundPage slug={slug} /> : <PlaygroundIndex />;
}
