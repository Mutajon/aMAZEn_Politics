
// src/screens/GameCappedScreen.tsx
import React from 'react';

const GameCappedScreen: React.FC<{ push: (route: string) => void }> = ({ push }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="text-center p-8 bg-slate-800/50 rounded-lg shadow-lg max-w-md">
        <h1 className="text-4xl font-bold mb-4">Game Temporarily Unavailable</h1>
        <p className="text-lg mb-2">
          We're thrilled with the overwhelming response! We've reached our current player limit for this beta phase.
        </p>
        <p className="text-md text-slate-300 mb-6">
          Please check back later. Thank you for your interest in Amaze Politics.
        </p>
        <button
          onClick={() => push('/')}
          className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
        >
          Back to Main Screen
        </button>
      </div>
    </div>
  );
};

export default GameCappedScreen;
