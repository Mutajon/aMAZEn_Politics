// src/App.tsx
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fetchAndStoreGameSettings, loadGameSettingsFromLocalStorage } from "./lib/gameSettings";
import { initSentry } from "./lib/sentry";

// Initialize Sentry error monitoring FIRST (before any other code runs)
initSentry();

// Load game settings from localStorage IMMEDIATELY before any components render
// This ensures settings are available before Zustand persist loads old values
loadGameSettingsFromLocalStorage();
import MiniCompassDebugScreen from "./screens/MiniCompassDebugScreen";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";

import { useHashRoute } from "./lib/router";
import SplashScreen from "./screens/SplashScreen";
import BackstageScreen from "./screens/BackstageScreen";
// import CompassIntro from "./screens/CompassIntro"; // (legacy monolith – no longer used)
import IntroScreen from "./screens/IntroScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import CampaignScreen from "./screens/CampaignScreen";
import PowerDistributionScreen from "./screens/PowerDistributionScreen";
import NameScreen from "./screens/NameScreen";
import CompassVisScreen from "./screens/CompassVisScreen";
import CompassIntroStart from "./screens/CompassIntroStart";
import MirrorDialogueScreen from "./screens/MirrorDialogueScreen";
import MirrorQuizScreen from "./screens/MirrorQuizScreen";
import BackgroundIntroScreen from "./screens/BackgroundIntroScreen";
import DifficultyScreen from "./screens/DifficultyScreen";
import GoalsSelectionScreen from "./screens/GoalsSelectionScreen";
import { useEnsureMirroredAvatarOnce } from "./hooks/useEnsureMirroredAvatarOnce";
import EventScreen3 from "./screens/EventScreen3";
import HighscoreScreen from "./screens/HighscoreScreen";
import AchievementsScreen from "./screens/AchievementsScreen";
import MirrorScreen from "./screens/MirrorScreen";
import AftermathScreen from "./screens/AftermathScreen";
import FinalScoreScreen from "./screens/FinalScoreScreen";
import DownfallScreen from "./screens/DownfallScreen";
import AudioControls from "./components/AudioControls";
import { useAudioManager } from "./hooks/useAudioManager";
import { useSettingsStore } from "./store/settingsStore";
import { useLoggingStore } from "./store/loggingStore";
import { loggingService } from "./lib/loggingService";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useStateChangeLogger } from "./hooks/useStateChangeLogger";
import { useSessionLogger } from "./hooks/useSessionLogger";
import { usePartialSummaryLogger } from "./hooks/usePartialSummaryLogger";
import GameCappedScreen from "./screens/GameCappedScreen";
import { AnimatePresence, motion } from "framer-motion";

if (import.meta.env.DEV) {
  import("./dev/storesDebug").then(m => m.attachStoresDebug());
}


// Create a QueryClient instance for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      // Prevent duplicate mutations
      retry: false,
    },
    queries: {
      // Prevent duplicate queries
      retry: false,
      staleTime: 0,
      gcTime: 0, // Don't cache mutations
    },
  },
});

// Component to handle RTL direction based on language
function RTLHandler() {
  const { language } = useLanguage();

  useEffect(() => {
    const htmlElement = document.documentElement;
    
    // Update lang attribute
    htmlElement.setAttribute('lang', language);
    
    // Update dir attribute for RTL support
    if (language === 'he') {
      htmlElement.setAttribute('dir', 'rtl');
    } else {
      // Remove dir attribute for LTR languages (default)
      htmlElement.removeAttribute('dir');
    }
  }, [language]);

  return null; // This component doesn't render anything
}

// Loading screen while translations are loading
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white/80">Loading...</p>
      </div>
    </div>
  );
}



