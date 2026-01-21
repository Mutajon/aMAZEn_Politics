import { getCountersCollection, incrementCounter } from "../db/mongodb.mjs";
import { getConversation, storeConversation, deleteConversation } from "../services/conversationStore.mjs";
import { callGeminiChat, safeParseJSON, stripMarkdownCodeBlocks } from "../utils/ai.mjs";
import { LANGUAGE_NAMES } from "../config/constants.mjs";
import { MODEL_VALIDATE_GEMINI } from "../config/config.mjs";
import {
    calculateAuthorityLevel,
    extractChallengerName,
    convertSupportShiftToDeltas
} from "../helpers/gameHelpers.mjs";
import {
    buildGameMasterSystemPromptUnifiedV3,
    buildGameMasterUserPrompt
} from "../services/promptBuilders.mjs";
import { getTheoryPrompt } from "../theory-loader.mjs";

/**
 * USE_PROMPT_V3: Toggle between original prompt and V3 (value-driven, private life focus)
 * V3 Features:
 * - Ultra-lean 3-step process (Value → Axis → Bridge)
 * - Private life focus for low/mid authority
 * - Setting-rooted details
 * - Dynamic axis selection (max 3 per axis)
 */
const USE_PROMPT_V3 = true;

/**
 * POST /api/reserve-game-slot
 */
export async function reserveGameSlot(req, res) {
    try {
        const countersCollection = await getCountersCollection();

        // New Logic: "games_remaining" counts DOWN to zero.
        // We want only 1 variable to manage the limit.

        // 1. Try to decrement the counter if it's > 0
        const result = await countersCollection.findOneAndUpdate(
            { name: 'games_remaining', value: { $gt: 0 } },
            { $inc: { value: -1 } },
            { returnDocument: 'after' }
        );

        if (result) {
            // Successfully reserved a slot
            console.log(`[Reserve Slot] Slot reserved. Remaining: ${result.value}`);
            res.json({ success: true, gamesRemaining: result.value });
        } else {
            // Failed to decrement. Either capped (<=0) or doesn't exist.
            const existingCounter = await countersCollection.findOne({ name: 'games_remaining' });

            if (!existingCounter) {
                // Initialize the counter for the first time
                // Default to 250 since we aren't using the ENV var anymore
                const initialLimit = 250;

                // We assume this request consumes one slot, so we set it to (initial - 1)
                const startValue = Math.max(0, initialLimit - 1);

                await countersCollection.insertOne({
                    name: 'games_remaining',
                    value: startValue
                });

                console.log(`[Reserve Slot] Initialized 'games_remaining' to ${startValue} (default ${initialLimit})`);
                res.json({ success: true, gamesRemaining: startValue });
            } else {
                // Counter exists and is <= 0
                console.log(`[Reserve Slot] Game limit reached. Remaining: ${existingCounter.value}`);
                res.status(403).json({
                    success: false,
                    message: "The game has reached its player limit.",
                    isCapped: true,
                });
            }
        }
    } catch (error) {
        console.error("Error in /api/reserve-game-slot:", error?.message || error);
        res.status(500).json({ success: false, error: "Failed to reserve game slot" });
    }
}

/**
 * POST /api/game-turn-v2
 * Main game loop handler
 */
