
/**
 * server/services/freePlayPrompts.mjs
 * 
 * New, lightweight prompts tailored for Gemini to power the "Free Play" mode.
 * Focus: High speed, natural spoken language, role-anchored realism.
 */

// ----------------------------------------------------------------------------
// 1. INTRO GENERATION
// ----------------------------------------------------------------------------
export function buildFreePlayIntroSystemPrompt(role, setting, playerName, emphasis, gender) {
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
Generate a short, atmospheric introductory paragraph (2-3 sentences max) to set the mood for the player.

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
- **Support Entities**: Identify exactly 3 key entities for this specific role:
  1. "Population": The general public/subjects relevant to the role (e.g., "The Peasantry", "Voters", "The Colony").
  2. "Opposition": The primary institutional or social antagonist/monitor (e.g., "The Church", "The Board", "Military High Command").
  3. "Personal Anchor": This MUST be the player's Mother ("Mom"). She represents personal empathy, family stakes, and the weight of conscience.
  - Choose a relevant emoji icon for each.
  - Provide a short "summary" (1 sentence) of their current stance/mood toward the player.

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
  const { role, setting, playerName, emphasis, language, gender, supportEntities } = context;
  const lang = language === 'he' ? "Hebrew (Natural/Spoken)" : "English";
  const genderGrammar = gender === 'female' ? 'FEMALE' : (gender === 'other' ? 'MALE PLURAL' : 'MALE');
  const entities = supportEntities ? supportEntities.map(e => `- ${e.name} (${e.type}): ${e.summary}`).join('\n') : "";

  return `MISSION:
Game Master for ${playerName}. Role: ${role}, Setting: ${setting}. ${emphasis ? `Focus: ${emphasis}.` : ""}
Deliver fast, dramatic dilemmas. Output ONLY JSON in ${lang}. Use ${genderGrammar} grammar.

ENTITIES:
${entities}

AXES:
1. Autonomy (Self-authored) vs Heteronomy (External deference).
2. Liberalism (Private sphere/rights) vs Totalism (Group goals/order).
3. Democracy (Broad power) vs Oligarchy (Elite power).

RULES:
- Situations: Personal, Social, National, International. Rotate Axis and Scope.
- Tone: Dramatic, short sentences, direct address.
- Constraints: Dilemma max 3 sentences. Generate exactly 3 UNIQUE and distinct actions per dilemma.
- Action Variety: Each action must lead in a different thematic or ideological direction.
- Forbidden: DO NOT number the actions (no "(1)", "(2)", etc. in titles). DO NOT repeat the same option.
- **Support Shift Logic**: Do NOT use pre-baked attitudes. Instead, perform a REALISTIC situational analysis: Given the player's Role, the Setting, and their last Decision, how would these specific entities (Population/Opposition/Personal Anchor) react?
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
CRITICAL: The "axisPills" array MUST only contain the English IDs: "democracy", "autonomy", "totalism", "oligarchy", "heteronomy", "liberalism". DO NOT translate these keys.
`;
}

// ----------------------------------------------------------------------------
// 3. USER PROMPT (Turn Inputs)
// ----------------------------------------------------------------------------
export function buildFreePlayUserPrompt(day, playerChoice, lastTopic, consecutiveDays) {
  if (day === 1) {
    return `Establish the physical scene and present a concrete problem requiring an immediate decision.
Based on the Role and Setting, identify which philosophical poles (democracy, autonomy, etc.) would be established as the foundation or reinforced by this initial situation.
Include these in the "axisPills" array.`;
  }

  const topicInstruction = consecutiveDays >= 2
    ? `MANDATORY: Switch the topic completely (Previous: ${lastTopic}).`
    : `Continue or evolve the topic: ${lastTopic}.`;

  return `DAY ${day}.
Last choice: "${playerChoice.title}"

1. **BRIDGE**: Show the consequence of the player's choice.
2. **TOPIC**: ${topicInstruction}
3. **MIRROR**: Add a witty judgment.
4. **AXIS**: Analyze the player's last choice ("${playerChoice.title}") and identify which poles (1-2 max) it reinforced. Include these in "axisPills".

Generate the next dilemma with exactly 3 UNIQUE and non-numbered actions.`;
}
