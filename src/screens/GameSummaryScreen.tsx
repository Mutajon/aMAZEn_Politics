// src/screens/GameSummaryScreen.tsx
// Displays a summary of all 7 choices made during the game
//
// Shows: Character info, final stats, and list of all decisions
// Used by: EventScreen3 (post-game button), App router (/summary)
// Dependencies: dilemmaStore, roleStore

import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { DollarSign, Users, Building2, Heart } from "lucide-react";

export default function GameSummaryScreen({ push }: { push: PushFn }) {
  const {
    dilemmaHistory,
    supportPeople,
    supportMiddle,
    supportMom,
    budget,
  } = useDilemmaStore();

  const { role, systemName, character } = useRoleStore();

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2">
            Your 7-Day Term Summary
          </h1>
          <p className="text-slate-400 text-sm">
            {character?.name || "Leader"} · {role || "Unknown"} · {systemName || "Unknown"}
          </p>
        </div>

        {/* Final Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Budget</span>
            </div>
            <p className="text-2xl font-bold text-white">${budget}M</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">People</span>
            </div>
            <p className="text-2xl font-bold text-white">{supportPeople}%</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Power</span>
            </div>
            <p className="text-2xl font-bold text-white">{supportMiddle}%</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Allies</span>
            </div>
            <p className="text-2xl font-bold text-white">{supportMom}%</p>
          </div>
        </div>

        {/* Choices List */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-amber-400 mb-4">Your Decisions</h2>

          {dilemmaHistory.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No decisions recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {dilemmaHistory.map((entry) => (
                <div
                  key={entry.day}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-amber-600/30 transition-colors"
                >
                  {/* Day Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
                          Day {entry.day}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-200 mb-1">
                        {entry.dilemmaTitle}
                      </h3>
                      <p className="text-sm text-slate-400 mb-2">
                        {entry.dilemmaDescription}
                      </p>
                    </div>
                  </div>

                  {/* Choice */}
                  <div className="border-l-4 border-amber-600/50 pl-3 mt-2">
                    <p className="text-sm font-semibold text-amber-300 mb-1">
                      Your choice: {entry.choiceTitle}
                    </p>
                    <p className="text-sm text-slate-300 mb-2">
                      {entry.choiceSummary}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <span
                        className={`font-medium ${
                          entry.cost >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        Budget: {entry.cost >= 0 ? "+" : ""}${entry.cost}M
                      </span>
                      <span className="text-slate-500">
                        Support: {entry.supportPeople}% / {entry.supportMiddle}% / {entry.supportMom}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => push('/highscores')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            View Hall of Fame
          </button>
          <button
            onClick={() => push('/')}
            className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg transition-all duration-200"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
