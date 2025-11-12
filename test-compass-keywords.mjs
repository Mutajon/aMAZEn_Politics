/**
 * Test script for compass keyword detection
 *
 * Tests the enhanced compass hints endpoint with obvious keyword cases
 */

const API_URL = 'http://localhost:8787/api/compass-hints';
const TEST_GAME_ID = 'test-game-keywords-' + Date.now();

// Test cases with obvious keywords
const TEST_CASES = [
  {
    name: 'Martial Law (coercive action)',
    action: {
      title: 'Impose martial law to restore order',
      summary: 'Deploy military forces to enforce curfew and ban public gatherings'
    },
    expectedKeywords: ['enforce', 'military', 'martial law', 'ban']
  },
  {
    name: 'Tax the wealthy',
    action: {
      title: 'Raise taxes on the wealthy',
      summary: 'Increase income tax rates for top earners to fund social programs'
    },
    expectedKeywords: ['tax', 'inequality', 'redistribution']
  },
  {
    name: 'Transparency increase',
    action: {
      title: 'Increase government transparency',
      summary: 'Require all officials to publish financial records and meeting minutes publicly'
    },
    expectedKeywords: ['transparency', 'public', 'honesty']
  },
  {
    name: 'Reduce security (negation)',
    action: {
      title: 'Reduce military spending',
      summary: 'Cut defense budget by 50% and redirect funds to education'
    },
    expectedKeywords: ['reduce', 'military', 'education']
  },
  {
    name: 'Environmental protection',
    action: {
      title: 'Ban fossil fuel extraction',
      summary: 'Prohibit all oil and gas drilling to protect the environment and combat pollution'
    },
    expectedKeywords: ['ban', 'environment', 'pollution', 'sustainability']
  },
  {
    name: 'Fund public education',
    action: {
      title: 'Invest in public schools',
      summary: 'Increase funding for education and teacher training programs nationwide'
    },
    expectedKeywords: ['education', 'public', 'culture']
  }
];

async function testCompassHints(testCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Action: "${testCase.action.title}"`);
  console.log(`Summary: "${testCase.action.summary}"`);
  console.log(`Expected keywords: ${testCase.expectedKeywords.join(', ')}`);
  console.log('');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gameId: TEST_GAME_ID,
        action: testCase.action
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Response: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(`✅ Received ${result.compassHints.length} compass hints:`);
    result.compassHints.forEach(hint => {
      console.log(`   ${hint.prop}:${hint.idx} (polarity: ${hint.polarity >= 0 ? '+' : ''}${hint.polarity})`);
    });

  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 COMPASS KEYWORD DETECTION TEST SUITE');
  console.log(`Using gameId: ${TEST_GAME_ID}\n`);

  for (const testCase of TEST_CASES) {
    await testCompassHints(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between tests
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ All tests completed!');
  console.log('Check server logs for detailed keyword detection output');
  console.log(`${'='.repeat(80)}\n`);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
