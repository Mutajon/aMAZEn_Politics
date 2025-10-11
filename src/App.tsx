// src/App.tsx
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
import { useEnsureMirroredAvatarOnce } from "./hooks/useEnsureMirroredAvatarOnce";
import EventScreen3 from "./screens/EventScreen3";
import HighscoreScreen from "./screens/HighscoreScreen";
import MirrorScreen from "./screens/MirrorScreen";
import AftermathScreen from "./screens/AftermathScreen";
import FinalScoreScreen from "./screens/FinalScoreScreen";
if (import.meta.env.DEV) {
  import("./dev/storesDebug").then(m => m.attachStoresDebug());
}

export default function App() {
  const { route, push } = useHashRoute();
  console.debug("[App] route =", route);
  useEnsureMirroredAvatarOnce();

  if (route === "/intro") return <IntroScreen push={push} />;
  if (route === "/role") return <RoleSelectionScreen push={push} />;
  if (route === "/campaign") return <CampaignScreen />;
  if (route === "/power") return <PowerDistributionScreen push={push} />;
  if (route === "/difficulty") return <DifficultyScreen push={push} />;

  // NEW split screens
  if (route === "/compass-intro") return <CompassIntroStart push={push} />;
  if (route === "/compass-mirror") return <MirrorDialogueScreen push={push} />;
  if (route === "/compass-quiz") return <MirrorQuizScreen push={push} />;

  if (route === "/name") return <NameScreen push={push} />;
  if (route === "/compass-vis") return <CompassVisScreen push={push} />;
  if (route === "/mirror") return <MirrorScreen push={push} />;
  if (route === "/debug-mini") return <MiniCompassDebugScreen push={push} />;
  if (route === "/background-intro") return <BackgroundIntroScreen push={push} />;
  if (route === "/event") return <EventScreen3 push={push} />;
  if (route === "/highscores") return <HighscoreScreen push={push} />;
  if (route === "/aftermath") return <AftermathScreen push={push} />;
  if (route === "/final-score") return <FinalScoreScreen />;

  

  return (
    <SplashScreen
      onStart={() => push("/role")}
      onHighscores={() => push("/highscores")} // ← new
    />
  );
  
}
