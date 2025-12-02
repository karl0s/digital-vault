/**
 * Color extraction utility for extracting dominant colors from images
 * Uses canvas API to sample pixels and k-means clustering for color analysis
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}
 
/**
 * Calculate color distance in RGB space
 */
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Simple k-means clustering for color quantization
 */
function kMeansClustering(pixels: RGB[], k: number, maxIterations = 10): RGB[] {
  if (pixels.length === 0) return [];
  
  // Initialize centroids randomly from pixels
  let centroids: RGB[] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push({ ...pixels[i * step] });
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign pixels to nearest centroid
    const clusters: RGB[][] = Array.from({ length: k }, () => []);
    
    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestIndex = 0;
      
      for (let i = 0; i < k; i++) {
        const dist = colorDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestIndex = i;
        }
      }
      
      clusters[nearestIndex].push(pixel);
    }

    // Update centroids
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      
      const newCentroid = {
        r: clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length,
        g: clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length,
        b: clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length,
      };
      
      if (colorDistance(centroids[i], newCentroid) > 1) {
        changed = true;
      }
      
      centroids[i] = newCentroid;
    }

    if (!changed) break;
  }

  return centroids;
}

/**
 * Calculate color saturation
 */
function getSaturation(rgb: RGB): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Extract dominant colors from an image
 * @param imageUrl - URL of the image to analyze
 * @param colorCount - Number of dominant colors to extract (default: 4)
 * @returns Promise with array of hex color strings
 */
export async function extractColorsFromImage(
  imageUrl: string,
  colorCount: number = 4
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for external images
    
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Resize for performance (sample smaller version)
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels: RGB[] = [];

        // Sample pixels (every 4th pixel for performance)
        for (let i = 0; i < imageData.data.length; i += 16) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];

          // Skip transparent and very dark/light pixels
          if (a < 125) continue;
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 240) continue;

          // Skip low saturation (grayscale) pixels
          const saturation = getSaturation({ r, g, b });
          if (saturation < 0.2) continue;

          pixels.push({ r, g, b });
        }

        if (pixels.length === 0) {
          // Fallback to default colors if no valid pixels found
          resolve(['#dd7bbb', '#d79f1e', '#5a922c', '#4c7894']);
          return;
        }

        // Use k-means to find dominant colors
        const dominantColors = kMeansClustering(pixels, colorCount);

        // Sort by saturation (most vibrant first)
        dominantColors.sort((a, b) => getSaturation(b) - getSaturation(a));

        // Convert to hex
        const hexColors = dominantColors.map(rgbToHex);

        resolve(hexColors);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      // Fallback to default colors on error
      resolve(['#dd7bbb', '#d79f1e', '#5a922c', '#4c7894']);
    };

    img.src = imageUrl;
  });
}

/**
 * Cache for extracted colors to avoid re-processing
 */
const colorCache = new Map<string, string[]>();

/**
 * Extract colors with caching
 */
export async function extractColorsWithCache(
  imageUrl: string,
  colorCount: number = 4
): Promise<string[]> {
  const cacheKey = `${imageUrl}_${colorCount}`;
  
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!;
  }

  const colors = await extractColorsFromImage(imageUrl, colorCount);
  colorCache.set(cacheKey, colors);
  
  return colors;
}
