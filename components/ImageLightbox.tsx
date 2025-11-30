import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ImageLightboxProps {
  imageUrl?: string;
  images?: string[];
  currentImage?: string;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, images, currentImage, onClose }: ImageLightboxProps) {
  // Support both single image (imageUrl) and array of images
  const imageArray = images || (imageUrl ? [imageUrl] : []);
  const initialIndex = currentImage ? imageArray.indexOf(currentImage) : 0;
  
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex !== -1 ? initialIndex : 0
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation buttons */}
      {imageArray.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image counter */}
      {imageArray.length > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 rounded-full text-sm">
          {currentIndex + 1} / {imageArray.length}
        </div>
      )}

      {/* Main image */}
      <div className="max-w-7xl max-h-[90vh] w-full px-20">
        <ImageWithFallback
          src={imageArray[currentIndex]}
          alt={`Screenshot ${currentIndex + 1}`}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Thumbnail strip */}
      {imageArray.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {imageArray.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`
                w-16 h-10 rounded overflow-hidden transition-all
                ${idx === currentIndex 
                  ? 'ring-2 ring-white scale-110' 
                  : 'ring-1 ring-white/30 opacity-60 hover:opacity-100'
                }
              `}
            >
              <ImageWithFallback
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
