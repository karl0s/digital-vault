import { useLazyImage } from './hooks/useLazyImage';

interface LazyImageProps {
  src: string | null;
  alt: string;
  className?: string;
  placeholderColor?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function LazyImage({ 
  src, 
  alt, 
  className = '', 
  placeholderColor = 'bg-gray-800',
  onClick,
  style 
}: LazyImageProps) {
  const { imgRef, imageSrc, isLoading } = useLazyImage({ 
    src, 
    rootMargin: '400px' // Start loading when image is 400px away from viewport
  });

  return (
    <div 
      ref={imgRef} 
      className={`relative ${className}`}
      onClick={onClick}
    >
      {/* Placeholder. No backdrop-filter: this is an opaque fill, so there is
          nothing behind it to blur — it only cost a filter pass per image. */}
      <div
        className={`absolute inset-0 ${placeholderColor} transition-opacity duration-500 ${
          imageSrc && !isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Actual image with fade-in */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            // translateZ(0) already promotes this to its own layer for the
            // fade. No `will-change: opacity`: it made the promotion permanent
            // on every card image — hundreds of live layers for a 500ms fade
            // that has already finished.
            transform: 'translateZ(0)',
            ...style
          }}
        />
      )}
    </div>
  );
}
