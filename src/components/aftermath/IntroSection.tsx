// src/components/aftermath/IntroSection.tsx
// Title section for Aftermath screen
//
// Shows only:
// - Title: "Your time has passed..."
//
// Connects to:
// - src/components/aftermath/AftermathContent.tsx: main content orchestration

export default function IntroSection() {
  return (
    <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-8">
      Your time has passed...
    </h1>
  );
}
