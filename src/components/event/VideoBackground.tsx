import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoBackgroundProps {
  videoPath: string;
  imagePath: string | null;
}

/**
 * Full-screen video background component with fallback to static image.
 *
 * Used during loading overlays to show animated backgrounds. If the video
 * fails to load (e.g., file doesn't exist for this role), gracefully falls
 * back to displaying the static background image.
 *
 * Features:
 * - Autoplay, loop, muted for seamless background playback
 * - Object-fit cover for full-screen scaling
 * - Error handling with automatic fallback to static image
 * - No overlay layers (video displays at full brightness)
 * - Enhanced mobile support with webkit-playsinline and preload
 */
export function VideoBackground({ videoPath, imagePath }: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const playAttemptedRef = useRef(false);

  // Attempt to play the video with fallback handling
  const attemptPlay = useCallback(() => {
    if (!videoRef.current || playAttemptedRef.current) return;
    playAttemptedRef.current = true;

    // Set playback speed to half (0.5x)
    videoRef.current.playbackRate = 0.5;

    videoRef.current.play().catch(() => {
      // If autoplay fails (e.g., browser policy), ensure muted and try again
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {
          setHasError(true);
        });
      }
    });
  }, []);

  useEffect(() => {
    // Reset state when video path changes
    setHasError(false);
    playAttemptedRef.current = false;

    // If video is already ready (cached), play immediately
    if (videoRef.current && videoRef.current.readyState >= 3) {
      attemptPlay();
    }
    // Otherwise, onCanPlay handler will trigger playback
  }, [videoPath, attemptPlay]);

  // If video failed to load or video path doesn't exist, show static image
  if (hasError || !videoPath) {
    return (
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: imagePath ? `url(${imagePath})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  return (
    <>
      {/* Video background */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        webkit-playsinline=""
        preload="auto"
        onCanPlay={attemptPlay}
        onError={() => setHasError(true)}
        className="fixed inset-0 z-0 w-full h-full object-cover"
        style={{ objectFit: 'cover' }}
      >
        <source src={videoPath} type="video/mp4" />
        {/* Fallback for browsers that don't support video */}
        Your browser does not support video playback.
      </video>

      {/* Fallback image loaded in background (hidden unless video fails) */}
      {imagePath && (
        <div
          className="fixed inset-0 z-0 hidden"
          style={{
            backgroundImage: `url(${imagePath})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
    </>
  );
}
