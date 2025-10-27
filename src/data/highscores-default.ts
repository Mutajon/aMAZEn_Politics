// src/data/highscores-default.ts
export type DemocracyLevel = "Very Low" | "Low" | "Medium" | "High" | "Very High";

export type HighscoreEntry = {
  name: string;              // Leader
  about: string;             // For popup
  democracy: DemocracyLevel; // Liberalism Ranking
  autonomy: DemocracyLevel;  // Autonomy Ranking
  values: string;            // "What: …; Whence: …; How: …; Whither: …"
  score: number;             // Overall score (0–3500)
  /** Optional concise period tag shown in the popup header (e.g., "r. 51–30 BCE"). */
  period?: string;

  /** Canonical political system name from POLITICAL_SYSTEMS (displayed in table & popup). */
  politicalSystem: string;

  /** Optional player avatar (base64 data URL). Only saved for top 20 Hall of Fame entries. */
  avatarUrl?: string;
};

/** First 20 seeded entries (with concise period tags). */
export const DEFAULT_HIGHSCORES: HighscoreEntry[] = [
  {
    name: "Cleopatra VII",
    about:
      "The last ruler of Ptolemaic Egypt, a deft diplomat who leveraged Roman alliances to safeguard Egypt’s power and prestige.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Security/Safety; Whence: Personal; How: Enforce; Whither: In-Group",
    score: 1500,
    period: "r. 51–30 BCE",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "Augustus",
    about:
      "Founder-emperor of the Roman Empire who stabilized Rome, institutionalized law and loyalty, and crafted a lasting imperial myth.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Security/Safety; Whence: Tradition; How: Law/Std.; Whither: Nation",
    score: 2240,
    period: "r. 27 BCE–14 CE",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "Ashoka",
    about:
      "Mauryan ruler in India who turned from conquest to compassion, spreading Buddhist ethics and public welfare across the realm.",
    democracy: "High",
    autonomy: "High",
    values: "What: Care/Solidarity; Whence: Revelation; How: Civic Culture; Whither: Humanity",
    score: 2910,
    period: "r. c. 268–232 BCE",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "Charlemagne",
    about:
      "Frankish king over Western and Central Europe who forged unity by sword and sacrament, then bound it with learning and law.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Honor/Sacrifice; Whence: Tradition; How: Enforce; Whither: Civiliz.",
    score: 2090,
    period: "r. 768–814",
    politicalSystem: "Theocratic Monarchy",
  },
  {
    name: "Genghis Khan",
    about:
      "Steppe unifier of the Mongols whose empire spanned Asia, ruling through ruthless meritocracy, mobility, and iron discipline.",
    democracy: "Very Low",
    autonomy: "Very Low",
    values: "What: Honor/Sacrifice; Whence: Personal; How: Enforce; Whither: In-Group",
    score: 1720,
    period: "r. 1206–1227",
    politicalSystem: "Hard-Power Oligarchy — Stratocracy",
  },
  {
    name: "Mansa Musa",
    about:
      "Emperor of Mali in West Africa whose pilgrimage and patronage made Timbuktu a magnet for trade, scholarship, and wealth.",
    democracy: "Medium",
    autonomy: "Medium",
    values: "What: Wellbeing; Whence: Revelation; How: Markets; Whither: Nation",
    score: 2310,
    period: "r. 1312–1337",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "Elizabeth I",
    about:
      "Queen of England who balanced factions, backed exploration and the arts, and secured the kingdom's independence.",
    democracy: "Medium",
    autonomy: "High",
    values: "What: Security/Safety; Whence: Public Reason; How: Law/Std.; Whither: Nation",
    score: 2665,
    period: "r. 1558–1603",
    politicalSystem: "Republican Oligarchy",
  },
  {
    name: "Tokugawa Ieyasu",
    about:
      "Shogun of Japan who ended chaos by imposing orderly peace from Edo, favoring stability, hierarchy, and isolation.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Security/Safety; Whence: Tradition; How: Law/Std.; Whither: Nation",
    score: 2000,
    period: "r. 1603–1605",
    politicalSystem: "Hard-Power Oligarchy — Stratocracy",
  },
  {
    name: "Peter the Great",
    about:
      "Tsar of Russia who forced a sprawling land toward modernity, building a navy, a new capital, and a muscular state.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Create/Courage; Whence: Personal; How: Enforce; Whither: Nation",
    score: 2110,
    period: "r. 1682–1725",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "George Washington",
    about:
      "Revolutionary commander turned first president of the United States who set republican norms and relinquished power to protect them.",
    democracy: "High",
    autonomy: "Very High",
    values: "What: Liberty/Agency; Whence: Public Reason; How: Deliberation; Whither: Nation",
    score: 3095,
    period: "served 1789–1797",
    politicalSystem: "Democracy",
  },
  {
    name: "Napoleon Bonaparte",
    about:
      "French ruler who vaulted from general to emperor, exporting legal codes and nationalism while waging relentless wars.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Security/Safety; Whence: Personal; How: Law/Std.; Whither: Nation",
    score: 2200,
    period: "emperor 1804–1814/1815",
    politicalSystem: "Personalist Monarchy / Autocracy",
  },
  {
    name: "Abraham Lincoln",
    about:
      "American president who preserved the United States and ended slavery through resolve, persuasion, and the rule of law.",
    democracy: "Very High",
    autonomy: "High",
    values: "What: Equality/Equity; Whence: Public Reason; How: Law/Std.; Whither: Nation",
    score: 3075,
    period: "served 1861–1865",
    politicalSystem: "Democracy",
  },
  {
    name: "Otto von Bismarck",
    about:
      "Prussian statesman who unified Germany in Central Europe with iron diplomacy, then steadied it with social insurance and caution.",
    democracy: "Low",
    autonomy: "Medium",
    values: "What: Security/Safety; Whence: Tradition; How: Law/Std.; Whither: Nation",
    score: 2355,
    period: "chancellor 1871–1890",
    politicalSystem: "Republican Oligarchy",
  },
  {
    name: "Mahatma Gandhi",
    about:
      "Leader in India who mobilized millions with nonviolent resistance and moral clarity to challenge imperial rule.",
    democracy: "Very High",
    autonomy: "Very High",
    values: "What: Liberty/Agency; Whence: Evidence; How: Mobilize; Whither: Humanity",
    score: 3250,
    period: "active 1915–1948",
    politicalSystem: "Democracy",
  },
  {
    name: "Mustafa Kemal Atatürk",
    about:
      "Founder of modern Turkey who secularized and reformed the state, driving education, industry, and national identity.",
    democracy: "High",
    autonomy: "High",
    values: "What: Create/Courage; Whence: Public Reason; How: Law/Std.; Whither: Nation",
    score: 2900,
    period: "president 1923–1938",
    politicalSystem: "Republican Oligarchy",
  },
  {
    name: "Franklin D. Roosevelt",
    about:
      "American president who steered the United States through crisis with bold experimentation, steady rhetoric, and broad coalitions.",
    democracy: "High",
    autonomy: "Medium",
    values: "What: Care/Solidarity; Whence: Public Reason; How: Deliberation; Whither: Nation",
    score: 2885,
    period: "served 1933–1945",
    politicalSystem: "Democracy",
  },
  {
    name: "Winston Churchill",
    about:
      "Prime minister in the United Kingdom whose bulldog oratory and alliance-building rallied a democracy under mortal threat.",
    democracy: "Medium",
    autonomy: "Medium",
    values: "What: Honor/Sacrifice; Whence: Tradition; How: Deliberation; Whither: Nation",
    score: 2620,
    period: "PM 1940–45, 1951–55",
    politicalSystem: "Democracy",
  },
  {
    name: "Deng Xiaoping",
    about:
      "China's paramount leader who opened markets while tightening party control, swapping dogma for pragmatic growth.",
    democracy: "Low",
    autonomy: "Low",
    values: "What: Wellbeing; Whence: Personal; How: Markets; Whither: Nation",
    score: 2260,
    period: "paramount 1978–1992",
    politicalSystem: "Autocratizing (Executive)",
  },
  {
    name: "Nelson Mandela",
    about:
      "South Africa's peacemaker-president who transformed long imprisonment into reconciliation and a shared democratic project.",
    democracy: "Very High",
    autonomy: "Very High",
    values: "What: Equality/Equity; Whence: Public Reason; How: Deliberation; Whither: Humanity",
    score: 3350,
    period: "president 1994–1999",
    politicalSystem: "Democracy",
  },
  {
    name: "Angela Merkel",
    about:
      "Germany's chancellor who practiced calm, incremental leadership through continental storms from debt to migration.",
    democracy: "High",
    autonomy: "High",
    values: "What: Wellbeing; Whence: Evidence; How: Deliberation; Whither: Nation",
    score: 2920,
    period: "chancellor 2005–2021",
    politicalSystem: "Republican Oligarchy",
  },
];
