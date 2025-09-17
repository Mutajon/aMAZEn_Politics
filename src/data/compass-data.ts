// src/data/compass-data.ts
export const PROPERTIES = [
    { key: "what", title: "What", subtitle: "Ultimate goals" },
    { key: "whence", title: "Whence", subtitle: "Goals justification" },
    { key: "how", title: "How", subtitle: "Means to get goals" },
    { key: "whither", title: "Whither", subtitle: "Recipient of goals" },
  ] as const;
  
  export type PropKey = (typeof PROPERTIES)[number]["key"];
  
  export const PALETTE: Record<PropKey, { base: string; lite: string }> = {
    what: { base: "#6366f1", lite: "#a5b4fc" }, // indigo
    whence: { base: "#10b981", lite: "#6ee7b7" }, // emerald
    how: { base: "#f59e0b", lite: "#fcd34d" }, // amber
    whither: { base: "#ef4444", lite: "#fca5a5" }, // rose
  };
  
  export const COMPONENTS: Record<PropKey, { short: string; full: string }[]> = {
    what: [
      { short: "Truth/Trust", full: "Believing things that are true, and relying on those who tell it." },
      { short: "Liberty/Agency", full: "The freedom to choose your own adventure, or at least your own breakfast." },
      { short: "Equality/Equity", full: "Everyone gets a fair shot, and maybe a little boost if they're starting from behind." },
      { short: "Care/Solidarity", full: "We're all in this together, so let's try not to be jerks." },
      { short: "Create/Courage", full: "Making new things, and being brave enough to try." },
      { short: "Wellbeing", full: "Health, happiness, and the small joys that make life good." },
      { short: "Security/Safety", full: "Knowing that a piano isn't going to fall on your head." },
      { short: "Freedom/Responsibility", full: "The power to choose, and the duty to own the consequences." },
      { short: "Honor/Sacrifice", full: "Doing the right thing, especially when it's really, really hard." },
      { short: "Sacred/Awe", full: "That feeling you get when you see something truly amazing." },
    ],
    whence: [
      { short: "Evidence", full: "What the facts say, and which predictions come true." },
      { short: "Public Reason", full: "Good reasons other people could accept — even if they don't agree with you." },
      { short: "Personal", full: "Gut → intuition → conscience. Your call, owned by you." },
      { short: "Tradition", full: "What the elders taught and the community remembers." },
      { short: "Revelation", full: "What comes from beyond — a living source." },
      { short: "Nature", full: "What a thing is for; its purpose or telos." },
      { short: "Pragmatism", full: "If it works, it works. Don't overthink it." },
      { short: "Aesthesis", full: "If it looks good and feels right, it probably is. The vibe check." },
      { short: "Fidelity", full: "Staying loyal to your crew, through thick and thin." },
      { short: "Law (Office)", full: "Because the rules are the rules, that's why." },
    ],
    how: [
      { short: "Law/Std.", full: "Using the rulebook to your advantage, with regulations, courts, and standards." },
      { short: "Deliberation", full: "Talking it out until you reach a sensible compromise, or everyone is exhausted." },
      { short: "Mobilize", full: "Getting the people shouting, marching, and generally making a scene." },
      { short: "Markets", full: "Letting the free market work its magic, with prices and incentives." },
      { short: "Mutual Aid", full: "Helping each other out directly, no middleman required." },
      { short: "Ritual", full: "The power of ceremony, from secret handshakes to public holidays." },
      { short: "Design/UX", full: "Nudging people to do the right thing without them even realizing it." },
      { short: "Enforce", full: "Keeping the peace with force that’s legal and ethical — ideally." },
      { short: "Civic Culture", full: "Schools, stories, and the news shaping how we see the world." },
      { short: "Philanthropy", full: "Putting money and resources where your mouth is." },
    ],
    whither: [
      { short: "Self", full: "Looking out for number one. You." },
      { short: "Family", full: "For the ones you're stuck with at holidays. Your nearest and dearest." },
      { short: "Friends", full: "The family you choose. Your ride-or-dies." },
      { short: "In-Group", full: "Your team, your tribe, your people. Us against them." },
      { short: "Nation", full: "For flag and country. All the people who share your passport." },
      { short: "Civiliz.", full: "The broader cultural family, from your city to your continent." },
      { short: "Humanity", full: "For all mankind. Every single person on the planet." },
      { short: "Earth", full: "For the planet and all its creatures, great and small." },
      { short: "Cosmos", full: "For all sentient life, wherever it may be. The final frontier." },
      { short: "God", full: "For a higher power, the ultimate authority." },
    ],
  };
  // --- ALIASES & RESOLVER (append) -----------------------------------------

/** Some UI labels are friendlier aliases for canonical COMPONENTS.short values. */
export const VALUE_ALIASES: Record<string, { prop: PropKey; short: string }> = {
    // what
    "Flourish/Joy": { prop: "what", short: "Wellbeing" },
    "Security/Order": { prop: "what", short: "Security/Safety" },
    "Honor/Dignity": { prop: "what", short: "Honor/Sacrifice" },
    "Transcendence/Spiritual": { prop: "what", short: "Sacred/Awe" },
    "Wealth/Prosperity": { prop: "what", short: "Wellbeing" },
  
    // whence
    Aesthetic: { prop: "whence", short: "Aesthesis" },
    Authority: { prop: "whence", short: "Law (Office)" },
    Utility: { prop: "whence", short: "Pragmatism" },
  
    // how
    Contract: { prop: "how", short: "Law/Std." },
  };
  
  /**
   * Resolve a display label (canonical or alias) to a compass component index.
   * Returns { prop, idx } or null if not found.
   */
  export function resolveLabel(label: string): { prop: PropKey; idx: number } | null {
    const key = (label || "").trim();
  
    // 1) try exact match against every COMPONENTS[prop].short
    const props = PROPERTIES.map((p) => p.key) as PropKey[];
    for (const prop of props) {
      const idx = COMPONENTS[prop].findIndex((c) => c.short === key);
      if (idx >= 0) return { prop, idx };
    }
  
    // 2) try alias → canonical
    const ali = VALUE_ALIASES[key];
    if (ali) {
      const idx = COMPONENTS[ali.prop].findIndex((c) => c.short === ali.short);
      if (idx >= 0) return { prop: ali.prop, idx };
    }
  
    return null;
  }
  