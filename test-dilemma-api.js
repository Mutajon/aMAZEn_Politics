// Test script for /api/dilemma enhanced context
// Run with: node test-dilemma-api.js

async function testDilemma(testName, payload) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch('http://localhost:8787/api/dilemma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('✓ Title:', data.title);
    console.log('✓ Topic:', data.topic);
    console.log('✓ isFallback:', data.isFallback);
    console.log('✓ Description:', data.description.slice(0, 150) + '...');
    console.log('✓ Actions:', data.actions.length, 'choices');
    data.actions.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.title} (cost: ${a.cost})`);
    });

    return data;
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
}

async function runTests() {
  // Test 1: Day 1 (First Day Rule - leadership transition)
  await testDilemma('Day 1 - Leadership Transition (Absolute Monarchy)', {
    day: 1,
    totalDays: 7,
    systemName: 'Absolute Monarchy of the Empire',
    roleTitle: 'Emperor',
    setting: '19th century European empire',
    playerName: 'Alexander III',
    budget: 1000,
    supports: { people: 50, middle: 60, mom: 70 },
    lastChoice: null,
    recentTopics: [],
    topicCounts: {},
    enhancedContext: {
      compassTensions: ['Freedom vs Order'],
      topCompassComponents: [
        { dimension: 'what', index: 1, name: 'Liberty', value: 8 }
      ],
      powerHolders: [
        { name: 'Emperor', percent: 80, isPlayer: true },
        { name: 'Military', percent: 15, isPlayer: false },
        { name: 'Nobles', percent: 5, isPlayer: false }
      ],
      playerPowerPercent: 80,
      lowSupportEntities: [],
      criticalSupportEntities: []
    }
  });

  // Test 2: Day 7 (Last Day Rule - climactic moment)
  await testDilemma('Day 7 - Climactic Last Day (Absolute Monarchy)', {
    day: 7,
    totalDays: 7,
    systemName: 'Absolute Monarchy of the Empire',
    roleTitle: 'Emperor',
    setting: '19th century European empire',
    playerName: 'Alexander III',
    budget: 800,
    supports: { people: 45, middle: 55, mom: 65 },
    lastChoice: {
      title: 'Suppress the Workers Strike',
      summary: 'Deployed military force to break up labor protests'
    },
    recentTopics: ['Security', 'Economy', 'Rights'],
    topicCounts: { 'Security': 2, 'Economy': 2, 'Rights': 2 },
    enhancedContext: {
      compassTensions: ['Freedom vs Order', 'Equality vs Markets'],
      topCompassComponents: [
        { dimension: 'what', index: 0, name: 'Truth', value: 6 },
        { dimension: 'how', index: 0, name: 'Law', value: 8 }
      ],
      powerHolders: [
        { name: 'Emperor', percent: 80, isPlayer: true },
        { name: 'Military', percent: 15, isPlayer: false },
        { name: 'Nobles', percent: 5, isPlayer: false }
      ],
      playerPowerPercent: 80,
      lowSupportEntities: [],
      criticalSupportEntities: []
    }
  });

  // Test 3: Support Crisis (<25% people support)
  await testDilemma('Support Crisis - People at 20% (CRITICAL)', {
    day: 4,
    totalDays: 7,
    systemName: 'Direct Democracy Assembly',
    roleTitle: 'Citizen',
    setting: 'Classical Athens, 5th century BCE',
    playerName: 'Pericles',
    budget: 600,
    supports: { people: 20, middle: 55, mom: 60 },
    lastChoice: {
      title: 'Impose Heavy Taxes on Citizens',
      summary: 'Required all citizens to pay war taxes'
    },
    recentTopics: ['Economy'],
    topicCounts: { 'Economy': 1 },
    enhancedContext: {
      compassTensions: ['Individual vs Collective'],
      topCompassComponents: [
        { dimension: 'what', index: 2, name: 'Equality', value: 9 }
      ],
      powerHolders: [
        { name: 'Citizens Assembly', percent: 85, isPlayer: false },
        { name: 'You', percent: 15, isPlayer: true }
      ],
      playerPowerPercent: 15,
      lowSupportEntities: ['people'],
      criticalSupportEntities: ['people']
    }
  });

  // Test 4: Topic Diversity (3 consecutive Security topics)
  await testDilemma('Topic Diversity - Should Avoid Security', {
    day: 5,
    totalDays: 7,
    systemName: 'Parliamentary Monarchy',
    roleTitle: 'Prime Minister',
    setting: 'Modern constitutional monarchy',
    playerName: 'Victoria Smith',
    budget: 900,
    supports: { people: 55, middle: 60, mom: 65 },
    lastChoice: {
      title: 'Increase Border Patrols',
      summary: 'Deployed additional security forces at borders'
    },
    recentTopics: ['Security', 'Security', 'Security'],
    topicCounts: { 'Security': 3, 'Economy': 1 },
    enhancedContext: {
      compassTensions: [],
      topCompassComponents: [
        { dimension: 'what', index: 3, name: 'Care', value: 7 }
      ],
      powerHolders: [
        { name: 'Parliament', percent: 60, isPlayer: false },
        { name: 'Prime Minister', percent: 30, isPlayer: true },
        { name: 'Monarch', percent: 10, isPlayer: false }
      ],
      playerPowerPercent: 30,
      lowSupportEntities: [],
      criticalSupportEntities: []
    }
  });

  // Test 5: Response to Previous Choice
  await testDilemma('Response to Previous Choice - Power Holder Reaction', {
    day: 3,
    totalDays: 7,
    systemName: 'Presidential Republic',
    roleTitle: 'President',
    setting: 'Modern democracy',
    playerName: 'Sarah Martinez',
    budget: 850,
    supports: { people: 60, middle: 50, mom: 70 },
    lastChoice: {
      title: 'Cut Military Budget by 30%',
      summary: 'Reallocated military funding to education and healthcare'
    },
    recentTopics: ['Economy'],
    topicCounts: { 'Economy': 1 },
    enhancedContext: {
      compassTensions: ['Security vs Welfare'],
      topCompassComponents: [
        { dimension: 'what', index: 3, name: 'Care', value: 8 }
      ],
      powerHolders: [
        { name: 'President', percent: 40, isPlayer: true },
        { name: 'Congress', percent: 35, isPlayer: false },
        { name: 'Military', percent: 25, isPlayer: false }
      ],
      playerPowerPercent: 40,
      lowSupportEntities: [],
      criticalSupportEntities: []
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('ALL TESTS COMPLETE');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