export default function App() {
  const { route, push } = useHashRoute();
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const debugMode = useSettingsStore((s) => s.debugMode);
  const consented = useLoggingStore((s) => s.consented);
  // const [gameStatus, setGameStatus] = useState<GameStatus>('loading');

  console.debug("[App] 📍 Current route:", route);
  console.debug("[App] enableModifiers:", enableModifiers);
  useEnsureMirroredAvatarOnce();

  // Initialize audio manager hook to sync settings with audio playback
  useAudioManager();

  // Load settings from localStorage immediately (before API call completes)
  // This ensures settings are available right away, then API will update them if available
  useEffect(() => {
    loadGameSettingsFromLocalStorage();
    // Then fetch fresh settings from API (will override localStorage if successful)
    fetchAndStoreGameSettings();
  }, []);

  // The game status is now checked on "Start Game" button click.

  // Initialize logging service when consented (unless debug mode)
  useEffect(() => {
    if (consented && !debugMode) {
      loggingService.init();
    }
  }, [consented, debugMode]);

  // Handle browser close - flush remaining logs (unless debug mode)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!debugMode) {
        loggingService.flush(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [debugMode]);

  // Render current screen with global audio controls
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          {/* RTL direction handler */}
          <RTLHandler />

          {/* App content with loading check */}
          <AppContent route={route} push={push} enableModifiers={enableModifiers} />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Separate component to access language context
function AppContent({ route, push, enableModifiers }: { route: string; push: (route: string) => void; enableModifiers: boolean }) {
  const { isLoading } = useLanguage();

  // Global logging hooks (run once at app level for comprehensive coverage)
  useStateChangeLogger(); // Automatically logs all Zustand store changes
  useSessionLogger();     // Automatically logs tab visibility, window blur/focus
  usePartialSummaryLogger(); // Logs partial summary if user closes tab mid-game

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Animation variants for smooth screen transitions
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const pageTransition = {
    duration: 0.3,
    ease: "easeInOut"
  };

  return (
    <>
      {/* Global audio controls - visible on all screens */}
      <AudioControls />

      {/* AnimatePresence for smooth screen crossfade transitions */}
      <AnimatePresence initial={false}>
        <motion.div
          key={route}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
          className="absolute inset-0 min-h-screen bg-black"
          style={{ width: '100%', height: '100%' }}
        >
          {route === "/intro" && <IntroScreen push={push} />}
          {route === "/role" && <RoleSelectionScreen push={push} />}
          {route === "/campaign" && <CampaignScreen />}
          {route === "/power" && <PowerDistributionScreen push={push} />}
          {enableModifiers && route === "/difficulty" && <DifficultyScreen push={push} />}

          {/* NEW split screens */}
          {route === "/compass-intro" && (() => {
            console.log("[App] 🎯 Rendering CompassIntroStart");
            return <CompassIntroStart push={push} />;
          })()}
          {route === "/compass-mirror" && <MirrorDialogueScreen push={push} />}
          {route === "/compass-quiz" && <MirrorQuizScreen push={push} />}

          {route === "/name" && <NameScreen push={push} />}
          {route === "/compass-vis" && <CompassVisScreen />}
          {route === "/mirror" && <MirrorScreen push={push} />}
          {route === "/debug-mini" && <MiniCompassDebugScreen push={push} />}
          {route === "/background-intro" && <BackgroundIntroScreen push={push} />}
          {enableModifiers && route === "/goals" && (() => {
            console.log("[App] 🎯 Rendering GoalsSelectionScreen");
            return <GoalsSelectionScreen push={push} />;
          })()}
          {route === "/event" && <EventScreen3 push={push} />}
          {route === "/downfall" && <DownfallScreen push={push} />}
          {route.startsWith("/highscores") && <HighscoreScreen />}
          {route === "/achievements" && <AchievementsScreen />}
          {route === "/aftermath" && <AftermathScreen push={push} />}
          {route === "/final-score" && <FinalScoreScreen push={push} />}
          {route === "/capped" && <GameCappedScreen push={push} />}

          {/* Backstage route - Development mode (bypasses experiments) */}
          {route === "/backstage" && (
            <BackstageScreen
              onStart={() => push("/intro")}
              onHighscores={() => push("/highscores")}
              onAchievements={() => push("/achievements")}
            />
          )}

          {/* Default route - SplashScreen */}
          {route === "/" && (
            <SplashScreen
              onStart={() => push("/intro")}
              onHighscores={() => push("/highscores")}
              onAchievements={() => push("/achievements")}
              push={push}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
