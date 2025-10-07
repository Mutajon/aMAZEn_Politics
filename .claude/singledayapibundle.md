# Single Day API Bundle - Implementation Plan

## Overview
Consolidate 4-5 separate API calls per day into ONE `/api/day-bundle` endpoint that returns dilemma, news, mirror, support effects, and dynamic parameters. Compass analysis stays separate as designed.

**Goals:**
- Reduce API calls from 5-6 to 2 per day (bundle + compass)
- Improve AI context quality with full game history
- Reduce token usage by ~50%
- Maintain existing functionality and quality
- Use feature flag for safe rollout

---

## Phase 1: Server Implementation

### Step 1.1: Create `/api/day-bundle` Endpoint ✅ COMPLETED
- [x] Add new endpoint handler in `server/index.mjs` (after existing endpoints)
- [x] Define response schema with TypeScript types (dilemma, news, mirror, supportEffects, dynamic)
- [x] Create unified system prompt combining:
  - [x] Dilemma generation rules from `/api/dilemma`
  - [x] News ticker rules from `/api/news-ticker` (witty, 70-char)
  - [x] Mirror rules from `/api/mirror-summary` (cynical, 25-30 words)
  - [x] Dynamic parameters rules from `/api/dynamic-parameters` (4-5 words, 1-5 params with escalation support)
  - [x] Support analysis rules from `/api/support-analyze`
  - [x] Anti-jargon rules (already shared)
- [x] Build user prompt with full game context:
  - [x] Role, system name, political context
  - [x] Full game history digest (automatic governing pattern analysis)
  - [x] Current day, total days
  - [x] Last choice (Day 2+)
  - [x] Compass values, support values, budget
  - [x] Power holders, player index
  - [x] Topic diversity tracking
- [x] Use existing `aiJSON()` helper (NO fallback - returns null on failure)
- [x] Implement Day 1 vs Day 2+ logic:
  - [x] Day 1: supportEffects = [], dynamic = [] (empty arrays)
  - [x] Day 2+: Include supportEffects and dynamic parameters
- [x] Add strict validation for ALL required fields (no silent failures)
- [x] Add error handling that returns HTTP 502 on validation failure
- [x] Test endpoint in isolation with curl (Day 1 and Day 2 scenarios) ✅ PASSED
- [x] Fixed middle entity voice to speak AS entity (not confuse with "people")
- [x] Extensive console logging for debugging ([day-bundle] prefix)

### Step 1.2: Full Game History Digest System ✅ COMPLETED
- [x] Add `cost` field to `DilemmaHistoryEntry` type in `src/lib/dilemma.ts`
- [x] Update `addHistoryEntry()` calls in `useEventActions.ts` to include cost field
- [x] Verify `buildSnapshot()` already sends full `dilemmaHistory` array
- [x] Server already receives and processes full game history in `/api/day-bundle`
- [x] Server automatically generates governing pattern analysis from history
- [x] History format includes all game data:
  - [x] All decisions from Day 1 to current day (NOT just last 3-5)
  - [x] For each day includes:
    - [x] Day number
    - [x] Dilemma title and description
    - [x] Choice made (id, title, summary)
    - [x] Budget impact (cost)
    - [x] Support values AFTER choice (people, middle, mom)
  - [x] Server auto-analyzes governing patterns (care, liberty, security, etc.)
  - [x] Support trends calculated automatically
  - [x] Compact format (~100-150 tokens per day)

### Step 1.3: Unified Prompt Engineering ✅ COMPLETED
- [x] Extract and combine all existing prompt rules into bundle prompt
- [x] Preserve all existing quality guidelines:
  - [x] Dilemma: 60-char title, 2-3 sentence description, 3 actions with costs
  - [x] News: 3 items, max 70 chars each, witty/satirical
  - [x] Mirror: 25-30 words, cynical/witty, no percentages
  - [x] Support: 3 effects (people/middle/mom), vivid language, maternal voice for mom
  - [x] Dynamic: 1-5 ultra-short params, 4-5 words, specific numbers, escalation support
