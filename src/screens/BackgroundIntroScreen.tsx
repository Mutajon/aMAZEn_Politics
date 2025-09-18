// src/screens/BackgroundIntroScreen.tsx
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";

export default function BackgroundIntroScreen({ push }: { push: PushFn }) {
  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-white/90">Night Falls</h1>
        <p className="mt-3 text-white/80">
          You drift into sleep as the mirror’s last words echo softly. Tomorrow, your new role begins…
        </p>

        <div className="mt-6 flex gap-3">
          <button
            className="rounded-xl px-4 py-2 bg-white/15 text-white hover:bg-white/25 border border-white/30"
            onClick={() => window.history.back()}
          >
            ← Back
          </button>
          <button
            className="rounded-xl px-4 py-2 bg-white/90 text-[#0b1335] hover:bg-white"
            onClick={() => push("/")}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
