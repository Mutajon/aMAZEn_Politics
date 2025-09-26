// src/lib/powerHolderIcon.tsx
import React from "react";
import {
  Shield,
  Sword,
  Briefcase,
  Banknote,
  Megaphone,
  Newspaper,
  Gavel,
  Scale,
  Cpu,
  Leaf,
  Zap,
  GraduationCap,
  Building2,
} from "lucide-react";

// Heuristic: best-fit Lucide icon from holder name keywords.
export function pickIconForHolder(name: string): React.ReactNode {
  const n = name.toLowerCase();

  // Security / military / police
  if (/(military|army|defense|security|police|generals?)/.test(n)) return <Shield className="w-4 h-4" />;
  if (/(war|soldier|troops|force)/.test(n)) return <Sword className="w-4 h-4" />;

  // Business / banks / oligarchs
  if (/(business|corporate|oligarch|industry|commerce)/.test(n)) return <Briefcase className="w-4 h-4" />;
  if (/(bank|finance|money|treasury)/.test(n)) return <Banknote className="w-4 h-4" />;

  // Media / press
  if (/(media|press|newspaper|tv|journalists?)/.test(n)) return <Newspaper className="w-4 h-4" />;
  if (/(propaganda|broadcast|speech|communication)/.test(n)) return <Megaphone className="w-4 h-4" />;

  // Judiciary / courts
  if (/(court|judge|judiciary|justice)/.test(n)) return <Gavel className="w-4 h-4" />;
  if (/(law|rights|constitution|balance)/.test(n)) return <Scale className="w-4 h-4" />;

  // Tech / science / academia
  if (/(tech|technology|it|software|platform)/.test(n)) return <Cpu className="w-4 h-4" />;
  if (/(university|academia|education|students?)/.test(n)) return <GraduationCap className="w-4 h-4" />;

  // Environment / energy
  if (/(environment|green|climate|ecology|forest|nature)/.test(n)) return <Leaf className="w-4 h-4" />;
  if (/(energy|oil|gas|power grid|electric)/.test(n)) return <Zap className="w-4 h-4" />;

  // Default civic institution / legislature / generic group
  return <Building2 className="w-4 h-4" />;
}