- [x] Test prompt with real game data from various stages:
  - [x] Day 1 (no history) ✅ PASSED
  - [x] Day 2 (with history) ✅ PASSED
- [x] Verify output quality matches existing separate endpoints ✅ CONFIRMED
- [x] Temperature set to 0.9 for creative variety

---

## Phase 2: Client Implementation (Feature Flag Pattern)

### Step 2.1: Add Feature Flag ✅ COMPLETED
- [x] Add `useDayBundleAPI: boolean` to `src/store/settingsStore.ts`
- [x] Set default value to `true` (bundle mode is now primary)
- [x] Add setter and toggle methods with console logging
- [x] Bump settings version from v5 to v6 for clean migration
- [x] Include in persist configuration
- [x] Document flag purpose in code comments
- [x] Add debug helpers: `useBundleMode()` and `useLegacyMode()` for easy toggling

### Step 2.2: Create Bundle Fetch Function ✅ COMPLETED
- [x] Add `fetchDayBundle()` to `src/hooks/useEventDataCollector.ts` (lines 80-194)
- [x] Do NOT modify existing fetch functions (kept as-is for legacy mode)
- [x] Implement bundle fetch:
  - [x] Call `/api/day-bundle` with full snapshot payload (uses buildSnapshot())
  - [x] Parse response and extract all sections (dilemma, news, mirror, supportEffects, dynamic)
  - [x] Validate ALL required fields strictly (NO fallbacks):
    - [x] Dilemma: title, description, 3 actions
    - [x] News: array validation
    - [x] Mirror: summary validation
    - [x] Support effects: required on Day 2+, must have items
    - [x] Dynamic params: required on Day 2+, must be array
  - [x] Return typed structure matching CollectedData format
- [x] Add comprehensive error handling with detailed logging
- [x] Extensive console logging for debugging ([fetchDayBundle] prefix)

### Step 2.3: Update `collectData()` with Conditional Logic ✅ COMPLETED
- [x] Add `useSettingsStore` import to useEventDataCollector.ts
- [x] Add feature flag check at start of `collectData()`
- [x] Implement NEW PATH (bundle mode - lines 501-565):
  - [x] Call `fetchDayBundle()` (single call)
  - [x] Extract: dilemma, newsItems, mirrorText, supportEffects, dynamicParams
  - [x] Still fetch compass separately: `fetchCompassPills(lastChoice)` (Day 2+)
  - [x] Build `CollectedData` object from bundle results
  - [x] Update progress tracking (10% → 60% → 85% → 100%)
  - [x] Update global dilemmaStore for narration hook
- [x] Keep LEGACY PATH unchanged:
  - [x] All existing parallel calls (Phase 1)
  - [x] All existing sequential calls (Phase 2)
  - [x] Existing error handling preserved
  - [x] Added "LEGACY MODE" log marker
- [x] Error handling for bundle mode:
  - [x] Catches bundle failures and shows user-friendly error
  - [x] NO automatic fallback to legacy (as requested)
  - [x] User sees error with "Try Again" option (handled by EventScreen3)
- [x] Comprehensive logging for both modes

### Step 2.4: Error Handling (No Automatic Fallback) ✅ COMPLETED
- [x] Bundle failure shows user-facing error with retry option
- [x] Error message clear and actionable
- [x] NO automatic fallback to legacy mode (as requested)
- [x] Legacy mode completely independent of bundle mode
- [x] Console logs indicate which mode is active

---

## Phase 3: Testing Strategy

### Step 3.1: Isolated Server Testing
- [ ] Test `/api/day-bundle` endpoint with Postman/curl
- [ ] Test Day 1 scenario (no lastChoice)
- [ ] Test Day 2+ scenario (with lastChoice and history)
- [ ] Verify response structure matches schema
- [ ] Test with various role/system combinations
- [ ] Test with low/high support scenarios
- [ ] Test with diverse compass values
- [ ] Verify full history digest is included and formatted correctly

