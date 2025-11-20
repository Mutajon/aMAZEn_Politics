# API Reference

Complete reference for all backend API endpoints.

**Backend File**: `server/index.mjs`

---

## Table of Contents

1. [Core Game Engine](#core-game-engine)
2. [User & Game Management](#user--game-management)
3. [Role & Character Generation](#role--character-generation)
4. [Compass System](#compass-system)
5. [Story & Narrative](#story--narrative)
6. [Dynamic Game Features](#dynamic-game-features)
7. [Audio](#audio)
8. [Data Logging](#data-logging)
9. [Infrastructure](#infrastructure)

---

## Core Game Engine

### POST `/api/game-turn-v2`

**Primary endpoint for all dilemma generation and game progression.**

**Features**:
- Stateful conversation using persistent `gameId`
- Returns all event screen data in single call
- ~50% token savings after Day 1 vs. original implementation
- Implements strict topic variety (max 2 consecutive on same topic)
- Conditional action generation based on treatment

**Request Body**:
```typescript
{
  gameId: string;                    // Format: "game-{timestamp}-{random}"
  day: number;                       // Current day (1-7)
  playerChoice?: string;             // Selected action text (if Day 2+)
  generateActions: boolean;          // Skip action generation for fullAutonomy treatment
  role: string;                      // Player's role title
  setting: string;                   // Historical/fictional setting
  politicalSystem: string;           // E-12 system name
  compassValues: object;             // Top 3 per dimension (12 values)
  narrativeThreads?: string[];       // Story threads from narrative seed
  recentHistory?: object[];          // Last 2 days of decisions
  powerHolders?: object[];           // Faction identity mapping
}
```

**Response**:
```typescript
{
  dilemma: {
    id: string;
    title: string;
    description: string;
    topic: string;                   // Economy, Military, Religion, etc.
    scope: string;                   // Local, National, International
    actions: Array<{
      id: string;
      title: string;
      description: string;
      budgetCost: number;
    }>;
  };
  supportEffects: {
    people: { delta: number; explanation: string };
    middle: { delta: number; explanation: string };
    mom: { delta: number; explanation: string };
  };
  compassHints: Array<{
    component: string;               // Component name (e.g., "Care")
    delta: number;                   // -2 to +2
    emoji: string;
  }>;
  mirrorAdvice: string;              // Short strategic advice
  dynamicParams: string[];           // Immediate consequences (emoji + text)
  corruptionShift?: {
    delta: number;
    reason: string;
  };
}
```

**Token Optimization**:
- Day 1: ~2,000 tokens (full context)
- Day 2+: ~1,000 tokens (incremental updates)
- fullAutonomy treatment: Additional 40-50% savings (no action generation)

**Implementation Notes**:
- Message history stored in-memory (24hr TTL)
- Conversation cleanup task runs periodically
- Graceful degradation if conversation state lost

---

## User & Game Management

### POST `/api/users/register`

**Register user and assign treatment.**

**Request Body**:
```typescript
{
  userId?: string;  // Optional, generated if not provided
}
```

**Response**:
```typescript
{
  userId: string;
  treatment: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy';
  assignedAt: Date;
}
```

**Treatment Assignment**:
- Adaptive distribution: Assigns to under-represented treatments
- Balances across all three treatments

---

### POST `/api/reserve-game-slot`

**Check if game slots are available (GAME_LIMIT=100).**

**Request Body**:
```typescript
{
  userId: string;
}
```

**Response**:
```typescript
{
  available: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}
```

**Use Case**: Prevents server overload during high traffic

---

## Role & Character Generation

### POST `/api/validate-role`

**Validate custom role text before analysis.**

**Request Body**:
```typescript
{
  roleText: string;
}
```

**Response**:
```typescript
{
  valid: boolean;
  message?: string;
  suggestions?: string[];
}
```

**Validation Checks**:
- Minimum length (20 characters)
- Contains political/historical context
- Not gibberish or off-topic

---

### POST `/api/analyze-role`

**E-12 political system analysis for custom roles.**

**Request Body**:
```typescript
{
  roleText: string;
}
```

**Response**:
```typescript
{
  systemName: string;              // One of 11 polity types
  systemDescription: string;
  powerHolders: Array<{
    name: string;
    subjectType: string;           // Author, Eraser, Agent, Actor, Acolyte, Dictator
    intensity: string;             // Strong (+), Moderate (•), Weak (-)
    domains: string[];             // Which of 12 exception domains
  }>;
  historicalGrounding: string;     // 2-3 sentence explanation
}
```

**Model**: `MODEL_ANALYZE` (gpt-4o), Temperature: 0.2

**Note**: Predefined roles skip this endpoint (hardcoded analysis)

---

### POST `/api/generate-avatar`

**Generate AI character portrait.**

**Request Body**:
```typescript
{
  character: {
    name: string;
    gender: string;
    physicalDescription: string;
  };
  role: string;
  setting: string;
}
```

**Response**:
```typescript
{
  avatarUrl: string;               // base64 data URL
  prompt: string;                  // Generated DALL-E prompt
}
```

**Model**: `IMAGE_MODEL` (dall-e-3 or gpt-image-1)

**Implementation**: Uses OpenAI DALL-E API

---

### POST `/api/suggest-scenario`

**Submit player-suggested scenario for future roles.**

**Request Body**:
```typescript
{
  scenario: string;
  email?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

**Note**: Stores suggestions for manual review

---

## Compass System

### POST `/api/mirror-light`

**Light mirror dialogue for compass intro.**

**Request Body**:
```typescript
{
  userName: string;
}
```

**Response**:
```typescript
{
  dialogue: string;
}
```

---

### POST `/api/mirror-quiz-light`

**Compass quiz question delivery.**

**Request Body**:
```typescript
{
  questionIndex: number;           // 0-39
}
```

**Response**:
```typescript
{
  question: string;
  component: string;
  dimension: string;
}
```

**Note**: Questions stored in `src/data/mirror-quiz-pool.ts`

---

### POST `/api/compass-analyze`

**Deep compass analysis (deferred, not used in current flow).**

**Request Body**:
```typescript
{
  compassValues: object;           // All 40 values
}
```

**Response**:
```typescript
{
  summary: string;
  topValues: string[];
  tensions: string[];
}
```

---

### POST `/api/compass-conversation/init`

**Initialize compass conversation (alternative flow).**

**Request Body**:
```typescript
{
  conversationId: string;
  compassValues: object;
}
```

**Response**:
```typescript
{
  initialMessage: string;
}
```

---

### POST `/api/compass-conversation/analyze`

**Analyze compass conversation (alternative flow).**

**Request Body**:
```typescript
{
  conversationId: string;
  message: string;
}
```

**Response**:
```typescript
{
  response: string;
  updatedValues?: object;
}
```

---

## Story & Narrative

### POST `/api/narrative-seed`

**One-time narrative scaffold generation.**

**Called**: Once in BackgroundIntroScreen after compass assessment

**Request Body**:
```typescript
{
  role: string;
  setting: string;
  politicalSystem: string;
  compassValues: object;           // Top 3 per dimension
  powerHolders: object[];
}
```

**Response**:
```typescript
{
  narrativeThreads: string[];      // 2-3 dramatic threads
  climaxCandidates: string[];      // Possible Day 7 climax scenarios
  backgroundText: string;          // Intro narrative for player
}
```

**Purpose**: Enables coherent 7-day story arc with escalating stakes

**Model**: `MODEL_DILEMMA` with high creativity temperature

---

### POST `/api/aftermath`

**Game epilogue generation.**

**Called**: Day 8 (AftermathScreen)

**Request Body**:
```typescript
{
  role: string;
  setting: string;
  gameHistory: object[];           // All 7 days of decisions
  finalState: {
    supportPeople: number;
    supportMiddle: number;
    supportMom: number;
    budget: number;
    corruptionLevel: number;
  };
  compassValues: object;
  compassInitialSnapshot: object;
}
```

**Response**:
```typescript
{
  legacy: string;                  // "You will be remembered as..."
  snapshot: Array<{
    emoji: string;
    text: string;
    importance: number;            // 1-10
  }>;
  compassSummary: {
    dimension: string;
    components: Array<{
      name: string;
      value: number;
      emoji: string;
    }>;
  };
  ideologyScores: {
    democracy: number;             // 0-10
    autonomy: number;
    liberalism: number;
  };
}
```

**Model**: `MODEL_AFTERMATH` (gpt-4o), Temperature: 0.7

**Token Count**: ~3,000-5,000 tokens (full game context)

---

### POST `/api/news-ticker`

**Optional news update generation (not used in current flow).**

**Request Body**:
```typescript
{
  day: number;
  recentDecision: string;
}
```

**Response**:
```typescript
{
  newsItems: string[];
}
```

---

## Dynamic Game Features

### POST `/api/validate-suggestion`

**Validate custom player actions.**

**Philosophy**: Highly permissive, pro-player system

**Request Body**:
```typescript
{
  suggestion: string;
  role: string;
  setting: string;
  currentSituation: string;
}
```

**Response**:
```typescript
{
  approved: boolean;
  reason?: string;
  alternatives?: string[];         // If rejected, suggest feasible options
  corruptionEstimate?: number;     // 0-10 scale
}
```

**Validation Rules**:
- ✅ Accept: Violent, unethical, risky actions (corruption evaluated later)
- ✅ Accept: Difficult but theoretically possible for role
- ❌ Reject: Only anachronisms, gibberish, physically impossible

**Model**: `MODEL_VALIDATE` (gpt-4o-mini), Temperature: 0.3

---

### POST `/api/dynamic-parameters`

**Generate immediate consequences for actions.**

**Request Body**:
```typescript
{
  action: string;
  role: string;
  setting: string;
  currentState: object;
}
```

**Response**:
```typescript
{
  parameters: string[];            // 2-3 consequences (emoji + 3-5 words)
}
```

**Format**: "🔥 Royal palace stormed", "👥 4 million march"

**Used**: Day 2+ after action selection

---

### POST `/api/inquire`

**Player inquiry system (ask questions about dilemmas).**

**Request Body**:
```typescript
{
  question: string;
  dilemma: object;
  role: string;
  setting: string;
}
```

**Response**:
```typescript
{
  answer: string;
  characterResponse?: string;      // In-character response
}
```

**Credits**: Treatment-based (2/1/0 per dilemma for full/semi/no autonomy)

**Model**: `MODEL_INQUIRE` (gpt-4o-mini), Temperature: 0.6

---

### POST `/api/bg-suggestion`

**Background image suggestion for avatar (future feature).**

**Request Body**:
```typescript
{
  setting: string;
  role: string;
}
```

**Response**:
```typescript
{
  suggestion: string;
}
```

---

## Audio

### POST `/api/tts`

**Text-to-speech narration generation.**

**Request Body**:
```typescript
{
  text: string;
  voice?: string;                  // alloy, echo, fable, onyx, nova, shimmer
  instructions?: string;           // Tone/style control (gpt-4o-mini-tts only)
  format?: string;                 // mp3, opus, aac, flac
}
```

**Response**:
```typescript
{
  audio: Buffer;                   // Audio file binary
  contentType: string;             // audio/mpeg, etc.
}
```

**Models**:
- `gpt-4o-mini-tts` (default, supports instructions)
- `tts-1` (basic)
- `tts-1-hd` (high quality)

**Per-Screen Instructions**:
- Dilemmas: "Speak as dramatic political narrator with gravitas"
- Aftermath: "Speak in solemn, reflective tone"

**Environment Variables**:
- `TTS_MODEL` - Model name
- `TTS_VOICE` - Default voice
- `TTS_INSTRUCTIONS` - Global fallback instructions
- `TTS_FORMAT` - Audio format

---

## Data Logging

### POST `/api/log/batch`

**Batch log submission.**

**Request Body**:
```typescript
{
  logs: Array<{
    timestamp: Date;
    userId: string;
    sessionId: string;
    gameVersion: string;
    treatment: string;
    source: 'player' | 'system';
    action: string;
    value: any;
    currentScreen: string;
    day: number;
    role: string;
    comments: string;
  }>;
}
```

**Response**:
```typescript
{
  success: boolean;
  inserted: number;
}
```

**Batching**: Client sends max 50 logs per request

**Storage**: MongoDB (if `ENABLE_DATA_COLLECTION=true`)

---

### POST `/api/log/session/start`

**Session initialization.**

**Request Body**:
```typescript
{
  userId: string;
  sessionId: string;
  treatment: string;
  role: string;
}
```

**Response**:
```typescript
{
  success: boolean;
}
```

---

### GET `/api/log/status`

**Check data collection status.**

**Response**:
```typescript
{
  enabled: boolean;
  storage: 'mongodb' | 'disabled';
}
```

---

### POST `/api/logging/*`

**Logging router for additional logging endpoints.**

**Note**: Delegates to `server/api/logging.mjs`

---

## Infrastructure

### GET `/api/_ping`

**Health check endpoint.**

**Response**:
```typescript
{
  status: 'ok';
  timestamp: Date;
}
```

---

### GET `/health`

**Render.com health check.**

**Response**: `OK` (200 status)

---

### GET `/api/game-turn/cleanup`

**Conversation cleanup task.**

**Purpose**: Removes conversations older than 24 hours from in-memory store

**Response**:
```typescript
{
  cleaned: number;
  remaining: number;
}
```

**Note**: Runs periodically via cron job or manual trigger

---

## Multi-Provider Support

**Environment Variables**:
```bash
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key  # Optional
```

**Model Configuration**:
```bash
CHAT_MODEL=gpt-5-mini
MODEL_DILEMMA=gpt-5
MODEL_MIRROR=gpt-5
MODEL_ANALYZE=gpt-4o
MODEL_VALIDATE=gpt-4o-mini
MODEL_INQUIRE=gpt-4o-mini
IMAGE_MODEL=gpt-image-1
TTS_MODEL=gpt-4o-mini-tts
```

**Provider Switching**:
- Default: OpenAI GPT
- Optional: Anthropic Claude (via console: `switchToClaude()`)
- Optional: X.AI/Grok (via console: `switchToXAI()`)

**Implementation**: Provider selected via localStorage, backend reads from request headers

---

## Error Handling

**All endpoints return standard error format**:

```typescript
{
  error: string;                   // Error message
  details?: any;                   // Additional context
  code?: string;                   // Error code
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing API key)
- `429` - Rate limit exceeded
- `500` - Internal server error
- `503` - Service unavailable (API provider down)

---

## Rate Limiting

**Not implemented in current version.**

**Recommendation**: Add rate limiting middleware for production deployment (e.g., `express-rate-limit`)

---

## Conversation Store Architecture

**In-Memory Storage**:
- gameId → message history mapping
- 24-hour TTL per conversation
- Auto-cleanup task removes expired conversations

**Message History Structure**:
```typescript
{
  gameId: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  lastAccessed: Date;
}
```

**Benefits**:
- ~50% token savings (incremental updates)
- Consistent AI responses across turns
- No database dependency

**Limitations**:
- Lost on server restart
- Not shared across server instances (single-instance deployment only)

---

## Adding New Endpoints

**Steps**:

1. **Implement endpoint** in `server/index.mjs`:
   ```javascript
   app.post('/api/my-endpoint', async (req, res) => {
     try {
       // Implementation
       res.json({ success: true });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

2. **Add to this documentation**:
   - Endpoint path and method
   - Request body schema
   - Response schema
   - Model/temperature configuration
   - Use case and integration points

3. **Update CLAUDE.md** if endpoint is critical to core game flow

4. **Add logging** if endpoint generates AI content (see LOGGING_SYSTEM.md)

5. **Test with curl**:
   ```bash
   curl -X POST http://localhost:3001/api/my-endpoint \
     -H "Content-Type: application/json" \
     -d '{"key": "value"}'
   ```

---

## Environment Variables Reference

**Required**:
- `OPENAI_API_KEY` - OpenAI API key

**Optional**:
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `XAI_API_KEY` - X.AI/Grok API key
- `NODE_ENV` - Environment (production/development)
- `PORT` - Server port (default: 3001)
- `ENABLE_DATA_COLLECTION` - Enable MongoDB logging (true/false)
- `MONGODB_URI` - MongoDB connection string
- `GAME_LIMIT` - Max concurrent games (default: 100)

**Model Configuration**: See Multi-Provider Support section above
