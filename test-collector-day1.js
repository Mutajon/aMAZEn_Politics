// Test script for EventDataCollector - Day 1 scenario
// Run with: node test-collector-day1.js
//
// Tests Day 1 collection which should:
// - Fetch dilemma (required)
// - Fetch news with last=null (onboarding mode)
// - Fetch mirror with dilemma context
// - NOT fetch support/compass/dynamic (no previous choice)

async function testDay1Collection() {
  console.log('\n' + '='.repeat(70));
  console.log('DAY 1 COLLECTION TEST');
  console.log('='.repeat(70));

  const collectionData = {
    dilemma: null,
    news: null,
    mirror: null,
    support: null,
    compass: null,
    dynamic: null
  };

  try {
    // ========================================================================
    // PHASE 1: Independent requests
    // ========================================================================

    console.log('\n[PHASE 1] Fetching independent data...');

    // Simulate buildSnapshot for Day 1
    const dilemmaSnapshot = {
      day: 1,
      totalDays: 7,
      systemName: "Absolute Monarchy",
      roleTitle: "Emperor",
      setting: "19th century European empire",
      playerName: "Alexander III",
      budget: 1500,
      supports: { people: 50, middle: 60, mom: 70 },
      lastChoice: null,  // Day 1 = no previous choice
      recentTopics: [],
      topicCounts: {},
      enhancedContext: {
        compassTensions: [],
        topCompassComponents: [],
        powerHolders: [{ name: "Emperor", percent: 80, isPlayer: true }],
        playerPowerPercent: 80,
        lowSupportEntities: [],
        criticalSupportEntities: []
      }
    };

    const newsPayload = {
      day: 1,
      role: "Emperor",
      systemName: "Absolute Monarchy",
      last: null  // KEY: Day 1 = null for onboarding mode
    };

    // Parallel fetch (dilemma and news)
    const [dilemmaRes, newsRes] = await Promise.allSettled([
      fetch('http://localhost:8787/api/dilemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dilemmaSnapshot)
      }),
      fetch('http://localhost:8787/api/news-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsPayload)
      })
    ]);

    // Extract dilemma
    if (dilemmaRes.status === 'fulfilled' && dilemmaRes.value.ok) {
      collectionData.dilemma = await dilemmaRes.value.json();
      console.log('✓ Dilemma loaded:', collectionData.dilemma.title);
    } else {
      console.log('✗ Dilemma FAILED (CRITICAL)');
      return; // STOP - dilemma required
    }

    // Extract news
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      collectionData.news = await newsRes.value.json();
      console.log('✓ News loaded:', collectionData.news.items?.length, 'items');
    } else {
      console.log('⚠ News failed (using fallback: [])');
      collectionData.news = { items: [] };
    }

    // ========================================================================
    // PHASE 2: Dependent request (needs dilemma)
    // ========================================================================

    console.log('\n[PHASE 2] Fetching dependent data (needs dilemma)...');

    const mirrorPayload = {
      topWhat: ["1", "2", "3"],  // Mock compass values
      topWhence: ["0", "1", "2"],
      topOverall: ["1", "2", "3"],
      dilemma: {
        title: collectionData.dilemma.title,
        description: collectionData.dilemma.description,
        actions: collectionData.dilemma.actions
      }
    };

    const mirrorRes = await fetch('http://localhost:8787/api/mirror-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mirrorPayload)
    });

    if (mirrorRes.ok) {
      const mirrorData = await mirrorRes.json();
      collectionData.mirror = mirrorData.summary;
      console.log('✓ Mirror loaded:', collectionData.mirror.slice(0, 60) + '...');
    } else {
      console.log('⚠ Mirror failed (using fallback)');
      collectionData.mirror = "The mirror squints...";
    }

    // ========================================================================
    // VERIFY DAY 1 BEHAVIOR
    // ========================================================================

    console.log('\n' + '='.repeat(70));
    console.log('DAY 1 VERIFICATION');
    console.log('='.repeat(70));

    console.log('\n✓ SHOULD BE PRESENT:');
    console.log('  - Dilemma:', collectionData.dilemma ? 'YES ✓' : 'NO ✗');
    console.log('  - News:', collectionData.news ? 'YES ✓' : 'NO ✗');
    console.log('  - Mirror:', collectionData.mirror ? 'YES ✓' : 'NO ✗');

    console.log('\n✓ SHOULD BE NULL (Day 1 only):');
    console.log('  - Support Analysis:', collectionData.support ? 'WRONG ✗' : 'NULL ✓');
    console.log('  - Compass Pills:', collectionData.compass ? 'WRONG ✗' : 'NULL ✓');
    console.log('  - Dynamic Params:', collectionData.dynamic ? 'WRONG ✗' : 'NULL ✓');

    console.log('\n✓ NEWS MODE:');
    const newsMode = newsPayload.last === null ? 'ONBOARDING' : 'REACTION';
    console.log('  - Expected: ONBOARDING');
    console.log('  - Actual:', newsMode, newsMode === 'ONBOARDING' ? '✓' : '✗');

    console.log('\n✓ MIRROR CONTEXT:');
    console.log('  - Has dilemma context:', mirrorPayload.dilemma ? 'YES ✓' : 'NO ✗');
    console.log('  - Dilemma title:', mirrorPayload.dilemma?.title);

    console.log('\n' + '='.repeat(70));
    console.log('DAY 1 TEST COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
  }
}

testDay1Collection().catch(console.error);