### Step 3.2: Integration Testing with Feature Flag OFF
- [ ] Implement all client code with flag defaulted to `false`
- [ ] Play full 7-day game to verify legacy path still works
- [ ] Confirm no regressions in existing functionality
- [ ] Verify all existing features work as before

### Step 3.3: Bundle Mode Testing with Feature Flag ON
- [ ] Toggle `useDayBundleAPI` to `true` in settings store
- [ ] Play full 7-day game using bundle API
- [ ] Verify all data displays correctly:
  - [ ] Dilemma card shows properly
  - [ ] News ticker has relevant reactions
  - [ ] Mirror text is witty and contextual
  - [ ] Support effects animate correctly
  - [ ] Dynamic parameters appear properly
  - [ ] Compass pills still work (separate API)
- [ ] Test edge cases:
  - [ ] Day 1 (no previous choice)
  - [ ] Low support scenarios
  - [ ] High support scenarios
  - [ ] Various political systems
  - [ ] Different difficulty levels
- [ ] Compare quality to legacy mode:
  - [ ] Play same role/setup with flag OFF, then flag ON
  - [ ] Evaluate dilemma quality
  - [ ] Evaluate news relevance
  - [ ] Evaluate mirror personality
  - [ ] Check for any quality degradation

### Step 3.4: Performance Validation
- [ ] Measure bundle API response time (target: 4-5 seconds)
- [ ] Compare to legacy sequential time (baseline: 5-8 seconds)
- [ ] Track token usage per day (target: ~50% reduction)
- [ ] Monitor fallback frequency (target: <1%)
- [ ] Log any timeout issues
- [ ] Verify loading overlay shows correct progress

### Step 3.5: Stress Testing
- [ ] Test multiple playthroughs back-to-back
- [ ] Test with different models (if using model overrides)
- [ ] Test with slow network conditions
- [ ] Test bundle API failure scenarios
- [ ] Verify fallback to legacy works every time

---

## Phase 4: Rollout & Monitoring

### Step 4.1: Development Rollout
- [ ] Enable feature flag in development environment
- [ ] Monitor console logs for errors
- [ ] Play 3-5 full games to validate stability
- [ ] Gather feedback on quality and performance
- [ ] Fix any issues found before wider rollout

### Step 4.2: Production Preparation
- [ ] Document bundle API behavior in CLAUDE.md
- [ ] Add monitoring/logging for bundle usage
- [ ] Set up error tracking if available
- [ ] Prepare rollback plan (toggle flag to `false`)

### Step 4.3: Gradual Production Rollout
- [ ] Week 1: Flag ON in dev, extensive testing
- [ ] Week 2: If quality matches, set flag default to `true`
- [ ] Week 3: Monitor production usage, watch for issues
- [ ] Week 4: If stable, consider removing flag (optional)
- [ ] Throughout: Monitor key metrics:
  - [ ] Response times
  - [ ] Error rates
  - [ ] Fallback frequency
  - [ ] Token usage
  - [ ] User experience (loading times)

---

## Phase 5: Cleanup & Optimization (After Validation)

### Step 5.1: Code Cleanup (Only After Bundle Proven Stable)
- [ ] Remove redundant fetch functions from `useEventDataCollector.ts`:
  - [ ] `fetchDilemma()` (replaced by bundle)
  - [ ] `fetchNews()` (replaced by bundle)
  - [ ] `fetchMirrorText()` (replaced by bundle)
  - [ ] `fetchSupportAnalysis()` (already redundant, replaced by bundle)
  - [ ] `fetchDynamicParams()` (replaced by bundle)
  - [ ] Keep `fetchCompassPills()` (still separate as designed)
