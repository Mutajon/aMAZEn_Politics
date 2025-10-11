// src/screens/FinalScoreScreen.tsx
// Final score screen placeholder
//
// Currently blank - future enhancement for final score calculation and display
// Will show comprehensive game stats, achievements, and final ranking
//
// Connects to:
// - src/screens/AftermathScreen.tsx: navigated from via "Reveal Final Score" button

import { bgStyle } from "../lib/ui";

export default function FinalScoreScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={bgStyle}>
      <div className="text-center">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-4">
          Final Score
        </h1>
        <p className="text-white/70 text-lg">
          (Coming Soon)
        </p>
      </div>
    </div>
  );
}
