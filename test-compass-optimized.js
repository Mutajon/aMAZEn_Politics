// Test script for optimized compass analysis
// Run with: node test-compass-optimized.js
//
// This tests the new compact format (81% token reduction) to ensure
// accuracy is maintained without sending full cues with every request

async function testCompassAnalysis(testName, actionText, expectedComponents = []) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(70));
  console.log('Action:', actionText);

  try {
    const response = await fetch('http://localhost:8787/api/compass-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: actionText })
    });

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log('✗ NO ITEMS RETURNED');
      return null;
    }

    console.log(`✓ Found ${data.items.length} compass effects:`);

    data.items.forEach((item, i) => {
      const { prop, idx, polarity, strength } = item;
      const sign = polarity === 'positive' ? '+' : '-';
      console.log(`  ${i+1}. ${prop}.${idx} (${polarity}/${strength}) → ${sign}${strength === 'strong' ? 2 : 1}`);
    });

    if (expectedComponents.length > 0) {
      console.log('\nExpected components:', expectedComponents.join(', '));
      const matched = expectedComponents.filter(exp =>
        data.items.some(item => `${item.prop}.${item.idx}` === exp)
      );
      console.log(`Matched: ${matched.length}/${expectedComponents.length}`, matched);
    }

    return data;
  } catch (error) {
    console.error('✗ Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('COMPASS ANALYSIS OPTIMIZATION TEST SUITE');
  console.log('Testing compact format (81% token reduction: 682 → 133 tokens)');
  console.log('='.repeat(70));

  // Test 1: Security/Force action
  await testCompassAnalysis(
    'Security Action - Military Crackdown',
    'Impose Curfew. Restrict movement after dusk with visible patrols.',
    ['what.6', 'how.7'] // Security, Enforce
  );

  // Test 2: Liberty/Freedom action
  await testCompassAnalysis(
    'Liberty Action - Free Speech',
    'Lift Censorship. Allow journalists to publish without government approval.',
    ['what.1', 'what.0'] // Liberty, Truth
  );

  // Test 3: Equality/Care action
  await testCompassAnalysis(
    'Equality Action - Universal Healthcare',
    'Establish Free Healthcare. Provide medical services to all citizens regardless of income.',
    ['what.2', 'what.3', 'what.5'] // Equality, Care, Wellbeing
  );

  // Test 4: Markets/Pragmatism
  await testCompassAnalysis(
    'Market Action - Deregulation',
    'Cut Business Regulations. Remove restrictions to let market forces drive economic growth.',
    ['how.3', 'whence.6'] // Markets, Pragmatism
  );

  // Test 5: Tradition/Ritual
  await testCompassAnalysis(
    'Traditional Action - Religious Ceremony',
    'Restore National Holiday. Reinstate traditional religious ceremony as official state event.',
    ['whence.3', 'how.5', 'what.9'] // Tradition, Ritual, Sacred
  );

  // Test 6: Multiple recipients
  await testCompassAnalysis(
    'Global Humanitarian Aid',
    'Send Foreign Aid. Allocate national resources to help refugees in neighboring countries.',
    ['what.3', 'whither.6', 'whither.7'] // Care, Humanity, Earth
  );

  // Test 7: Evidence-based policy
  await testCompassAnalysis(
    'Evidence-Based Policy - Climate Science',
    'Implement Carbon Tax. Base emissions policy on scientific evidence and economic modeling.',
    ['whence.0', 'whither.7', 'how.3'] // Evidence, Earth, Markets
  );

  // Test 8: Mobilization/Collective action
  await testCompassAnalysis(
    'Popular Mobilization - Organize Protests',
    'Support Workers Strike. Encourage labor unions to organize mass demonstrations for wage increases.',
    ['how.2', 'what.2', 'whither.3'] // Mobilize, Equality, InGroup
  );

  // Test 9: Personal/Individual focus
  await testCompassAnalysis(
    'Personal Liberty - Individual Rights',
    'Protect Privacy. Guarantee individual right to personal data control based on conscience.',
    ['what.1', 'whence.2', 'whither.0'] // Liberty, Personal, Self
  );

  // Test 10: Complex multi-dimensional action
  await testCompassAnalysis(
    'Complex Policy - Educational Reform',
    'Reform Education System. Update curriculum based on evidence, promote critical thinking, and ensure equal access for all communities.',
    ['whence.0', 'what.0', 'what.2', 'how.8'] // Evidence, Truth, Equality, CivicCulture
  );

  console.log('\n' + '='.repeat(70));
  console.log('ACCURACY ASSESSMENT');
  console.log('='.repeat(70));
  console.log('Review above results to verify:');
  console.log('1. Correct component identification (prop.idx matches action themes)');
  console.log('2. Appropriate polarity (positive for support, negative for opposition)');
  console.log('3. Reasonable strength assessment (mild vs strong)');
  console.log('4. Coverage of main political dimensions (what/whence/how/whither)');
  console.log('\nIf accuracy is maintained, optimization is successful! ✓');
  console.log('If accuracy drops significantly, may need to adjust compact format.');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
