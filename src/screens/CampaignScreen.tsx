// src/screens/CampaignScreen.tsx

import { bgStyle } from "../lib/ui";
import { useLang } from "../i18n/lang";

export default function CampaignScreen() {
  const lang = useLang();
  
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={bgStyle}>
      <div className="w-full max-w-sm text-center select-none">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200 bg-clip-text text-transparent">
          {lang("CAMPAIGN_MODE")}
        </h2>
        <p className="mt-2 text-white/85">{lang("COMING_SOON")}</p>
      </div>
    </div>
  );
}
