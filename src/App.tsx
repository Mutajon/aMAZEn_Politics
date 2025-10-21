// src/App.tsx
import { useEffect } from "react";
import MiniCompassDebugScreen from "./screens/MiniCompassDebugScreen";

import { useHashRoute } from "./lib/router";
import SplashScreen from "./screens/SplashScreen";
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
import AudioControls from "./components/AudioControls";
import { useAudioManager } from "./hooks/useAudioManager";
import { useSettingsStore } from "./store/settingsStore";
import { useLoggingStore } from "./store/loggingStore";
import { loggingService } from "./lib/loggingService";
import DataCollectionBanner from "./components/DataCollectionBanner";

if (import.meta.env.DEV) {
  import("./dev/storesDebug").then(m => m.attachStoresDebug());
}

export default function App() {
  const { route, push } = useHashRoute();
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const loggingEnabled = useLoggingStore((s) => s.enabled);
  const consented = useLoggingStore((s) => s.consented);

  console.debug("[App] 📍 Current route:", route);
  console.debug("[App] enableModifiers:", enableModifiers);
  useEnsureMirroredAvatarOnce();

  // Initialize audio manager hook to sync settings with audio playback
  useAudioManager();

  // Initialize logging service when consented
  useEffect(() => {
    if (consented && loggingEnabled) {
      loggingService.init();
    }
  }, [consented, loggingEnabled]);

  // Handle browser close - flush remaining logs
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (loggingEnabled) {
        loggingService.flush(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loggingEnabled]);

  // Render current screen with global audio controls
  return (
    <>
      {/* Data collection consent banner - shows on first visit if backend enabled */}
      <DataCollectionBanner />

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
      {route === "/compass-vis" && <CompassVisScreen push={push} />}
      {route === "/mirror" && <MirrorScreen push={push} />}
      {route === "/debug-mini" && <MiniCompassDebugScreen push={push} />}
      {route === "/background-intro" && <BackgroundIntroScreen push={push} />}
      {enableModifiers && route === "/goals" && (() => {
        console.log("[App] 🎯 Rendering GoalsSelectionScreen");
        return <GoalsSelectionScreen push={push} />;
      })()}
      {route === "/event" && <EventScreen3 push={push} />}
      {route.startsWith("/highscores") && <HighscoreScreen />}
      {route === "/achievements" && <AchievementsScreen />}
      {route === "/aftermath" && <AftermathScreen push={push} />}
      {route === "/final-score" && <FinalScoreScreen push={push} />}


      {/* Default route - SplashScreen */}
      {route === "/" && (
        <SplashScreen
          onStart={() => push("/intro")}
          onHighscores={() => push("/highscores")}
          onAchievements={() => push("/achievements")}
        />
      )}
    </>
  );
}
