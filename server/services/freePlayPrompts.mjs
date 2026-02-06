/**
 * server/services/freePlayPrompts.mjs
 * 
 * New, lightweight prompts tailored for Gemini to power the "Free Play" mode.
 * Focus: High speed, natural spoken language, role-anchored realism.
 */

// ----------------------------------------------------------------------------
// 1. INTRO GENERATION
// ----------------------------------------------------------------------------
export function buildFreePlayIntroSystemPrompt(role, setting, playerName, emphasis, gender, tone = "serious", systemName, year, roleExperience, messenger) {
  const roleLine = role || "Unknown Role";
  const settingLine = setting || "Unknown Setting";
  const sysLine = systemName ? `SYSTEM: Ground the story in the "${systemName}" political framework.` : "";
  const yearLine = year ? `ERA: The year is ${year}.` : "";
  const expLine = roleExperience ? `ROLE FEEL: ${roleExperience}` : "";
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
${sysLine}
${yearLine}
${expLine}
${emphasisLine}
${genderLine}

INSTRUCTIONS:
- Directly address the player as "you". 
- Place them physically in the scene (sights, sounds).
- Establish the weight of their specific position based on the ROLE FEEL and ERA.
- **Grounding**: Seamlessly integrate the provided EMPHASIS/OBJECTIVE into the narrative. It should feel like a core, grounded part of the situation, not a tagged-on instruction.
  3. "Personal Anchor": This should be the player's ${messenger && messenger !== 'NA' ? messenger : 'Mother ("Mom")'}. ${messenger && messenger !== 'NA' ? `They represent the player's primary point of contact and confidant.` : `She represents personal empathy, family stakes, and the weight of conscience.`}
  - Choose a relevant emoji icon for each.
  - Provide a short "summary" (1 sentence) of their current stance/mood toward the player.

POV & STYLE:
- The narrator is the "Personal Anchor" (${messenger && messenger !== 'NA' ? messenger : 'Mom'}).
- Address the player directly (e.g., "My Liege," "Hello neighbor," "Dear child") based on the role and messenger type.
- Maintain the selected tone (${tone.toUpperCase()}) throughout.

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
  const { role, setting, playerName, emphasis, language, gender, tone = "serious", supportEntities, bonusObjective, objectiveStatus, messenger } = context;
  const lang = language === 'he' ? "Hebrew (Natural/Spoken)" : "English";
  const genderGrammar = gender === 'female' ? 'FEMALE' : (gender === 'other' ? 'MALE PLURAL' : 'MALE');
  const entities = supportEntities ? supportEntities.map(e => `- ${e.name} (${e.type}): ${e.summary}`).join('\n') : "";

  const objectiveSection = bonusObjective ? `
BONUS OBJECTIVE: "${bonusObjective}" (Current Status: ${objectiveStatus || 'incomplete'})
If the objective is "incomplete": 
1. Raising tension: Start or evolve dilemmas that make achieving this objective difficult. 
2. Real Opposition: Ground the resistance in the ${setting} setting and political system.
3. Clever Progress: If the player chooses a clever or strategic action that aligns with the objective, acknowledge it and allow significant progress.
4. Completion Check: If the player's last choice finally achieves the objective, you MUST set "objectiveStatus": "completed" in your JSON response and celebrate it in the narrative before moving to a new topic.
` : "";

  return `STRICT: ALL GENERATED CONTENT (except JSON keys) MUST BE IN ${lang.toUpperCase()}.
Translate any English context or instructions provided below into ${lang}.

MISSION:
Game Master for ${playerName}. Role: ${role}, Setting: ${setting}. ${emphasis ? `Focus: ${emphasis}.` : ""}
Deliver fast, dramatic dilemmas. Output ONLY JSON. Use ${genderGrammar} grammar.
${objectiveSection}

ENTITIES:
${entities}

AXES:
1. Autonomy (Self-authored) vs Heteronomy (External deference).
2. Liberalism (Private sphere/rights) vs Totalism (Group goals/order).
3. Democracy (Broad power) vs Oligarchy (Elite power).

RULES:
- Situations: Personal, Social, National, International. Rotate Axis and Scope.
- Persona: ${messenger && messenger !== 'NA' ? messenger : (tone === 'satirical' ? 'The Satirical Oracle' : 'Cold Narrator')}.
- Address the player directly (e.g., "My Liege," "Hello neighbor") based on the role and messenger type.
${tone === 'satirical'
      ? "- Style: SNAPPY, cynically funny, absurdist. Use dark humor. Highlight the ridiculousness of political choices."
      : "- Style: DRAMATIC, direct, sharp, and weighty."}
${tone === 'satirical'
      ? "- Tone: Witty, biting, cynical, short sentences."
      : "- Tone: Dramatic, short sentences, direct address."}
- **Narrative Evolution**: Explore the core "Emphasis" through different lenses. Ground the choice of dilemmas in this theme.
- Constraints: Dilemma max 2-3 sentences. Generate exactly 3 UNIQUE and distinct actions per dilemma.
- Action Variety: Each action must lead in a different thematic or ideological direction.
- Forbidden: DO NOT number the actions. DO NOT repeat the same option.
- **Support Shift Logic**: Real-time situational analysis.
- **Support توضیحات (shortLine)**: Natural phrasing, max 1 short sentence.
- Allowed attitudeLevel: "strongly_supportive", "moderately_supportive", "slightly_supportive", "slightly_opposed", "moderately_opposed", "strongly_opposed".
- Support: Identify "axisPills" (poles boosted by choice).

SCHEMA:
{
  "supportShift": {
    "people": {"attitudeLevel": "...", "shortLine": "..."},
    "holders": {"attitudeLevel": "...", "shortLine": "..."},
    "mom": {"attitudeLevel": "...", "shortLine": "... (Note: this is from ${messenger && messenger !== 'NA' ? messenger : 'Mom'})"}
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
  "axisPills": ["democracy", "totalism", "etc"],
  "objectiveStatus": "incomplete" | "completed"
}
CRITICAL: The "axisPills" array MUST only contain the English IDs. Leave empty on Day 1.
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