export async function gameTurnV2(req, res) {
    try {
        console.log("\n========================================");
        console.log("🎮 [GAME-TURN-V2] /api/game-turn-v2 called");
        console.log("========================================\n");

        const {
            gameId,
            day,
            totalDays = 7,
            isFirstDilemma,
            isFollowUp,
            playerChoice, // Day 2+ only
            gameContext, // Day 1 only
            dilemmasSubjectEnabled = false,
            dilemmasSubject = null,
            generateActions = true,
            useXAI = false,
            useGemini = false,
            debugMode = false,
            language = 'he' // Get language from client (default: Hebrew)
        } = req.body;

        // Validation
        if (!gameId || typeof gameId !== 'string') {
            return res.status(400).json({ error: "Missing or invalid gameId" });
        }

        if (!day || typeof day !== 'number' || day < 1 || day > 8) {
            return res.status(400).json({ error: "Missing or invalid day (must be 1-8)" });
        }

        console.log(`[GAME-TURN-V2] gameId=${gameId}, day=${day}, isFirstDilemma=${isFirstDilemma}, language=${language}`);

        // Get or create conversation
        let conversation = getConversation(gameId);
        const daysLeft = totalDays - day + 1;
        const isAftermathTurn = daysLeft <= 0;

        // ========================================================================
        // DAY 1: Initialize conversation with unified system prompt
        // ========================================================================
        if (isFirstDilemma && day === 1) {
            if (!gameContext) {
                return res.status(400).json({ error: "Missing gameContext for Day 1" });
            }

            console.log('[GAME-TURN-V2] Day 1 - Initializing conversation with unified prompt');

            // Extract and prepare game context
            const challengerName = extractChallengerName(gameContext.challengerSeat);

            // CRITICAL: Calculate authorityLevel and OVERRIDE frontend value
            const frontendAuthorityLevel = gameContext.authorityLevel;
            const authorityLevel = calculateAuthorityLevel(
                gameContext.e12,
                gameContext.powerHolders,
                gameContext.playerIndex,
                gameContext.roleScope
            );

            // Log authority level calculation for debugging
            if (frontendAuthorityLevel !== authorityLevel) {
                console.log(`[AUTHORITY] Frontend sent: "${frontendAuthorityLevel}" → Backend calculated: "${authorityLevel}"`);
            } else {
                console.log(`[AUTHORITY] Authority level: "${authorityLevel}"`);
            }

            // Override gameContext with correct authority level
            gameContext.authorityLevel = authorityLevel;

            // Build enriched context (minimal - only what's needed for system prompt)
            const enrichedContext = {
                role: gameContext.role,
                systemName: gameContext.systemName,
                setting: gameContext.setting,
                challengerName,
                powerHolders: gameContext.powerHolders,
                authorityLevel,
                playerCompassTopValues: gameContext.playerCompassTopValues
            };

            // Extract character info (name, gender) for personalization
            const character = gameContext.character ? {
                name: gameContext.character.name || gameContext.role || 'Leader',
                gender: gameContext.character.gender || 'any'
            } : null;

            // Extract grounding (historical/cultural setting context)
            const grounding = gameContext.grounding || gameContext.setting || null;

            // Build unified system prompt (sent ONCE)
            // Use V3 if feature flag enabled, otherwise use original
            const languageCode = String(language || "en").toLowerCase();
            const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
            const dilemmaEmphasis = gameContext.dilemmaEmphasis || null;
            const systemPrompt = USE_PROMPT_V3
                ? buildGameMasterSystemPromptUnifiedV3(enrichedContext, languageCode, languageName, dilemmaEmphasis, character, grounding)
                : buildGameMasterSystemPromptUnified(enrichedContext, languageCode, languageName);

            // Build minimal Day 1 user prompt
            const userPrompt = buildGameMasterUserPrompt(day, null, null, 'dilemma', languageCode, languageName, dilemmaEmphasis);

            // Debug logging (Day 1 request payload)
            if (debugMode) {
                console.log("\n" + "=".repeat(80));
                console.log("🐛 [DEBUG] Day 1 - Request Payload:");
                console.log("=".repeat(80));
                console.log(JSON.stringify({
                    gameId,
                    day,
                    totalDays,
                    isFirstDilemma: true,
                    generateActions,
                    useXAI,
                    language: languageCode,
                    gameContext: {
                        role: enrichedContext.role,
                        systemName: enrichedContext.systemName,
                        setting: enrichedContext.setting,
                        challengerName: enrichedContext.challengerName,
                        authorityLevel: enrichedContext.authorityLevel,
                        powerHoldersCount: enrichedContext.powerHolders?.length || 0,
                        topPowerHolders: enrichedContext.powerHolders?.slice(0, 3).map(ph => `${ph.name} (${ph.power}%)`),
                        playerCompassTopValues: enrichedContext.playerCompassTopValues,
                    },
                    promptMetadata: {
                        systemPromptLength: systemPrompt.length,
                        systemPromptTokens: Math.ceil(systemPrompt.length / 4),
                        userPromptLength: userPrompt.length,
                        userPromptTokens: Math.ceil(userPrompt.length / 4)
                    }
                }, null, 2));
                console.log("=".repeat(80) + "\n");
            }

            // Call AI with retry logic for JSON parsing failures
            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            let parsed;
            let content;
            const maxRetries = 1;

            for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
                // Add correction message on retry
                if (retryCount > 0) {
                    console.log(`[GAME-TURN-V2] JSON parse failed, retrying Day 1 (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                    messages.push({
                        role: "user",
                        content: "Your response was not valid JSON. Please respond ONLY with the raw JSON object, no markdown code blocks (no ```), no explanations - just the JSON starting with { and ending with }."
                    });
                }

                const aiStart = Date.now();
                const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");
                console.log(`[TIMING] Day 1 AI call took ${Date.now() - aiStart}ms`);

                content = aiResponse?.content;
                if (!content) {
                    throw new Error("No content in AI response");
                }

                // Debug logging (Day 1 AI response)
                if (debugMode) {
                    console.log("\n" + "=".repeat(80));
                    console.log(`🐛 [DEBUG] Day 1 Raw AI Response (attempt ${retryCount + 1}):`);
                    console.log("=".repeat(80));
                    console.log(content);
                    console.log("=".repeat(80) + "\n");
                }

                // Parse JSON response with robust error handling
                // Try existing safeParseJSON utility first (includes markdown stripping)
                parsed = safeParseJSON(content, { debugTag: `GAME-TURN-V2-DAY1-ATTEMPT${retryCount + 1}` });

                // If safeParseJSON fails, try custom comma repair
                if (!parsed) {
                    console.log(`[GAME-TURN-V2] safeParseJSON failed (attempt ${retryCount + 1}), attempting comma repair...`);
                    try {
                        // First strip markdown using our robust function
                        const strippedContent = stripMarkdownCodeBlocks(content);

                        // Fix missing commas: "value"\n"key" -> "value",\n"key"
                        const commaFixed = strippedContent.replace(/("\s*)\n(\s*"[^"]+"\s*:)/g, '$1,\n$2');
                        parsed = JSON.parse(commaFixed);
                        console.log('[GAME-TURN-V2] ✅ Comma repair successful');
                    } catch (commaError) {
                        console.error(`[GAME-TURN-V2] Comma repair failed (attempt ${retryCount + 1}):`, commaError.message);
                    }
                }

                // If parsing succeeded, break out of retry loop
                if (parsed) {
                    if (retryCount > 0) {
                        console.log(`[GAME-TURN-V2] ✅ JSON parsing succeeded on retry attempt ${retryCount + 1}`);
                    }
                    break;
                }

                // If this was the last attempt and still no parsed result, throw error
                if (retryCount === maxRetries && !parsed) {
                    console.error('[GAME-TURN-V2] All JSON parse attempts failed after retries (Day 1)');
                    console.error('[GAME-TURN-V2] Raw content:', content);
                    throw new Error(`Failed to parse AI response after ${maxRetries + 1} attempts`);
                }
            }

            // Add assistant response to messages
            messages.push({ role: "assistant", content: content });

            // Store conversation with minimal meta (for reference only)
            const conversationMeta = {
                role: gameContext.role,
                systemName: gameContext.systemName,
                challengerName,
                authorityLevel,
                dilemmaEmphasis, // Store for Day 2+ reminders
                topicHistory: [{
                    day: 1,
                    topic: parsed.dilemma?.topic || 'Unknown',
                    scope: parsed.dilemma?.scope || 'Unknown',
                    tensionCluster: parsed.dilemma?.tensionCluster || 'Unknown'
                }],
                clusterCounts: {
                    [parsed.dilemma?.tensionCluster || 'Unknown']: 1
                }
            };

            // FIXED: Store messages array properly in conversation.messages field
            storeConversation(gameId, gameId, useXAI ? "xai" : "openai", { ...conversationMeta, messages });

            console.log('[GAME-TURN-V2] Day 1 complete, conversation stored with unified system prompt');

            // Log Day 1 tension cluster
            const day1Cluster = parsed.dilemma?.tensionCluster || 'Unknown';
            console.log(`[TENSION] ✅ Day 1: "${day1Cluster}" (count: 1/2, prev: "none")`);
            console.log(`[TENSION] Cluster usage: ${day1Cluster}:1`);

            // Log mirror advice for debugging
            console.log("[game-turn-v2] Mirror advice generated (Day 1):", parsed.mirrorAdvice);

            // Debug: Track topic/scope/tensionCluster variety
            if (debugMode) {
                logTopicScopeDebug(
                    gameId,
                    day,
                    parsed.dilemma?.topic || 'Unknown',
                    parsed.dilemma?.scope || 'Unknown',
                    parsed.dilemma?.tensionCluster || 'Unknown',
                    parsed.dilemma?.title || 'Untitled',
                    [] // Day 1 has no history
                );
            }

            // Return response (flattened for frontend compatibility)
            const response = {
                title: parsed.dilemma?.title || '',
                description: parsed.dilemma?.description || '',
                actions: parsed.dilemma?.actions || [],
                topic: parsed.dilemma?.topic || '',
                scope: parsed.dilemma?.scope || '',
                mirrorAdvice: parsed.mirrorAdvice,
                isGameEnd: false
            };

            // Add tracking fields if using V3 (for frontend validation)
            if (USE_PROMPT_V3) {
                response.valueTargeted = parsed.valueTargeted || 'Unknown';
                response.axisExplored = parsed.axisExplored || 'Unknown';
            }

            return res.json(response);
        }

        // ========================================================================
        // DAY 2+: Append to conversation history (NO new system prompt)
        // ========================================================================
        if (isFollowUp && day > 1) {
            if (!conversation || !conversation.meta.messages) {
                return res.status(400).json({ error: "No conversation found for this gameId" });
            }

            if (!playerChoice) {
                return res.status(400).json({ error: "Missing playerChoice for Day 2+" });
            }

            console.log(`[GAME-TURN-V2] Day ${day} - Appending to conversation history`);

            // Extract current compass values from payload (Day 2+)
            const currentCompassTopValues = req.body.currentCompassTopValues || null;

            if (currentCompassTopValues) {
                console.log(`[GAME-TURN-V2] Day ${day} - Current top values received:`, currentCompassTopValues);
            }

            // Determine mirror mode for Days 2-7 (50/50 random between reflecting on last action vs current dilemma)
            const mirrorMode = Math.random() < 0.5 ? 'lastAction' : 'dilemma';
            console.log(`[GAME-TURN-V2] Day ${day} - Mirror mode: ${mirrorMode}`);

            // Build Day 2+ user prompt with current compass values and mirror mode
            const languageCode = String(language || "en").toLowerCase();
            const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
            const dilemmaEmphasis = conversation.meta.dilemmaEmphasis || null;
            const userPrompt = buildGameMasterUserPrompt(day, playerChoice, currentCompassTopValues, mirrorMode, languageCode, languageName, dilemmaEmphasis);

            // Prepare messages array (history + new user message)
            const messages = [
                ...conversation.meta.messages,
                { role: "user", content: userPrompt }
            ];

            // Debug logging (Day 2+ request payload)
            if (debugMode) {
                const daysLeft = totalDays - day;
                console.log("\n" + "=".repeat(80));
                console.log(`🐛 [DEBUG] Day ${day} - Request Payload:`);
                console.log("=".repeat(80));
                console.log(JSON.stringify({
                    gameId,
                    day,
                    totalDays,
                    daysLeft,
                    isFollowUp: true,
                    generateActions,
                    useXAI,
                    language: languageCode,
                    playerChoice: {
                        title: playerChoice?.title,
                        description: playerChoice?.description,
                        cost: playerChoice?.cost,
                        iconHint: playerChoice?.iconHint
                    },
                    conversationMetadata: {
                        messageCount: messages.length,
                        userPromptLength: userPrompt.length,
                        userPromptTokens: Math.ceil(userPrompt.length / 4),
                        totalConversationTokens: Math.ceil(messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4)
                    }
                }, null, 2));
                console.log("=".repeat(80) + "\n");
            }

            // Call AI with retry logic for JSON parsing failures
            let parsed;
            let content;
            const maxRetries = 1;

            for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
                // Add correction message on retry
                if (retryCount > 0) {
                    console.log(`[GAME-TURN-V2] JSON parse failed, retrying (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                    messages.push({
                        role: "user",
                        content: "Your response was not valid JSON. Please respond ONLY with the raw JSON object, no markdown code blocks (no ```), no explanations - just the JSON starting with { and ending with }."
                    });
                }

                const aiStart = Date.now();
                const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");
                console.log(`[TIMING] Day ${day} AI call took ${Date.now() - aiStart}ms`);

                content = aiResponse?.content;
                if (!content) {
                    throw new Error("No content in AI response");
                }

                // Debug logging (Day 2+ AI response)
                if (debugMode) {
                    console.log("\n" + "=".repeat(80));
                    console.log(`🐛 [DEBUG] Day ${day} Raw AI Response (attempt ${retryCount + 1}):`);
                    console.log("=".repeat(80));
                    console.log(content);
                    console.log("=".repeat(80) + "\n");
                }

                // Parse JSON response with robust error handling
                // Try existing safeParseJSON utility first (includes markdown stripping)
                parsed = safeParseJSON(content, { debugTag: `GAME-TURN-V2-DAY2+-ATTEMPT${retryCount + 1}` });

                // If safeParseJSON fails, try custom comma repair
                if (!parsed) {
                    console.log(`[GAME-TURN-V2] safeParseJSON failed (attempt ${retryCount + 1}), attempting comma repair...`);
                    try {
                        // First strip markdown using our robust function
                        const strippedContent = stripMarkdownCodeBlocks(content);

                        // Fix missing commas: "value"\n"key" -> "value",\n"key"
                        const commaFixed = strippedContent.replace(/("\s*)\n(\s*"[^"]+"\s*:)/g, '$1,\n$2');
                        parsed = JSON.parse(commaFixed);
                        console.log('[GAME-TURN-V2] ✅ Comma repair successful');
                    } catch (commaError) {
                        console.error(`[GAME-TURN-V2] Comma repair failed (attempt ${retryCount + 1}):`, commaError.message);
                    }
                }

                // If parsing succeeded
                if (parsed) {
                    if (retryCount > 0) {
                        console.log(`[GAME-TURN-V2] ✅ JSON parsing succeeded on retry attempt ${retryCount + 1}`);
                    }
                    break;
                }

                // If this was the last attempt and still no parsed result, throw error
                if (retryCount === maxRetries && !parsed) {
                    console.error('[GAME-TURN-V2] All JSON parse attempts failed after retries');
                    console.error('[GAME-TURN-V2] Raw content:', content);
                    throw new Error(`Failed to parse AI response after ${maxRetries + 1} attempts`);
                }
            }

            // Get existing topic history (used by both topic/scope and tension cluster validation)
            const existingTopicHistory = conversation.meta.topicHistory || [];

            // TENSION CLUSTER VALIDATION + RE-PROMPT
            // DISABLED: Testing if Gemini model follows instructions without validation
            const ALL_CLUSTERS = ['ExternalConflict', 'InternalPower', 'EconomyResources', 'HealthDisaster', 'ReligionCulture', 'LawJustice', 'SocialOrder', 'FamilyPersonal', 'DiplomacyTreaty'];
            const clusterCounts = { ...(conversation.meta.clusterCounts || {}) };

            const prevCluster = existingTopicHistory.length > 0
                ? existingTopicHistory[existingTopicHistory.length - 1].tensionCluster
                : null;
            let currentCluster = parsed.dilemma?.tensionCluster || 'Unknown';

            // Check violation: max 2 per game (consecutive repeats are allowed)
            const isOverMax = currentCluster !== 'Unknown' && (clusterCounts[currentCluster] || 0) >= 2;

            if (false && isOverMax) {
                // [Re-prompt logic omitted as it was disabled in source]
            }

            // Update cluster counts
            clusterCounts[currentCluster] = (clusterCounts[currentCluster] || 0) + 1;

            // Enhanced logging
            const countStr = Object.entries(clusterCounts).map(([k, v]) => `${k}:${v}`).join(', ');
            console.log(`[TENSION] ✅ Day ${day}: "${currentCluster}" (count: ${clusterCounts[currentCluster]}/2, prev: "${prevCluster || 'none'}")`);
            console.log(`[TENSION] Cluster usage: ${countStr}`);

            // Hybrid support shift validation
            let supportShift = null;
            if (parsed.supportShift) {
                // Starting support is always 50%, AI tracks shifts through conversation
                const currentSupport = {
                    people: 50,
                    holders: 50,
                    mom: 50
                };

                // Convert AI reactions to numeric deltas with randomization and caps
                supportShift = convertSupportShiftToDeltas(parsed.supportShift, currentSupport);
            }

            // Process dynamic params (no validation, just max 3)
            const dynamicParams = processDynamicParams(parsed.dynamicParams);

            // Update conversation messages
            const updatedMessages = [
                ...conversation.meta.messages,
                { role: "user", content: userPrompt },
                { role: "assistant", content: content }
            ];

            // Get existing topic history and add current day (use currentCluster which may have been updated by re-prompt)
            const topicHistory = conversation.meta.topicHistory || [];
            topicHistory.push({
                day,
                topic: parsed.dilemma?.topic || 'Unknown',
                scope: parsed.dilemma?.scope || 'Unknown',
                tensionCluster: currentCluster,
                title: parsed.dilemma?.title || '',        // For semantic similarity validation
                description: parsed.dilemma?.description || ''  // For semantic similarity validation
            });

            // Update meta with new messages array, topic history, and cluster counts
            const updatedMeta = {
                ...conversation.meta,
                messages: updatedMessages,
                topicHistory,
                clusterCounts
            };

            // FIXED: Store updated messages properly
            storeConversation(gameId, gameId, conversation.provider, updatedMeta);

            console.log(`[GAME-TURN-V2] Day ${day} complete, conversation updated (${updatedMessages.length} total messages)`);

            // Log mirror advice for debugging
            console.log(`[game-turn-v2] Mirror advice generated (Day ${day}):`, parsed.mirrorAdvice);

            // Debug: Track topic/scope/tensionCluster variety
            if (debugMode) {
                logTopicScopeDebug(
                    gameId,
                    day,
                    parsed.dilemma?.topic || 'Unknown',
                    parsed.dilemma?.scope || 'Unknown',
                    currentCluster,
                    parsed.dilemma?.title || 'Untitled',
                    topicHistory.slice(0, -1) // Pass history without current day for comparison
                );
            }

            // Cleanup: ensure description exists
            let cleanDescription = parsed.dilemma?.description || '';

            // Return response (flattened for frontend compatibility)
            const response = {
                title: parsed.dilemma?.title || '',
                description: cleanDescription,
                bridge: '', // Bridge is now integrated into description
                actions: parsed.dilemma?.actions || [],
                topic: parsed.dilemma?.topic || '',
                scope: parsed.dilemma?.scope || '',
                supportShift,
                dynamicParams,
                mirrorAdvice: parsed.mirrorAdvice,
                isGameEnd: isAftermathTurn
            };

            // Add tracking fields if using V3 (for frontend validation)
            if (USE_PROMPT_V3) {
                response.valueTargeted = parsed.valueTargeted || 'Unknown';
                response.axisExplored = parsed.axisExplored || 'Unknown';
            }

            // Log bridge field for debugging
            if (day > 1) {
                console.log(`[GAME-TURN-V2] Day ${day} bridge: "${response.bridge || '(none)'}"`);
            }

            return res.json(response);
        }

        // If we get here, invalid request
        return res.status(400).json({ error: "Invalid request - must be Day 1 with gameContext or Day 2+ with playerChoice" });

    } catch (error) {
        console.error("[GAME-TURN-V2] ❌ Error:", error);
        return res.status(500).json({
            error: "Game turn generation failed",
            message: error?.message || "Unknown error"
        });
    }
}

