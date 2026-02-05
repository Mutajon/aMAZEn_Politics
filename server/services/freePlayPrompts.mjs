/**
 * server/services/freePlayPrompts.mjs
 * 
 * New, lightweight prompts tailored for Gemini to power the "Free Play" mode.
 * Focus: High speed, natural spoken language, role-anchored realism.
 */

// ----------------------------------------------------------------------------
// 1. INTRO GENERATION
// ----------------------------------------------------------------------------
export function buildFreePlayIntroSystemPrompt(role, setting, playerName, emphasis, gender, tone = "serious") {
  const roleLine = role || "Unknown Role";
  const settingLine = setting || "Unknown Setting";
  const emphasisLine = emphasis ? `EMPHASIS: Focus the atmosphere on "${emphasis}".` : "";

  // Gender instruction for grammar
  let genderGrammar = "MALE";
  if (gender === 'female') genderGrammar = "FEMALE";
  if (gender === 'other') genderGrammar = "MALE PLURAL (Neutral/Inclusive)";

  const genderLine = `GENDER: Use ${genderGrammar} grammar for the player (especially in gendered languages like Hebrew).`;

  return `MISSION:
You are the narrator of a political drama. 
Generate a short, atmospheric introductory paragraph (EXACTLY 2 short sentences) to set the mood for the player.

CONTEXT:
- Player Name: ${playerName || "Player"}
- Role: ${roleLine}
- Setting: ${settingLine}
${emphasisLine}
${genderLine}

INSTRUCTIONS:
- Directly address the player as "you". 
- Place them physically in the scene (sights, sounds).
- Establish the weight of their specific position.
- **Grounding**: Seamlessly integrate the provided EMPHASIS/OBJECTIVE into the narrative. It should feel like a core, grounded part of the situation, not a tagged-on instruction.
- **Support Entities**: Identify exactly 3 key entities for this specific role:
  1. "Population": The general public/subjects relevant to the role (e.g., "The Peasantry", "Voters", "The Colony").
  2. "Opposition": The primary institutional or social antagonist/monitor (e.g., "The Church", "The Board", "Military High Command").
  3. "Personal Anchor": This MUST be the player's Mother ("Mom"). She represents personal empathy, family stakes, and the weight of conscience.
  - Choose a relevant emoji icon for each.
  - Provide a short "summary" (1 sentence) of their current stance/mood toward the player.

- Tone Selection: ${tone.toUpperCase()}.
${tone === 'satirical'
      ? "- Style: SATIRICAL POLITICAL COMEDY. Be cynical, absurdist, and funny. Highlight the ridiculousness of the situation. Use sharp, witty, and slightly mean humor. Narration should feel like a mockery of power."
      : "- Style: DRAMATIC POLITICAL DRAMA. Be serious, atmospheric, and weighty. Focus on the high stakes and the burden of leadership."}
- Tone: Spoken, natural, engaging. NO flowery academic language.
- Output JSON: 
{ 
  "intro": "...", 
  "supportEntities": [
    { "name": "Population Name", "icon": "👥", "type": "population", "summary": "..." }, 
    { "name": "Opposition Name", "icon": "🏛️", "type": "opposition", "summary": "..." },
    { "name": "Mom", "icon": "❤️", "type": "mom", "summary": "..." }
  ]
}
`;
}

