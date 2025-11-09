// src/App.tsx
import { useEffect } from "react";
import { fetchAndStoreGameSettings } from "./lib/gameSettings";
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
import GameCappedScreen from "./screens/GameCappedScreen";

if (import.meta.env.DEV) {
  import("./dev/storesDebug").then(m => m.attachStoresDebug());
}

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
  const dataCollectionEnabled = useSettingsStore((s) => s.dataCollectionEnabled);
  const consented = useLoggingStore((s) => s.consented);
  // const [gameStatus, setGameStatus] = useState<GameStatus>('loading');

  console.debug("[App] 📍 Current route:", route);
  console.debug("[App] enableModifiers:", enableModifiers);
  useEnsureMirroredAvatarOnce();

  // Initialize audio manager hook to sync settings with audio playback
  useAudioManager();

  useEffect(() => {
    fetchAndStoreGameSettings();
  }, []);

  // The game status is now checked on "Start Game" button click.

  // Initialize logging service when consented
  useEffect(() => {
    if (consented && dataCollectionEnabled) {
      loggingService.init();
    }
  }, [consented, dataCollectionEnabled]);

  // Handle browser close - flush remaining logs
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dataCollectionEnabled) {
        loggingService.flush(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dataCollectionEnabled]);

  // Render current screen with global audio controls
  return (
    <ErrorBoundary>
      <LanguageProvider>
        {/* RTL direction handler */}
        <RTLHandler />

        {/* App content with loading check */}
        <AppContent route={route} push={push} enableModifiers={enableModifiers} />
      </LanguageProvider>
    </ErrorBoundary>
  );
}

// Separate component to access language context
function AppContent({ route, push, enableModifiers }: { route: string; push: (route: string) => void; enableModifiers: boolean }) {
  const { isLoading } = useLanguage();

  // Global logging hooks (run once at app level for comprehensive coverage)
  useStateChangeLogger(); // Automatically logs all Zustand store changes
  useSessionLogger();     // Automatically logs tab visibility, window blur/focus

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      {/* Global audio controls - visible on all screens */}
      <AudioControls />

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
    </>
  );
}