/**
 * POST /api/game-turn/cleanup
 * Cleanup conversation state when game ends
 */
export async function gameTurnCleanup(req, res) {
    try {
        const { gameId } = req.body || {};

        // Validation
        if (!gameId || typeof gameId !== "string") {
            return res.status(400).json({ error: "Missing or invalid gameId" });
        }

        console.log(`\n[Cleanup] 🧹 Cleaning up conversations for gameId=${gameId}`);

        // Delete main game conversation
        deleteConversation(gameId);
        console.log(`[Cleanup] ✅ Deleted main game conversation: ${gameId}`);

        // Delete compass conversation
        deleteConversation(`compass-${gameId}`);
        console.log(`[Cleanup] ✅ Deleted compass conversation: compass-${gameId}`);

        return res.json({ success: true });

    } catch (error) {
        console.error("[Cleanup] ❌ Error:", error);
        return res.status(500).json({
            error: "Cleanup failed",
            message: error?.message || "Unknown error"
        });
    }
}

// ==================== HELPERS ====================

/**
 * Debug tracker for topic/scope/tensionCluster variety
 */
function logTopicScopeDebug(gameId, day, topic, scope, tensionCluster, title, topicHistory) {
    const warnings = [];

    // Rule 1: Check if same topic+scope as previous day
    if (topicHistory.length > 0) {
        const prev = topicHistory[topicHistory.length - 1];
        if (prev.topic === topic && prev.scope === scope) {
            warnings.push(`same topic+scope as Day ${prev.day}`);
        }
    }

    // Rule 2: Check topic variety in last 3 days
    if (topicHistory.length >= 2) {
        const last2 = topicHistory.slice(-2);
        const topics = new Set([...last2.map(h => h.topic), topic]);
        if (topics.size === 1) {
            warnings.push(`only 1 topic in last 3 days (${topic})`);
        }
    }

    // Rule 3: Check scope variety in last 3 days
    if (topicHistory.length >= 2) {
        const last2 = topicHistory.slice(-2);
        const scopes = new Set([...last2.map(h => h.scope), scope]);
        if (scopes.size === 1) {
            warnings.push(`only 1 scope in last 3 days (${scope})`);
        }
    }

    // Note: Consecutive tensionCluster repeats are allowed, only max-2 per game is enforced
    const prevCluster = topicHistory.length > 0 ? topicHistory[topicHistory.length - 1].tensionCluster : null;

    // Log with warnings if any
    const warnStr = warnings.length > 0 ? ` [⚠️  WARN: ${warnings.join(', ')}]` : ' [✅ OK]';
    console.log(`[TOPIC] gameId=${gameId} Day=${day} topic=${topic} scope=${scope} cluster=${tensionCluster} title="${title}"${warnStr}`);

    // Extra tension cluster log for easy filtering
    console.log(`[TENSION] Day ${day}: ${tensionCluster} (prev: ${prevCluster || 'none'})`);
}

