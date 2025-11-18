// src/components/roleSelection/RoleCarouselContent.tsx
// Main carousel content with background image transitions
//
// Features:
// - Fullscreen background image display with bobbing animation
// - Crossfade transitions between items
// - Locked role visual treatment (blur + dark overlay)
// - Touch gesture support for swipe navigation
// - roleSelectionBKG.png overlay layer
// - Aggressive image preloading for smooth transitions

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CarouselItem } from "../../hooks/useRoleCarousel";

interface RoleCarouselContentProps {
  currentItem: CarouselItem;
  currentIndex: number;
  carouselItems: CarouselItem[];
  direction: 'left' | 'right';
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

// Direction-aware slide variants
const slideVariants = {
  enterFromRight: {
    x: '100%',
    opacity: 0,
  },
  enterFromLeft: {
    x: '-100%',
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exitToLeft: {
    x: '-100%',
    opacity: 0,
  },
  exitToRight: {
    x: '100%',
    opacity: 0,
  },
};

export default function RoleCarouselContent({
  currentItem,
  currentIndex,
  carouselItems,
  direction,
  touchHandlers,
}: RoleCarouselContentProps) {
  // Calculate adjacent items for preloading (with looping)
  const prevIndex = currentIndex - 1 < 0 ? carouselItems.length - 1 : currentIndex - 1;
  const nextIndex = currentIndex + 1 >= carouselItems.length ? 0 : currentIndex + 1;
  const prevImage = carouselItems[prevIndex]?.backgroundImage;
  const nextImage = carouselItems[nextIndex]?.backgroundImage;

  // Aggressive JavaScript-based image preloading
  useEffect(() => {
    const preloadImage = (src: string) => {
      const img = new Image();
      img.src = src;
    };

    if (prevImage) preloadImage(prevImage);
    if (nextImage) preloadImage(nextImage);
  }, [prevImage, nextImage]);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      {...touchHandlers}
    >
      {/* Background Image Layer with Transitions */}
      <AnimatePresence initial={false}>
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.4,
            ease: 'easeInOut',
          }}
          className="absolute inset-0"
        >
          {/* Role Background Image with bobbing animation - positioned 100px higher */}
          <motion.img
            src={currentItem.backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: 'center 40%', // Position higher on screen
            }}
            animate={{
              y: [-10, 10, -10], // 20px total range bobbing animation
            }}
            transition={{
              y: {
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
          />

          {/* Locked Role Overlay */}
          {currentItem.isLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="absolute inset-0"
            >
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/60" />

              {/* Blur effect */}
              <div
                className="absolute inset-0 backdrop-blur-sm"
                style={{
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                }}
              />

              {/* Lock icon with pulse animation - positioned below top indicator */}
              <div className="absolute inset-0 flex items-start justify-center pt-32 sm:pt-40 md:pt-48">
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="text-6xl sm:text-8xl md:text-9xl drop-shadow-2xl"
                >
                  🔒
                </motion.div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* roleSelectionBKG.png Overlay Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: 'url(/assets/images/BKGs/roleSelectionBKG.png)',
          opacity: 0.9,
        }}
      />

      {/* Gradient overlays for depth (matching original bgStyleRoleSelection) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.3))
          `,
        }}
      />

      {/* Hidden image preloader - prevents white flash during transitions */}
      <div className="hidden" aria-hidden="true">
        {prevImage && <img src={prevImage} alt="" />}
        {nextImage && <img src={nextImage} alt="" />}
      </div>
    </div>
  );
}
