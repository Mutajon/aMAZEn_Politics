// src/App.tsx
import { useHashRoute } from "./lib/router";
import SplashScreen from "./screens/SplashScreen";
import IntroScreen from "./screens/IntroScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import CampaignScreen from "./screens/CampaignScreen";
import PowerDistributionScreen from "./screens/PowerDistributionScreen";
import NameScreen from "./screens/NameScreen";
import CompassIntro from "./screens/CompassIntro";

export default function App() {
  const { route, push } = useHashRoute();

  if (route === "/intro") return <IntroScreen push={push} />;
  if (route === "/role") return <RoleSelectionScreen push={push} />;
  if (route === "/campaign") return <CampaignScreen />;
  if (route === "/power") return <PowerDistributionScreen push={push} />;
  if (route === "/name") return <NameScreen push={push} />;
  if (route === "/compass") return <CompassIntro push={push} />;

  // default
  return <SplashScreen onStart={() => push("/intro")} />;
}