/**
 * Helper to process dynamic params
 * No validation - trust AI output completely
 */
function processDynamicParams(params) {
    if (!params || params.length === 0) {
        console.log('[DYNAMIC-PARAMS] No params provided by AI');
        return []; // Allow empty
    }

    // Just enforce max 3 params, no other validation
    const processed = params.slice(0, 3);
    console.log(`[DYNAMIC-PARAMS] Received ${params.length} params, returning ${processed.length}`);
    return processed;
}

/**
 * POST /api/aftermath
 * Generate game conclusion/epilogue
 */
export async function generateAftermath(req, res) {
    try {
        const {
            gameId,
            playerName,
            role,
            setting,
            systemName,
            dilemmaHistory,
            finalSupport,
            topCompassValues,
            debug,
            language = 'en' // Get language from client (default: English)
        } = req.body || {};

        if (debug) {
            console.log("[/api/aftermath] Request received:", {
                gameId,
                playerName,
                role,
                setting,
                systemName,
                historyLength: dilemmaHistory?.length,
                finalSupport,
                topCompassValues,
            });
        }
        // Build system prompt using EXACT text from user's preliminary plan
        const languageCode = String(language || "en").toLowerCase();
        const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
        const system = `PLAYER ROLE & CONTEXT:
- Setting: ${setting || role || "Unknown Setting"}
- Player Role: ${role || "Unknown Role"}
- Political System: ${systemName || "Unknown System"}

STYLE & TONE
Write in clear, vivid, reflective language; no jargon or game terms.
Tone: ironic-cinematic, like a historical epilogue (Reigns, Frostpunk, Democracy 3).
Accessible for teens; mix wit with weight.
Use roles/descriptions, not obscure names.
${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}. Use proper grammar and natural phrasing appropriate for ${languageName} speakers.` : ''}

CONTENT
Generate an in-world epilogue for the leader based on their decisions, outcomes, supports, and values.
Follow this structure:

Intro: Write an opening sentence about the player's death. Use their actual name and role. Vary the time span realistically (NOT always 7 years)—could be months, years, or decades depending on the setting and events. Choose a fitting cause of death based on the role, era, and story.

Snapshot: Analyze all 7 decisions for EXTREME consequences. Generate 6-10 dramatic events representing the most significant impacts (both positive and negative). For each event:
- type: "positive" or "negative"
- icon: single emoji (⚔️ 🏥 💀 🏛️ 🔥 📚 ⚖️ 💰 🌾 🗡️ etc.)
- text: 3-6 words, extremely dramatic and concise. these can include numeric estimates, try to make them realistic based on current role and setting.
- context: brief mention of which decision/day caused this

Examples:
- War declared → {"type": "negative", "icon": "⚔️", "text": "15,000 deaths in Spartan war", "context": "Day 3: Rejected peace"}
- Healthcare reform → {"type": "positive", "icon": "🏥", "text": "340,000 citizens gain medical access", "context": "Day 5: Medical reform"}
- Famine → {"type": "negative", "icon": "🌾", "text": "8,500 famine deaths from blockade", "context": "Day 4: Trade sanctions"}
- Infrastructure → {"type": "positive", "icon": "🌾", "text": "800 acres of new farmland", "context": "Day 6: Agricultural reform"}
- Riots → {"type": "negative", "icon": "🔥", "text": "47 buildings burned in riots", "context": "Day 2: Tax increase"}
- New government → {"type": "positive", "icon": "🏛️", "text": "Democratic assembly founded", "context": "Day 2: Constitutional reform"}

Use realistic historical estimates based on the era and population. Prioritize MAGNITUDE over balance—show only the most extreme events. Use mixed approach: numbers for quantifiable events (wars, deaths, people saved), vivid descriptions for qualitative changes (new institutions, cultural shifts).

Decisions: for each decision, provide:
- title: ≤12-word summary of the action taken
- reflection: one SHORT sentence (~15-25 words) that EXPLAINS WHY this specific decision demonstrates support for or opposition to autonomy/heteronomy AND liberalism/totalism. Be concrete and educational—describe what aspect of the decision shows the ideological position rather than just stating the rating.
- autonomy: rate THIS SPECIFIC DECISION on autonomy (very-low|low|medium|high|very-high)
- liberalism: rate THIS SPECIFIC DECISION on liberalism (very-low|low|medium|high|very-high)
- democracy: rate THIS SPECIFIC DECISION on democracy (very-low|low|medium|high|very-high)

${getTheoryPrompt()}RATING FRAMEWORK (use the theoretical frameworks above for detailed guidance):

1. Autonomy ↔ Heteronomy (Who decides?)
   - High Autonomy: Self-direction, owned reasons ("I choose because…"), empowering individual/group choice, decentralized decision-making, willingness to accept responsibility for consequences.
   - Low Autonomy (Heteronomy): External control, borrowed reasons ("because they/it says so"), imposed rules, top-down mandates, frequent delegation or obedience without personal justification.

2. Liberalism ↔ Totalism (What's valued?)
   - High Liberalism: Individual rights, pluralism, tolerance, protecting freedoms, narrow and proportionate limits justified by concrete harms, acceptance of multiple legitimate ways to live.
   - Low Liberalism (Totalism): Uniformity, order or virtue over freedom, suppressing dissent, enforcing one thick moral/ideological code as the proper way to live, broad or indefinite restrictions on expression and lifestyle.

3. Democracy ↔ Oligarchy (Who authors the rules and exceptions?)
   - High Democracy: Broad and inclusive authorship of rules and exceptions (citizens, assemblies, representative bodies), real checks and vetoes (courts, elections, free media), shocks handled through shared procedures rather than personal rule.
   - Low Democracy (Oligarchy): Concentrated control of rules and exceptions in a narrow elite (executive, generals, party, oligarchs), weak or neutralized checks, people treated as a mass to be managed rather than co-authors of decisions.

Examples of good decision entries:
- title: "Deploy troops to quell uprising"
  reflection: "Forceful crackdown demonstrates heteronomy (external control) and totalism (prioritizing order over individual freedoms)"
  autonomy: "very-low"
  liberalism: "very-low"
  democracy: "very-low"

- title: "Hold public referendum on reforms"
  reflection: "Consulting citizens shows autonomy (empowering individual choice) and moderate liberalism (deliberative, slower process)"
  autonomy: "high"
  liberalism: "medium"
  democracy: "very-high"

- title: "State-controlled ceremony with some dissent allowed"
  reflection: "Tightly controlled ceremony reflects heteronomy (state choreography) and liberalism (order without suppressing dissent)"
  autonomy: "low"
  liberalism: "medium"
  democracy: "low"

IMPORTANT: The frontend will calculate overall ratings by averaging all 7 decision ratings. DO NOT provide overall ratings.

Values Summary: one sentence capturing main motivations, justifications, means, and who benefited.

Legacy: Generate one vivid, historically resonant sentence capturing how the player will be remembered. Format: "You will be remembered as [legacy description]". Base this on all decisions, snapshot events, compass values, and overall impact. Make it specific to their actions, not generic. Consider both their intentions and actual consequences. Examples:
- "You will be remembered as the tyrant who drowned dissent in blood."
- "You will be remembered as the cautious reformer who preserved peace at the cost of progress."
- "You will be remembered as the liberator whose bold vision birthed a new era."

Haiku: a 3-line poetic summary of their reign.

OUTPUT (STRICT JSON)
Return only:

{
  "intro": "",
  "snapshot": [{"type": "positive|negative", "icon": "emoji", "text": "", "estimate": number_optional, "context": ""}],
  "decisions": [{"title": "", "reflection": "", "autonomy": "", "liberalism": "", "democracy": ""}],
  "valuesSummary": "",
  "legacy": "",
  "haiku": ""
}`;

        // Build user prompt with game data
        const compassSummary = (topCompassValues || [])
            .map(cv => `${cv.dimension}:${cv.componentName}(${cv.value})`)
            .join(", ");

        const historySummary = (dilemmaHistory || [])
            .map(entry =>
                `Day ${entry.day}: "${sanitizeText(entry.dilemmaTitle)}" → chose "${sanitizeText(entry.choiceTitle)}" (${sanitizeText(entry.choiceSummary)}). ` +
                `Support after: people=${entry.supportPeople}, middle=${entry.supportMiddle}, mom=${entry.supportMom}.`
            )
            .join("\n");

        // Extract conversation history for richer context (if available)
        let conversationContext = "";
        if (gameId) {
            const conversation = getConversation(gameId);
            if (conversation && conversation.messages && Array.isArray(conversation.messages)) {
                // Get last 15 messages (skip system message, focus on user/assistant exchanges)
                const recentMessages = conversation.messages
                    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                    .slice(-15);

                if (recentMessages.length > 0) {
                    conversationContext = "\n\nCONVERSATION EXCERPTS (for narrative context):\n" +
                        recentMessages.map((msg, idx) => {
                            const role = msg.role === 'user' ? 'PLAYER' : 'AI';
                            const content = typeof msg.content === 'string'
                                ? sanitizeText(msg.content).slice(0, 300) // Truncate to 300 chars
                                : '[complex content]';
                            return `${idx + 1}. ${role}: ${content}${content.length >= 300 ? '...' : ''}`;
                        }).join('\n');

                    if (debug) {
                        console.log(`[/api/aftermath] Including ${recentMessages.length} conversation messages for context`);
                    }
                }
            }
        }

        const user = `PLAYER: ${playerName || "Unknown Leader"}
ROLE: ${role || "Unknown Role"}
SYSTEM: ${systemName || "Unknown System"}

FINAL SUPPORT:
- People: ${finalSupport?.people ?? 50}%
- Middle (main power holder): ${finalSupport?.middle ?? 50}%
- Mom (personal allies): ${finalSupport?.mom ?? 50}%

TOP COMPASS VALUES:
${compassSummary || "None"}

DECISION HISTORY:
${historySummary || "No decisions recorded"}${conversationContext}

Generate the aftermath epilogue following the structure above. Return STRICT JSON ONLY.${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}.` : ''}`;

        // Call AI with Gemini model
        // No fallback - let errors propagate so frontend can show retry button
        const messages = [
            { role: "system", content: system },
            { role: "user", content: user }
        ];
        const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");
        const result = aiResponse?.content ? safeParseJSON(aiResponse.content, { debugTag: "aftermath-gemini" }) : null;

        if (debug) {
            console.log("[/api/aftermath] AI response:", result);
        }

        // Normalize and validate response
        const validRatings = ["very-low", "low", "medium", "high", "very-high"];
        const validTypes = ["positive", "negative"];

        // Fallback values when AI returns null or incomplete data
        const fallback = {
            intro: "After many years of rule, the leader passed into history.",
            snapshot: [
                { type: "positive", icon: "🏛️", text: "Governed their people", context: "Overall reign" },
                { type: "negative", icon: "⚠️", text: "Faced challenges", context: "Overall reign" }
            ],
            decisions: [],
            valuesSummary: "A leader who navigated complex political terrain.",
            haiku: "Power came and went\nDecisions echo through time\nHistory records"
        };

        // Detect if we're using fallback data (AI failed or returned incomplete response)
        const isFallback = result === null || !Array.isArray(result?.decisions) || result.decisions.length === 0;

        const response = {
            isFallback,
            intro: String(result?.intro || fallback.intro).slice(0, 500),
            snapshot: Array.isArray(result?.snapshot)
                ? result.snapshot.map((event) => ({
                    type: validTypes.includes(event?.type) ? event.type : "positive",
                    icon: String(event?.icon || "📌").slice(0, 10),
                    text: String(event?.text || "Event occurred").slice(0, 50),
                    estimate: typeof event?.estimate === 'number' ? event.estimate : undefined,
                    context: String(event?.context || "Unknown").slice(0, 100)
                }))
                : fallback.snapshot,
            decisions: Array.isArray(result?.decisions)
                ? result.decisions.map((d, i) => ({
                    title: String(d?.title || "").slice(0, 120),
                    reflection: String(d?.reflection || "").slice(0, 300),
                    autonomy: validRatings.includes(d?.autonomy) ? d.autonomy : "medium",
                    liberalism: validRatings.includes(d?.liberalism) ? d.liberalism : "medium",
                    democracy: validRatings.includes(d?.democracy) ? d.democracy : "medium"
                }))
                : fallback.decisions,
            valuesSummary: String(result?.valuesSummary || fallback.valuesSummary).slice(0, 500),
            haiku: String(result?.haiku || fallback.haiku).slice(0, 300)
        };

        return res.json(response);

    } catch (e) {
        console.error("Error in /api/aftermath:", e?.message || e);
        return res.status(502).json({
            isFallback: true,
            intro: "After many years of rule, the leader passed into history.",
            snapshot: [
                { type: "positive", icon: "🏛️", text: "Governed their people", context: "Overall reign" },
                { type: "negative", icon: "⚠️", text: "Faced challenges", context: "Overall reign" }
            ],
            decisions: [],
            valuesSummary: "A leader who navigated complex political terrain.",
            haiku: "Power came and went\nDecisions echo through time\nHistory records"
        });
    }
}

