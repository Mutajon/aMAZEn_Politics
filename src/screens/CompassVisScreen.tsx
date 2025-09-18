// src/screens/CompassVisScreen.tsx
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import InnerCompass from "../components/InnerCompass";

type Props = { push: PushFn };

export default function CompassVisScreen({ push }: Props) {
  return (
    <div className="min-h-screen w-full text-neutral-100 p-4 sm:p-6" style={bgStyle}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-3">
          <button
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15"
            onClick={() => window.history.back()}
            title="Go back"
          >
            ← Back
          </button>
        </div>

        <InnerCompass />
      </div>
    </div>
  );
}
