/**
 * Theme configuration for the Gatekeeper tutorial component
 * Defines colors, sizing, and SVG tail path for the speech bubble
 */

export const gatekeeperTheme = {
  // Colors
  bubbleBackground: 'linear-gradient(135deg, #4C1D95, #5B21B6)', // Dark purple gradient
  textColor: '#DDD6FE', // Light purple
  shadow: '0 12px 32px rgba(76, 29, 149, 0.4)', // Purple glow

  // Typography
  fontFamily: 'Inter, ui-sans-serif, system-ui',
  fontSizePx: 18,
  lineHeight: 1.6,

  // Spacing
  paddingX: 20,
  paddingY: 16,

  // Border radius
  borderRadius: 16,

  // Sizing
  maxWidth: 380, // Max width of speech bubble in px
  imageWidth: 140, // Width of Gatekeeper image in px

  // Positioning (from bottom-right corner)
  bottomOffset: 24,
  rightOffset: 24,

  // Animation timing
  typingSpeedMs: 25, // Milliseconds per character
  bobbingDuration: 3.5, // Seconds for bubble bobbing cycle
  floatDuration: 4, // Seconds for image float cycle
  bobbingDistance: 8, // Pixels to bob up/down
  floatDistance: 5, // Pixels to float up/down

  // SVG tail pointing down-left from bubble to image
  tailPath: 'M 20 100 Q 15 85, 5 75 Q 0 70, 5 65 L 25 95 Z',
  tailWidth: 30,
  tailHeight: 35,
};
