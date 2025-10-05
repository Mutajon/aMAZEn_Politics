// Test script for EventDataCollector - Day 2+ scenario
// Run with: node test-collector-day2.js
//
// Tests Day 2+ collection which should:
// - Fetch support analysis (from lastChoice)
// - Fetch compass pills (from lastChoice)
// - Fetch dynamic params (from lastChoice)
// - Fetch dilemma (required)
// - Fetch news with last=lastChoice (reaction mode)
// - Fetch mirror with dilemma context

async function testDay2PlusCollection() {
  console.log('\n' + '='.repeat(70));
  console.log('DAY 2+ COLLECTION TEST');
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
    // PHASE 1: Independent requests (including Day 2+ analysis)
    // ========================================================================

    console.log('\n[PHASE 1] Fetching independent data (Day 2+ includes analysis)...');

    // Simulate previous choice
    const lastChoice = {
      id: "a",
      title: "Impose Curfew",
      summary: "Restrict movement after dusk with visible patrols",
      cost: -150,
      iconHint: "security"
    };

    const actionText = `${lastChoice.title}. ${lastChoice.summary}`;

    // Simulate buildSnapshot for Day 2
    const dilemmaSnapshot = {
      day: 2,
      totalDays: 7,
      systemName: "Absolute Monarchy",
      roleTitle: "Emperor",
      setting: "19th century European empire",
      playerName: "Alexander III",
      budget: 1350,  // 1500 - 150 from previous choice
      supports: { people: 45, middle: 58, mom: 68 },
      lastChoice,  // Day 2+ = has previous choice
      recentTopics: ["Security"],
      topicCounts: { "Security": 1 },
      enhancedContext: {
        compassTensions: ["Freedom vs Order"],
        topCompassComponents: [
          { dimension: "what", index: 6, name: "Security", value: 7 }
        ],
        powerHolders: [{ name: "Emperor", percent: 80, isPlayer: true }],
        playerPowerPercent: 80,
        lowSupportEntities: [],
        criticalSupportEntities: []
      }
    };

    const newsPayload = {
      day: 2,
      role: "Emperor",
      systemName: "Absolute Monarchy",
      last: lastChoice  // KEY: Day 2+ = lastChoice for reaction mode
    };

    const politicalContext = {
      role: "Emperor",
      systemName: "Absolute Monarchy",
      day: 2,
      totalDays: 7,
      compassValues: { what: [5,6,4,5,5,5,7,5,5,5] }
    };

    // Parallel fetch (5 requests for Day 2+)
    const phase1Results = await Promise.allSettled([
      // Dilemma
      fetch('http://localhost:8787/api/dilemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dilemmaSnapshot)
      }),

      // News
      fetch('http://localhost:8787/api/news-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsPayload)
      }),

      // Support Analysis (Day 2+ only)
      fetch('http://localhost:8787/api/support-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: actionText, politicalContext })
      }),

      // Compass Analysis (Day 2+ only)
      fetch('http://localhost:8787/api/compass-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: actionText })
      }),

      // Dynamic Parameters (Day 2+ only)
      fetch('http://localhost:8787/api/dynamic-parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastChoice, politicalContext })
      })
    ]);

    // Extract results
    if (phase1Results[0].status === 'fulfilled' && phase1Results[0].value.ok) {
      collectionData.dilemma = await phase1Results[0].value.json();
      console.log('✓ Dilemma loaded:', collectionData.dilemma.title);
    } else {
      console.log('✗ Dilemma FAILED (CRITICAL)');
      return;
    }

    if (phase1Results[1].status === 'fulfilled' && phase1Results[1].value.ok) {
      collectionData.news = await phase1Results[1].value.json();
      console.log('✓ News loaded:', collectionData.news.items?.length, 'items');
    } else {
      console.log('⚠ News failed (using fallback: [])');
      collectionData.news = { items: [] };
    }

    if (phase1Results[2].status === 'fulfilled' && phase1Results[2].value.ok) {
      collectionData.support = await phase1Results[2].value.json();
      console.log('✓ Support analysis loaded:', collectionData.support.items?.length, 'effects');
    } else {
      console.log('⚠ Support failed (using fallback: null)');
    }

    if (phase1Results[3].status === 'fulfilled' && phase1Results[3].value.ok) {
      collectionData.compass = await phase1Results[3].value.json();
      console.log('✓ Compass pills loaded:', collectionData.compass.items?.length, 'pills');
    } else {
      console.log('⚠ Compass failed (using fallback: null)');
    }

    if (phase1Results[4].status === 'fulfilled' && phase1Results[4].value.ok) {
      collectionData.dynamic = await phase1Results[4].value.json();
      console.log('✓ Dynamic params loaded:', collectionData.dynamic.parameters?.length, 'params');
    } else {
      console.log('⚠ Dynamic failed (using fallback: null)');
    }

    // ========================================================================
    // PHASE 2: Dependent request (needs dilemma)
    // ========================================================================

    console.log('\n[PHASE 2] Fetching dependent data (needs dilemma)...');

    const mirrorPayload = {
      topWhat: ["1", "2", "6"],
      topWhence: ["0", "1", "2"],
      topOverall: ["1", "2", "6"],
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
    // VERIFY DAY 2+ BEHAVIOR
    // ========================================================================

    console.log('\n' + '='.repeat(70));
    console.log('DAY 2+ VERIFICATION');
    console.log('='.repeat(70));

    console.log('\n✓ ALL SHOULD BE PRESENT (Day 2+):');
    console.log('  - Dilemma:', collectionData.dilemma ? 'YES ✓' : 'NO ✗');
    console.log('  - News:', collectionData.news ? 'YES ✓' : 'NO ✗');
    console.log('  - Mirror:', collectionData.mirror ? 'YES ✓' : 'NO ✗');
    console.log('  - Support Analysis:', collectionData.support ? 'YES ✓' : 'NO ✗');
    console.log('  - Compass Pills:', collectionData.compass ? 'YES ✓' : 'NO ✗');
    console.log('  - Dynamic Params:', collectionData.dynamic ? 'YES ✓' : 'NO ✗');

    console.log('\n✓ NEWS MODE:');
    const newsMode = newsPayload.last ? 'REACTION' : 'ONBOARDING';
    console.log('  - Expected: REACTION');
    console.log('  - Actual:', newsMode, newsMode === 'REACTION' ? '✓' : '✗');
    console.log('  - Last choice:', lastChoice.title);

    console.log('\n✓ ANALYSIS INPUT:');
    console.log('  - Action text:', actionText);
    console.log('  - Support items:', collectionData.support?.items?.length || 0);
    console.log('  - Compass pills:', collectionData.compass?.items?.length || 0);
    console.log('  - Dynamic params:', collectionData.dynamic?.parameters?.length || 0);

    console.log('\n✓ MIRROR CONTEXT:');
    console.log('  - Has dilemma context:', mirrorPayload.dilemma ? 'YES ✓' : 'NO ✗');
    console.log('  - Dilemma title:', mirrorPayload.dilemma?.title);

    console.log('\n' + '='.repeat(70));
    console.log('DAY 2+ TEST COMPLETE');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
  }
}

testDay2PlusCollection().catch(console.error);
