// src/components/event/MirrorWithAvatar.tsx
// Container component that displays MirrorCard and clickable player avatar side-by-side
//
// Layout:
// - MirrorCard on left (flexible width, grows to fill available space)
// - Player avatar on right (fixed 100x100px, clickable)
// - Gap between elements
//
// Features:
// - Clicking avatar opens PlayerCardModal with character info, compass values, corruption
// - Avatar maintains same visual style as ResourceBar avatar (but interactive)
// - Hover/focus states for accessibility
//
// Connected to:
// - src/components/event/MirrorCard.tsx: Displays mirror advice
// - src/components/event/PlayerCardModal.tsx: Modal opened on avatar click
// - src/screens/EventScreen3.tsx: Replaces standalone MirrorCard at Step 5

import { useState } from "react";
import { User } from "lucide-react";
import MirrorCard from "./MirrorCard";
import PlayerCardModal from "./PlayerCardModal";
import { useRoleStore } from "../../store/roleStore";

type Props = {
  text: string;
  italic?: boolean;
  className?: string;
  onExploreClick?: () => void;
  avatarSrc?: string | null;
};

export default function MirrorWithAvatar({
  text,
  italic = true,
  className,
  onExploreClick,
  avatarSrc,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Get minimal data for avatar display only
  const character = useRoleStore((s) => s.character);

  // Determine avatar source
  const resolvedSrc = avatarSrc || character?.avatarUrl;

  // Player name for accessibility labels
  const playerName = character?.name || "Unknown Leader";

  return (
    <>
      {/* Horizontal container: Mirror + Avatar */}
      <div className={`flex items-center gap-4 ${className || ""}`}>
        {/* MirrorCard - flexible width */}
        <div className="flex-grow min-w-0">
          <MirrorCard text={text} italic={italic} onExploreClick={onExploreClick} avatarUrl={resolvedSrc} />
        </div>

        {/* Player Avatar - fixed size, clickable */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 rounded-xl overflow-hidden ring-1 ring-white/15 bg-white/5 hover:ring-white/30 hover:bg-white/10 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
          style={{ width: 100, height: 100, minWidth: 100 }}
          aria-label={`View ${playerName}'s character information`}
          title="Click to view your character details"
        >
          {resolvedSrc && !imgError ? (
            <img
              src={resolvedSrc}
              alt={playerName}
              className="w-full h-full object-cover"
              width={100}
              height={100}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8 text-white/80" strokeWidth={2.2} />
            </div>
          )}
        </button>
      </div>

      {/* Player Card Modal */}
      <PlayerCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        avatarSrc={resolvedSrc}
      />
    </>
  );
}
