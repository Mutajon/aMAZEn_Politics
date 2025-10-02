// Focused script to analyze progressive loading on event screen
const { chromium } = require('playwright');

async function analyzeEventScreen() {
  console.log('🎭 Analyzing event screen progressive loading...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  const page = await browser.newPage();

  // Capture ALL console logs related to progressive loading
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('useProgressiveLoading') ||
        text.includes('EventScreen') ||
        text.includes('Boolean Gates') ||
        text.includes('progressive') ||
        text.includes('[') ||
        text.includes('should') ||
        text.includes('Stage') ||
        text.includes('Component')) {
      console.log(`🖥️  ${text}`);
    }
  });

  try {
    // Navigate to app
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1000);

    // Try to navigate directly to event screen with sample data
    console.log('📍 Attempting direct navigation to event screen...');
    await page.goto('http://localhost:5173/#event');
    await page.waitForTimeout(2000);

    // Observe progressive loading for 10 seconds
    console.log('⏱️  Observing progressive loading for 10 seconds...');

    // Check component state every second for 10 seconds
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);

      const hasResourceBar = await page.locator('[class*="ResourceBar"], .sticky').count() > 0;
      const hasSupportList = await page.locator('[class*="SupportList"], [class*="support"]').count() > 0;
      const hasNewsTicker = await page.locator('[class*="NewsTicker"], [class*="news"]').count() > 0;
      const hasPlayerStatus = await page.locator('[class*="PlayerStatus"], [class*="player"]').count() > 0;
      const hasDilemmaCard = await page.locator('[class*="DilemmaCard"], [class*="dilemma"]').count() > 0;
      const hasActionDeck = await page.locator('[class*="ActionDeck"], [class*="action"]').count() > 0;

      console.log(`📊 Second ${i+1}: R:${hasResourceBar?'✅':'❌'} S:${hasSupportList?'✅':'❌'} N:${hasNewsTicker?'✅':'❌'} P:${hasPlayerStatus?'✅':'❌'} D:${hasDilemmaCard?'✅':'❌'} A:${hasActionDeck?'✅':'❌'}`);
    }

    // Take final screenshot
    await page.screenshot({ path: 'event-screen-final.png' });
    console.log('📸 Final screenshot: event-screen-final.png');

    // Get page content for analysis
    const bodyText = await page.locator('body').textContent();
    const hasAnyContent = bodyText && bodyText.trim().length > 0;
    console.log(`📄 Page has content: ${hasAnyContent ? 'Yes' : 'No'} (${bodyText?.length || 0} chars)`);

    // Check DOM elements
    const allDivs = await page.locator('div').count();
    const visibleDivs = await page.locator('div:visible').count();
    console.log(`📦 Total divs: ${allDivs}, Visible: ${visibleDivs}`);

    console.log('✅ Analysis complete. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  }

  await browser.close();
}

analyzeEventScreen().catch(console.error);