// ==================== HELPERS ====================

// Helper to escape control characters that would break JSON parsing
function sanitizeText(text) {
    if (!text) return "";
    return String(text)
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Sanitize dilemma response - basic cleanup only
 */
function sanitizeDilemmaResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'object') {
        return null;
    }

    const sanitized = {
        ...rawResponse,
        dilemma: rawResponse.dilemma || {},
        actions: rawResponse.actions || []
    };

    // Ensure actions array has exactly 3 items
    if (sanitized.actions.length !== 3) {
        console.warn(`[SANITIZE] Expected 3 actions, got ${sanitized.actions.length}`);
    }

    return sanitized;
}

/**
 * POST /api/inquire
 * Handle player questions about current dilemma
 */
export async function answerInquiry(req, res) {
    try {
        const { gameId, day, question, language = 'en' } = req.body;

        if (!gameId || !question) {
            return res.status(400).json({ error: "Missing gameId or question" });
        }

        console.log(`[INQUIRY] ❓ Game ${gameId} Day ${day}: "${question}"`);

        // Check conversation history
        const conversation = getConversation(gameId);
        if (!conversation) {
            console.warn(`[INQUIRY] ⚠️ Conversation not found or expired for gameId=${gameId}`);
            return res.status(404).json({
                error: "Game session expired",
                answer: "Your game session has expired. Please restart the game."
            });
        }

        const messages = conversation.meta?.messages || [];

        // Extract role context
        const { role, systemName, challengerName, authorityLevel } = conversation.meta || {};

        // Add user question to history
        const userMessage = {
            role: "user",
            content: `[INQUIRY - Day ${day}] Regarding the current situation: "${conversation.meta?.currentDilemmaTitle || 'this crisis'}": ${question.trim()}`
        };
        messages.push(userMessage);

        console.log(`[INQUIRY] Added user inquiry to conversation (${messages.length} total messages)`);

        const languageCode = String(language || "en").toLowerCase();
        const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;

        const systemPrompt = `You are the Game Master answering a player's question about the current political situation.
Your Goal: Clarify the stakes, the risks, or specific details about the setting/factions WITHOUT solving the dilemma for them.
Voice: Helpful but slightly ominous, observational, grounded in the historical setting.
Language: ${languageName}
Length: Keep the answer concise (2-3 sentences max).
Context:
- Role: ${role || "Leader"}
- System: ${systemName || "Political System"}
- Authority: ${authorityLevel || "Medium"}
- Challenger: ${challengerName || "Rival"}

Directly answer the question based on previous context. Do NOT invent contradictions to established facts.`;

        // Use a temporary generation context
        const generationMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        // Call AI
        const response = await callGeminiChat(generationMessages, MODEL_VALIDATE_GEMINI);

        const answer = response?.content || "The Game Master remains silent.";

        // Append assistant answer to history
        messages.push({
            role: "assistant",
            content: answer
        });

        // Update interaction time
        conversation.lastUsedAt = Date.now();

        console.log(`[INQUIRY] ✅ Answer generated: "${answer.slice(0, 50)}..."`);

        return res.json({ answer });

    } catch (error) {
        console.error("[INQUIRY] ❌ Error:", error?.message || error);
        return res.status(500).json({
            error: "Inquiry failed",
            answer: "The oracles are silent right now. Please try again."
        });
    }
}
