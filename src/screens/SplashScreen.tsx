// src/screens/SplashScreen.tsx
import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { bgStyle } from "../lib/ui";

export default function SplashScreen({ onStart }: { onStart: () => void }) {
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={bgStyle}>
      <div className="w-full max-w-md text-center select-none space-y-5">
        <motion.h1
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
        >
          aMAZE'n Politics
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="text-base sm:text-lg bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200 bg-clip-text text-transparent"
        >
          Discover yourself — and your best!
        </motion.p>

        <div className="mt-8 flex justify-center min-h-[52px]">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: showButton ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 22 }}
            style={{ visibility: showButton ? "visible" : "hidden" }}
            onClick={onStart}
            className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            Start!
          </motion.button>
        </div>
      </div>
    </div>
  );
}