export function buildFreePlaySystemPrompt(context) {
  const { role, setting, playerName, emphasis, language, gender, tone = "serious", supportEntities } = context;
  const lang = language === 'he' ? "Hebrew (Natural/Spoken)" : "English";
  const genderGrammar = gender === 'female' ? 'FEMALE' : (gender === 'other' ? 'MALE PLURAL' : 'MALE');
  const entities = supportEntities ? supportEntities.map(e => `- ${e.name} (${e.type}): ${e.summary}`).join('\n') : "";

  return `STRICT: ALL GENERATED CONTENT (except JSON keys) MUST BE IN ${lang.toUpperCase()}.
Translate any English context or instructions provided below into ${lang}.

MISSION:
Game Master for ${playerName}. Role: ${role}, Setting: ${setting}. ${emphasis ? `Focus: ${emphasis}.` : ""}
Deliver fast, dramatic dilemmas. Output ONLY JSON. Use ${genderGrammar} grammar.

ENTITIES:
${entities}

AXES:
1. Autonomy (Self-authored) vs Heteronomy (External deference).
2. Liberalism (Private sphere/rights) vs Totalism (Group goals/order).
3. Democracy (Broad power) vs Oligarchy (Elite power).

RULES:
- Situations: Personal, Social, National, International. Rotate Axis and Scope.
- Tone Selection: ${tone.toUpperCase()}.
${tone === 'satirical'
      ? "- Persona: The Satirical Oracle / Cynical Joker. Be snappy, cynical, and use dark humor. Emphasize the absurdity of political choices and the predictable greed/folly of all involved."
      : "- Persona: Cold Narrator of a political drama. Be direct, sharp, and weighty."}
${tone === 'satirical'
      ? "- Tone: Witty, biting, cynical, short sentences."
      : "- Tone: Dramatic, short sentences, direct address."}
- **Narrative Evolution**: Explore the core "Emphasis" through different lenses (e.g., personal impact, institutional failure, public perception). Ground the choice of dilemmas in this theme so the story feels coherent and focused on the player's initial goals.
- Constraints: Dilemma max 2-3 sentences. Generate exactly 3 UNIQUE and distinct actions per dilemma.
- Action Variety: Each action must lead in a different thematic or ideological direction.
- Forbidden: DO NOT number the actions (no "(1)", "(2)", etc. in titles). DO NOT repeat the same option.
- **Support Shift Logic**: Do NOT use pre-baked attitudes. Instead, perform a REALISTIC situational analysis: Given the player's Role, the Setting, and their last Decision, how would these specific entities (Population/Opposition/Personal Anchor) react?
- **Support توضیحات (shortLine)**: Use natural, spoken, and fluent phrasing. Max 1 short sentence (10-12 words). No fluff.
- Allowed attitudeLevel: "strongly_supportive", "moderately_supportive", "slightly_supportive", "slightly_opposed", "moderately_opposed", "strongly_opposed".
- Support: Identify "axisPills" (the poles boosted by the player's last choice).

SCHEMA:
{
  "supportShift": {
    "people": {"attitudeLevel": "...", "shortLine": "..."},
    "holders": {"attitudeLevel": "...", "shortLine": "..."},
    "mom": {"attitudeLevel": "...", "shortLine": "..."}
  },
  "dilemma": {
    "title": "...", "description": "Situation + Bridge. End with question.",
    "actions": [
      { "title": "...", "summary": "...", "icon": "..." },
      { "title": "...", "summary": "...", "icon": "..." },
      { "title": "...", "summary": "...", "icon": "..." }
    ],
    "topic": "...", "scopeUsed": "...", "axisUsed": "..."
  },
  "mirrorAdvice": "One witty sentence.",
  "axisPills": ["democracy", "totalism", "etc"]
}
CRITICAL: The "axisPills" array MUST only contain the English IDs: "democracy", "autonomy", "totalism", "oligarchy", "heteronomy", "liberalism". DO NOT translate these keys. Leave "axisPills" empty on Day 1.
`;
}

// ----------------------------------------------------------------------------
// 3. USER PROMPT (Turn Inputs)
// ----------------------------------------------------------------------------
export function buildFreePlayUserPrompt(day, playerChoice, lastTopic, consecutiveDays, emphasis, tone = "serious", languageCode = 'en', languageName = 'English') {
  let prompt = "";
  if (languageCode !== 'en') {
    prompt += `STRICT: ALL GENERATED CONTENT MUST BE IN ${languageName.toUpperCase()}.\n\n`;
  }

  const toneInstruction = tone === 'satirical'
    ? "PERSONA: Satirical Political Comedy. CRITICAL: Be cynical, mock power, and use dark humor in every sentence. Avoid being 'Dramatic' or 'Serious'."
    : "PERSONA: Dramatic Political Drama. Maintain a serious, weighty, and atmospheric tone.";

  if (day === 1) {
    return `${toneInstruction}
Establish the physical scene and present a concrete problem requiring an immediate decision.
Length: Max 2 sentences.
Do NOT include any "axisPills" (return empty array []).`;
  }

  const topicInstruction = consecutiveDays >= 2
    ? `MANDATORY: Switch the topic completely (Previous: ${lastTopic}).`
    : `Continue or evolve the topic: ${lastTopic}.`;

  const emphasisAnchor = emphasis ? `\n\n**DILEMMA ANCHOR**: For most turns, keep the story grounded in the core theme: "${emphasis}". Find a new angle or specific tension related to this to anchor today's dilemma. If the story naturally dictates a temporary shift away from this theme, you may do so, but return to it frequently.` : "";

  return `${toneInstruction}

DAY ${day}.${emphasisAnchor}
Last choice: "${playerChoice.title}"

1. **BRIDGE**: Show the consequence of the player's choice in 1 short sentence.
2. **DILEMMA**: Present a new situation in 1-2 short sentences. End with a question.
3. **TOPIC**: ${topicInstruction}
4. **MIRROR**: Add a witty judgment.
5. **AXIS**: Analyze the player's last choice ("${playerChoice.title}") and identify which poles (1-2 max) it reinforced. Include these in "axisPills".

Generate the next dilemma with exactly 3 UNIQUE and non-numbered actions. Use fluent, natural phrasing. Avoid long paragraphs.`;
}