- [ ] Remove legacy conditional branches in `collectData()`
- [ ] Remove feature flag from settings store (if desired)
- [ ] Simplify `collectData()` logic to only use bundle

### Step 5.2: Server Cleanup (Optional)
- [ ] Consider deprecating old endpoints (or keep as backup):
  - [ ] `/api/dilemma` (except for legacy compatibility)
  - [ ] `/api/news-ticker`
  - [ ] `/api/mirror-summary`
  - [ ] `/api/support-analyze`
  - [ ] `/api/dynamic-parameters`
  - [ ] Keep `/api/compass-analyze` (still used separately)
- [ ] Add deprecation warnings to old endpoints
- [ ] Document migration path for any external tools

### Step 5.3: Documentation Updates
- [ ] Update CLAUDE.md with new architecture:
  - [ ] Document `/api/day-bundle` endpoint
  - [ ] Document history digest format
  - [ ] Update flow diagrams
  - [ ] Note performance improvements
  - [ ] Update token usage estimates
- [ ] Document history digest for end-game summary usage
- [ ] Add inline code comments explaining bundle logic
- [ ] Update any API documentation

### Step 5.4: Performance Optimization
- [ ] Analyze token usage patterns
- [ ] Optimize history digest format if needed
- [ ] Tune prompt for efficiency
- [ ] Consider caching strategies if applicable
- [ ] Monitor and optimize model temperature

---

## Key Decisions & Clarifications

### History Digest:
- ✅ **FULL game history** (all days from 1 to current)
- ✅ NOT just last 3-5 decisions
- ✅ ~100-150 tokens per day
- ✅ Will be used for end-game summary too
- ✅ Includes governing patterns and support trends

### Testing Approach:
- ✅ **Feature flag** controls which system runs
- ✅ **Both systems coexist** during development
- ✅ **Toggle flag** to switch instantly
- ✅ **No side-by-side** comparison (too complex)
- ✅ **Fallback** to legacy if bundle fails

### Compass Analysis:
- ✅ **Stays separate** (not in bundle)
- ✅ Called independently after bundle
- ✅ No changes to compass logic

### Timeline Estimate:
- **Phase 1 (Server):** 1-2 days
- **Phase 2 (Client):** 1 day
- **Phase 3 (Testing):** 3-5 days
- **Phase 4 (Rollout):** 1 week monitoring
- **Phase 5 (Cleanup):** 1 day
- **Total:** ~2-3 weeks for full rollout with validation

---

## Success Criteria

### Functional:
- [ ] Bundle API returns all required data in correct format
- [ ] Game plays identically with bundle vs legacy
- [ ] No regressions in existing features
- [ ] Fallback works reliably if bundle fails

### Quality:
- [ ] Dilemma quality matches or exceeds legacy
- [ ] News reactions are contextual and witty
- [ ] Mirror text is relevant and personality-driven
- [ ] Support effects are accurate and vivid
- [ ] Dynamic parameters are specific and useful

### Performance:
- [ ] Bundle response time ≤ 5 seconds (vs 5-8s legacy)
- [ ] Token usage reduced by ~40-50%
- [ ] Fallback rate < 1%
- [ ] No timeout issues

### User Experience:
- [ ] Loading feels faster or same (not slower)
- [ ] No noticeable quality degradation
- [ ] No crashes or errors
- [ ] Smooth day-to-day progression

---

## Rollback Plan

If issues arise at any stage:

1. **Immediate:** Toggle `useDayBundleAPI` to `false` in settings store
2. **Legacy mode activates:** Game continues working normally
3. **Debug bundle API:** Fix issues in isolated testing
4. **Re-enable flag:** Once fixes validated
5. **If unfixable:** Keep legacy mode, revisit bundle design

---

## Notes

- Feature flag allows safe parallel development
- Legacy code stays untouched until bundle validated
- Both systems can coexist indefinitely if needed
- Compass analysis intentionally separate (not bundled)
- Full history enables better AI context AND end-game summary
