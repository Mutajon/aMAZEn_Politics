// src/screens/AftermathScreen.tsx
// Aftermath screen showing game epilogue after final day
//
// Shows:
// - AI-generated intro and remembrance
// - Decision breakdown (autonomy/liberalism analysis)
// - Rating pills (Liberalism/Autonomy)
// - Top compass values and summary
// - Player portrait + tombstone + haiku
// - "Reveal Final Score" button
//
// Connects to:
// - src/hooks/useAftermathData.ts: fetches data from API
// - server/index.mjs: POST /api/aftermath
// - src/screens/FinalScoreScreen.tsx: navigates to final score

import { useEffect, useState } from "react";
import { useAftermathData } from "../hooks/useAftermathData";
import { useRoleStore } from "../store/roleStore";
import { useLoadingProgress } from "../hooks/useLoadingProgress";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import { bgStyle } from "../lib/ui";
import { PALETTE, type PropKey } from "../data/compass-data";
import type { PushFn } from "../lib/router";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import {
  saveAftermathReturnRoute,
  loadAftermathScreenSnapshot,
  saveAftermathScreenSnapshot,
  clearAftermathScreenSnapshot
} from "../lib/eventScreenSnapshot";

type Props = {
  push: PushFn;
};

/** Get color for rating level */
function getRatingColor(level: string): string {
  switch (level) {
    case "very-high": return "#10b981"; // green
    case "high": return "#84cc16"; // light green
    case "medium": return "#eab308"; // yellow
    case "low": return "#f97316"; // orange
    case "very-low": return "#ef4444"; // red
    default: return "#6b7280"; // gray
  }
}

