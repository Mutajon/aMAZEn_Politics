// src/screens/MiniCompassDebugScreen.tsx
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import MiniCompass from "../components/MiniCompass";
import { useCompassStore, VALUE_RULES } from "../store/compassStore";
import { useCompassFX } from "../hooks/useCompassFX";
import { resolveLabel } from "../data/compass-data";

export default function MiniCompassDebugScreen({ push }: { push: PushFn }) {
  const values = useCompassStore((s) => s.values);
  const reset = useCompassStore((s) => s.reset);
  const { pings, applyWithPings } = useCompassFX();

  const size = 260;
  const mirror = 120;
  const innerRadius = mirror / 2 + 10; // same geometry style as quiz ring

  function bump(labels: string[]) {
    const pairs = labels.map(resolveLabel).filter((x): x is NonNullable<ReturnType<typeof resolveLabel>> => x !== null);
    if (!pairs.length) return;
    const effects = pairs.map(({ prop, idx }) => ({ prop, idx, delta: VALUE_RULES.strongPositive }));
    applyWithPings(effects);
  }

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-white/90 text-lg font-semibold">MiniCompass Debug</h1>
          <button
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
            onClick={() => push("/")}
          >
            ← Home
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="relative" style={{ width: size, height: size }}>
            <MiniCompass
              size={size}
              innerRadius={innerRadius}
              values={values}
              lengthScale={0.7}         // make growth obvious
              rotate
              rotationSpeedSec={60}
              effectPills={pings}
            />
          </div>

          <div className="flex-1 space-y-2">
            <button
              className="w-full rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-left"
              onClick={() => bump(["Truth/Trust", "Public Reason"])}
            >
              +2 Truth/Trust & +2 Public Reason
            </button>
            <button
              className="w-full rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-left"
              onClick={() => bump(["Security/Order"])}
            >
              +2 Security/Order
            </button>
            <button
              className="w-full rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20 text-left"
              onClick={() => bump(["Flourish/Joy"])}
            >
              +2 Flourish/Joy (alias → Wellbeing)
            </button>

            <div className="pt-2">
              <button
                className="w-full rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
                onClick={() => reset()}
              >
                Reset compass to zero
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-white/60">
          Tip: if petals animate here but not on the quiz screen, the data flow is fine and the issue is local to the quiz layout.
        </p>
      </div>
    </div>
  );
}
