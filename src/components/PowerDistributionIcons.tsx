/**
 * PowerDistributionIcons.tsx
 *
 * Icon rendering utilities for the PowerDistributionScreen.
 * Maps icon keys to Lucide React components for power holders.
 *
 * Used by: PowerDistributionScreen.tsx, usePowerDistributionAnalysis.ts
 * Uses: lucide-react icons
 */

import { type ReactElement } from "react";
import {
  Crown, Shield, Coins, Landmark, BookOpen, Gavel, Scale, Swords, Users,
  Flame, Building2, Banknote, ScrollText, Cog, HelpCircle,
} from "lucide-react";

// Icon mapping registry
const ICON_RENDERERS: Record<string, (props: { className?: string }) => ReactElement> = {
  Crown: (p) => <Crown {...p} />,
  Shield: (p) => <Shield {...p} />,
  Coins: (p) => <Coins {...p} />,
  Landmark: (p) => <Landmark {...p} />,
  BookOpen: (p) => <BookOpen {...p} />,
  Gavel: (p) => <Gavel {...p} />,
  Scale: (p) => <Scale {...p} />,
  Swords: (p) => <Swords {...p} />,
  Users: (p) => <Users {...p} />,
  Flame: (p) => <Flame {...p} />,
  Building2: (p) => <Building2 {...p} />,
  Banknote: (p) => <Banknote {...p} />,
  ScrollText: (p) => <ScrollText {...p} />,
  Cog: (p) => <Cog {...p} />,
  HelpCircle: (p) => <HelpCircle {...p} />,
};

// Icon component for rendering dynamic icons
interface IconFromKeyProps {
  keyName?: string;
  className?: string;
}

export function IconFromKey({ keyName, className }: IconFromKeyProps): ReactElement {
  const renderer = ICON_RENDERERS[keyName || "HelpCircle"] || ICON_RENDERERS.HelpCircle;
  return renderer({ className });
}

// Visual constants
export const RANK_COLORS = ["#4C1D95", "#5B21B6", "#6D28D9", "#8B5CF6", "#A78BFA"] as const;

// Get rank color for a given position (1-indexed)
export function getRankColor(rank: number): string {
  return RANK_COLORS[Math.min(rank - 1, RANK_COLORS.length - 1)];
}