// src/screens/DownfallScreen.tsx
// Terminal crisis screen - displayed when all three support tracks drop below 20%
//
// Shows:
// - Dramatic downfall narrative from API
// - Final support levels (all < 20%)
// - Two options: View Full Report (Aftermath) or Start New Game

import { useMemo } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { bgStyleWithRoleImage } from "../lib/ui";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  push: (path: string) => void;
};

export default function DownfallScreen({ push }: Props) {
  const { current, supportPeople, supportMiddle, supportMom } = useDilemmaStore();
  const { character, roleBackgroundImage, analysis } = useRoleStore();

  const roleBgStyle = useMemo(
    () => bgStyleWithRoleImage(roleBackgroundImage),
    [roleBackgroundImage]
  );

  // Get downfall narrative from current dilemma (set by API when isGameEnd=true)
  const downfallNarrative = current?.description || "Your rule has collapsed under the weight of total opposition. All three pillars of support have crumbled.";

  // Get entity names
  const challengerName = analysis?.challengerSeat?.name || "Power Holders";

  return (
    <div className="min-h-screen px-5 py-8 flex items-center justify-center" style={roleBgStyle}>
      <motion.div
        className="max-w-2xl w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Terminal Crisis Header */}
        <div className="bg-red-900/40 border-2 border-red-500/70 rounded-t-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <AlertTriangle className="w-12 h-12 text-red-300" strokeWidth={2.5} />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold text-red-200">TERMINAL CRISIS</h1>
              <p className="text-red-300 text-sm mt-1">All support has collapsed</p>
            </div>
          </div>
        </div>

        {/* Downfall Narrative */}
        <div className="bg-slate-900/80 border-2 border-red-500/30 border-t-0 p-8 backdrop-blur-sm">
          <p className="text-lg text-gray-200 leading-relaxed whitespace-pre-wrap mb-8">
            {downfallNarrative}
          </p>

          {/* Final Support Levels */}
          <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-red-200 mb-4">Final Support Levels</h2>
            <div className="grid grid-cols-3 gap-4">
              <SupportPill
                label="The People"
                value={supportPeople}
                icon="👥"
              />
              <SupportPill
                label={challengerName}
                value={supportMiddle}
                icon="🏛️"
              />
              <SupportPill
                label="Personal Anchor"
                value={supportMom}
                icon="❤️"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => push("/aftermath")}
              className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-amber-500/50 text-lg"
            >
              View Full Report
            </button>
            <button
              onClick={() => push("/")}
              className="w-full px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-500/50 text-slate-200 font-semibold rounded-xl transition-colors"
            >
              Start New Game
            </button>
          </div>

          {/* Avatar (if available) */}
          {character?.avatarUrl && (
            <div className="mt-8 flex justify-center">
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-red-500/40 opacity-60 grayscale">
                <img
                  src={character.avatarUrl}
                  alt="Fallen Leader"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SupportPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm text-red-300 mb-1 truncate">{label}</div>
      <div className="text-2xl font-bold text-red-200">{value}%</div>
    </div>
  );
}
