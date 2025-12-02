/**
 * Avatar Thumbnail Generator
 * 
 * Generates optimized thumbnails for storage in MongoDB:
 * - Resizes to 64x64px (perfect for leaderboard display)
 * - Converts to WebP format (30% smaller than JPEG)
 * - Compresses with quality=70 (balances size vs quality)
 * - Result: ~5-10KB per avatar (vs 50-100KB full size)
 */

/**
 * Generate a compressed thumbnail from a base64 image
 * 
 * @param base64Image - Full-size base64 image (data:image/...)
 * @param size - Thumbnail size in pixels (default: 64x64)
 * @param quality - WebP quality 0-1 (default: 0.7)
 * @returns Promise<string> - Compressed base64 WebP thumbnail (~5-10KB)
 */
export async function generateAvatarThumbnail(
  base64Image: string,
  size: number = 64,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create an image element
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create a canvas with thumbnail dimensions
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, size, size);
        
        // Convert to WebP with compression
        // Note: canvas.toBlob() is void - it calls the callback with the blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              console.log(`[AvatarThumbnail] Generated thumbnail: ${(result.length / 1024).toFixed(1)}KB`);
              resolve(result);
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          },
          'image/webp',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Start loading the image
    img.src = base64Image;
  });
}

/**
 * Check if browser supports WebP
 * (All modern browsers do, but good to check)
 */
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext || !canvas.getContext('2d')) {
    return false;
  }
  
  // Check if toDataURL supports webp
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Estimate thumbnail size in KB
 */
export function estimateThumbnailSize(base64: string): number {
  // Remove data URL prefix to get actual base64 string
  const base64Data = base64.split(',')[1] || base64;
  // Base64 encoding increases size by ~33%, so divide by 1.33 to get actual bytes
  const bytes = (base64Data.length * 3) / 4;
  return bytes / 1024; // Convert to KB
}
