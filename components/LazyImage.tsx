import { useState } from 'react';

interface LazyImageProps {
  src: string | null;
  alt: string;
  className?: string;
  placeholderColor?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * The browser's own lazy loading, with a colour placeholder that fades out
 * once the image arrives.
 *
 * This used to give every image its own IntersectionObserver (never
 * disconnected) plus a `new Image()` preload before setting `src` — 1,100+
 * observers on Browse, each re-checked on every scroll. `loading="lazy"` does
 * the same job natively and starts further ahead of the viewport.
 */
export function LazyImage({
  src,
  alt,
  className = '',
  placeholderColor = 'bg-gray-800',
  onClick,
  style
}: LazyImageProps) {
  // Keyed by src, so a changed src fades in again without an effect to reset it.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = src !== null && loadedSrc === src;

  return (
    <div
      className={`relative ${className}`}
      onClick={onClick}
    >
      {/* Placeholder. No backdrop-filter: this is an opaque fill, so there is
          nothing behind it to blur — it only cost a filter pass per image. */}
      <div
        className={`absolute inset-0 ${placeholderColor} transition-opacity duration-500 ${
          loaded ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Actual image with fade-in. No translateZ(0) or will-change: either
          one pins every card image to its own compositor layer for good —
          over a thousand layers on Browse — for a 500ms fade the browser
          composites on its own while it runs. */}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={style}
        />
      )}
    </div>
  );
}
