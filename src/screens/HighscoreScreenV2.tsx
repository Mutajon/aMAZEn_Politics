import { useState } from "react";
import { bgStyleSplash } from "../lib/ui";
import { useLang } from "../i18n/lang";
import { useLoggingStore } from "../store/loggingStore";
import LeaderPopup from "../components/LeaderPopup";
import { HighscoreTable } from "../components/highscore/HighscoreTable";
import { useGlobalHighscores } from "../hooks/useGlobalHighscores";
import { useUserHighscores } from "../hooks/useUserHighscores";
import type { HighscoreEntry } from "../data/highscores-default";

type TabType = "global" | "local";

export default function HighscoreScreenV2() {
  const lang = useLang();
  const userId = useLoggingStore((s) => s.userId);
  const [activeTab, setActiveTab] = useState<TabType>("global");
  const [selected, setSelected] = useState<HighscoreEntry | null>(null);
  
  // Fetch data based on active tab
  const {
    entries: globalEntries,
    loading: globalLoading,
    error: globalError,
  } = useGlobalHighscores();
  
  const {
    entries: userEntries,
    loading: userLoading,
    error: userError,
    bestScore,
  } = useUserHighscores(userId || "");
  
  const entries = activeTab === "global" ? globalEntries : userEntries;
  const loading = activeTab === "global" ? globalLoading : userLoading;
  const error = activeTab === "global" ? globalError : userError;
  
  return (
    <div className="min-h-[100dvh] px-3 py-6 md:px-5 md:py-8" style={bgStyleSplash}>
      <div className="w-full max-w-5xl mx-auto">
        {/* Header with Tabs */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              {lang("HIGHSCORE_TITLE")}
            </h1>
            <button
              onClick={() => window.history.back()}
              className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-sm"
            >
              {lang("HIGHSCORE_BACK")}
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("global")}
              className={[
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "global"
                  ? "bg-amber-500/20 text-amber-300 shadow-lg"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              ].join(" ")}
            >
              🌍 {lang("HIGHSCORE_TAB_GLOBAL")}
            </button>
            <button
              onClick={() => setActiveTab("local")}
              className={[
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "local"
                  ? "bg-amber-500/20 text-amber-300 shadow-lg"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              ].join(" ")}
            >
              👤 {lang("HIGHSCORE_TAB_LOCAL")}
            </button>
          </div>
          
          {/* Subtitle */}
          <p className="text-white/60 text-xs md:text-sm mt-2">
            {activeTab === "global" 
              ? lang("HIGHSCORE_SUBTITLE_GLOBAL")
              : lang("HIGHSCORE_SUBTITLE_LOCAL")}
          </p>
          
          {/* Local tab: Show personal best */}
          {activeTab === "local" && bestScore > 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-300 text-sm">
                🏆 {lang("HIGHSCORE_YOUR_BEST")}: <strong>{bestScore.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <HighscoreTable
          entries={entries}
          loading={loading}
          error={error}
          onSelect={setSelected}
          emptyMessage={
            activeTab === "local"
              ? lang("HIGHSCORE_NO_LOCAL_SCORES")
              : lang("HIGHSCORE_NO_GLOBAL_SCORES")
          }
        />
      </div>

      {/* Popup */}
      <LeaderPopup entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