/** Format rating text */
function formatRating(level: string): string {
  return level
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AftermathScreen({ push }: Props) {
  const { loading, error, data, fetchAftermathData, restoreData } = useAftermathData();
  const { character } = useRoleStore();
  const { progress, start: startProgress, notifyReady } = useLoadingProgress();
  const top3ByDimension = useMirrorTop3();
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);

  // ========================================================================
  // EFFECT 0A: RESTORATION FROM SNAPSHOT (on mount)
  // ========================================================================
  useEffect(() => {
    const snapshot = loadAftermathScreenSnapshot();
    if (snapshot) {
      console.log('[AftermathScreen] 🔄 Restoring from snapshot');
      restoreData(snapshot.data);
      setRestoredFromSnapshot(true);
      // Clear snapshot after successful restoration
      clearAftermathScreenSnapshot();
    }
  }, [restoreData]);

  // Fetch data on mount (only if not restored)
  useEffect(() => {
    if (!restoredFromSnapshot && !data) {
      startProgress(); // Start progress animation
      fetchAftermathData();
    }
  }, [fetchAftermathData, startProgress, restoredFromSnapshot, data]);

  // Notify progress when data ready (only if not restored)
  useEffect(() => {
    if (data && !restoredFromSnapshot) {
      notifyReady();
    }
  }, [data, notifyReady, restoredFromSnapshot]);

  // ========================================================================
  // RENDER: Loading State
  // ========================================================================
  if (loading && !data && !restoredFromSnapshot) {
    return (
      <CollectorLoadingOverlay
        progress={progress}
        message="Aftermath pending..."
      />
    );
  }

  // ========================================================================
  // RENDER: Error State
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bgStyle}>
        <div className="max-w-md w-full bg-red-900/20 border border-red-500/50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Aftermath</h2>
          <p className="text-white/80 mb-4">{error}</p>
          <button
            onClick={() => {
              startProgress();
              fetchAftermathData();
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER: Main Content
  // ========================================================================
  if (!data) {
    return null; // Should not happen
  }

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-3xl mx-auto space-y-6">

        {/* Title: "Your time has passed..." */}
        <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-8">
          Your time has passed...
        </h1>

        {/* Intro Section */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <p className="text-white/90 text-lg leading-relaxed">
            {data.intro}
          </p>
        </div>

        {/* "You are remembered as" Section */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-amber-400 mb-4">
            You are remembered as
          </h2>
          <div className="flex gap-6 items-start">
            {/* Left: Portrait + Rank */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              {character?.avatarUrl && (
                <img
                  src={character.avatarUrl}
                  alt="Player portrait"
                  className="w-[160px] h-[160px] rounded-lg object-cover border border-white/20"
                  onError={(e) => {
                    // Hide on error
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="px-3 py-1 rounded-md bg-amber-900/30 border border-amber-500/30">
                <p className="text-amber-300 text-sm font-semibold text-center">
                  {data.rank}
                </p>
              </div>
            </div>

            {/* Right: Remembrance Text */}
            <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap flex-1">
              {data.remembrance}
            </p>
          </div>
        </div>

        {/* Decision Breakdown Section */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-amber-400 mb-4">
            Decision breakdown
          </h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {data.decisions.map((decision, i) => (
              <div
                key={i}
                className="border-b border-white/5 last:border-b-0 pb-3 last:pb-0"
              >
                <p className="text-white/95 font-semibold mb-1">
                  {decision.title}
                </p>
                <p className="text-white/70 text-sm">
                  {decision.reflection}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rating Pills Section */}
        <div className="flex gap-4 justify-center">
          {/* Liberalism Pill */}
          <div
            className="px-4 py-2 rounded-lg font-semibold uppercase text-sm tracking-wide"
            style={{
              backgroundColor: `${getRatingColor(data.ratings.liberalism)}20`,
              borderColor: getRatingColor(data.ratings.liberalism),
              borderWidth: "1px",
              color: getRatingColor(data.ratings.liberalism)
            }}
          >
            Liberalism: {formatRating(data.ratings.liberalism)}
          </div>

          {/* Autonomy Pill */}
          <div
            className="px-4 py-2 rounded-lg font-semibold uppercase text-sm tracking-wide"
            style={{
              backgroundColor: `${getRatingColor(data.ratings.autonomy)}20`,
              borderColor: getRatingColor(data.ratings.autonomy),
              borderWidth: "1px",
              color: getRatingColor(data.ratings.autonomy)
            }}
          >
            Autonomy: {formatRating(data.ratings.autonomy)}
          </div>
        </div>

        {/* Reflection Section (Compass Values + Summary) */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative">
          <h2 className="text-xl font-bold text-amber-400 mb-4">
            Reflection
          </h2>

          {/* Compass Value Pills - Show top value per dimension */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {(["what", "whence", "how", "whither"] as PropKey[]).map(dimension => {
              const dimensionName = {
                what: "WHAT",
                whence: "WHENCE",
                how: "HOW",
                whither: "WHITHER"
              }[dimension];

              // Get top value for this dimension
              const topValue = top3ByDimension[dimension]?.[0];

              return (
                <div
                  key={dimension}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: `${PALETTE[dimension].base}20`,
                    borderColor: PALETTE[dimension].base,
                    borderWidth: "1px"
                  }}
                >
                  <div
                    className="font-bold uppercase text-xs mb-1"
                    style={{ color: PALETTE[dimension].base }}
                  >
                    {dimensionName}:
                  </div>
                  <div
                    className="text-white/90 font-medium"
                  >
                    {topValue?.short || "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Values Summary */}
          <p className="text-white/80 text-base leading-relaxed">
            {data.valuesSummary}
          </p>

          {/* Explore Values Button - Bottom Right Corner */}
          <button
            onClick={() => {
              // Save snapshot before navigating
              if (data) {
                saveAftermathScreenSnapshot({
                  data,
                  timestamp: Date.now()
                });
              }
              // Save return route
              saveAftermathReturnRoute('/aftermath');
              push('/mirror');
            }}
            className="absolute bottom-4 right-4 px-3 py-2 bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🔍</span>
            <span>Explore Values</span>
          </button>
        </div>

        {/* Tombstone Visual Section */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="relative max-w-[300px] mx-auto">
            <img
              src="/assets/images/tombStone.png"
              alt="Tombstone"
              className="w-full opacity-80"
            />
            {/* Haiku Overlay */}
            <div className="absolute inset-0 flex items-center justify-center px-12">
              <p
                className="text-amber-300 text-center font-serif italic text-sm whitespace-pre-line max-w-[200px]"
                style={{
                  textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)"
                }}
              >
                {data.haiku}
              </p>
            </div>
          </div>
        </div>

        {/* Reveal Final Score Button */}
        <div className="pt-4">
          <button
            onClick={() => push("/final-score")}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-amber-500/50"
          >
            Reveal final score
          </button>
        </div>

      </div>
    </div>
  );
}
