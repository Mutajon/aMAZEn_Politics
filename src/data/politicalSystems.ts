// src/data/politicalSystems.ts
// Canonical polity list (E-12 framework classification) used across the app for classification & UI.
export type PoliticalSystem = {
  key: string;        // stable key (no spaces)
  name: string;       // display name (must match ALLOWED_POLITIES in server)
  description: string;
  flavor: string;     // short italic flavor line
};

export const POLITICAL_SYSTEMS: PoliticalSystem[] = [
  {
    key: "democracy",
    name: "Democracy",
    description: "Demos (the people) hold decisive authority in core domains through direct self-determination mechanisms.",
    flavor: "The people decide their own fate—loud, messy, and surprisingly hard to suppress."
  },
  {
    key: "republican_oligarchy",
    name: "Republican Oligarchy",
    description: "Formal offices (Executive, Legislative, Judicial) divide power; no single seat holds both pen and eraser across domains.",
    flavor: "Institutions grind; factions bargain. Nobody rules alone—unless they cheat."
  },
  {
    key: "hard_power_oligarchy_plutocracy",
    name: "Hard-Power Oligarchy — Plutocracy",
    description: "Wealth controls critical decision domains; money authors outcomes more than formal offices.",
    flavor: "Gold writes the laws. Legislatures just sign the paperwork."
  },
  {
    key: "hard_power_oligarchy_stratocracy",
    name: "Hard-Power Oligarchy — Stratocracy",
    description: "Coercive force (military/security apparatus) dominates priority domains and escalates at will.",
    flavor: "Generals decide when to fight—and who stays in charge afterward."
  },
  {
    key: "mental_might_oligarchy_theocracy",
    name: "Mental-Might Oligarchy — Theocracy",
    description: "Religious doctrine and clergy author outcomes system-wide; sacred texts trump secular law.",
    flavor: "The priests hold the pen. Obey the doctrine or face divine consequences."
  },
  {
    key: "mental_might_oligarchy_technocracy",
    name: "Mental-Might Oligarchy — Technocracy",
    description: "Technical experts and scientific authority author policy; credentials gate power.",
    flavor: "Rule by spreadsheet and PhD. If you can't prove it, you can't propose it."
  },
  {
    key: "mental_might_oligarchy_telecracy",
    name: "Mental-Might Oligarchy — Telecracy",
    description: "Media platforms and information gatekeepers shape outcomes by controlling narrative and attention.",
    flavor: "Whoever controls the feed controls the truth. Reality is negotiable."
  },
  {
    key: "autocratizing_executive",
    name: "Autocratizing (Executive)",
    description: "Executive accumulates pen+eraser across multiple domains while neutralizing judicial/media/demos checks.",
    flavor: "The leader isn't a dictator yet—but the exits are narrowing fast."
  },
  {
    key: "autocratizing_military",
    name: "Autocratizing (Military)",
    description: "Military command consolidates control over security, economy, and appointments while sidelining civilians.",
    flavor: "The uniforms run the show now. Civilian oversight is decorative."
  },
  {
    key: "personalist_monarchy_autocracy",
    name: "Personalist Monarchy / Autocracy",
    description: "One person holds pen+eraser across all priority domains; institutions exist but obey the throne.",
    flavor: "One ruler. One will. Everyone else is along for the ride."
  },
  {
    key: "theocratic_monarchy",
    name: "Theocratic Monarchy",
    description: "A hereditary sovereign claims divine mandate and rules through religious legitimacy; clergy and court intertwine.",
    flavor: "God's chosen ruler sits the throne. Dissent is heresy, obedience is worship."
  },
];
