import { useState, useEffect, useRef } from 'react';

interface UseLazyImageOptions {
  src: string | null;
  rootMargin?: string;
  threshold?: number;
}

export function useLazyImage({ src, rootMargin = '200px', threshold = 0.01 }: UseLazyImageOptions) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, rootMargin, threshold]);

  useEffect(() => {
    if (!isInView || !src) return;

    setIsLoading(true);
    const img = new Image();

    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src]);

  return { imgRef, imageSrc, isLoading, isInView };
}
