// Debug script to analyze progressive loading issues in event screen
const { chromium } = require('playwright');

async function analyzeProgressiveLoading() {
  console.log('🎭 Starting Playwright analysis of progressive loading...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the app
  console.log('📍 Navigating to http://localhost:5173');
  await page.goto('http://localhost:5173');

  // Wait for initial load
  await page.waitForTimeout(2000);

  // Take screenshot of initial state
  await page.screenshot({ path: 'initial-state.png' });
  console.log('📸 Screenshot taken: initial-state.png');

  // Check if we're on the event screen by looking for specific elements
  const hasResourceBar = await page.locator('[data-testid="resource-bar"], .resource-bar, [class*="ResourceBar"]').count() > 0;
  const hasSupportList = await page.locator('[data-testid="support-list"], .support-list, [class*="SupportList"]').count() > 0;
  const hasNewsTicker = await page.locator('[data-testid="news-ticker"], .news-ticker, [class*="NewsTicker"]').count() > 0;
  const hasPlayerStatus = await page.locator('[data-testid="player-status"], .player-status, [class*="PlayerStatus"]').count() > 0;
  const hasDilemmaCard = await page.locator('[data-testid="dilemma-card"], .dilemma-card, [class*="DilemmaCard"]').count() > 0;
  const hasActionDeck = await page.locator('[data-testid="action-deck"], .action-deck, [class*="ActionDeck"]').count() > 0;
  const hasLoadingCard = await page.locator('[data-testid="loading-card"], .loading-card, [class*="LoadingCard"]').count() > 0;

  console.log('🔍 Component Analysis:');
  console.log(`  ResourceBar: ${hasResourceBar ? '✅' : '❌'}`);
  console.log(`  SupportList: ${hasSupportList ? '✅' : '❌'}`);
  console.log(`  NewsTicker: ${hasNewsTicker ? '✅' : '❌'}`);
  console.log(`  PlayerStatus: ${hasPlayerStatus ? '✅' : '❌'}`);
  console.log(`  DilemmaCard: ${hasDilemmaCard ? '✅' : '❌'}`);
  console.log(`  ActionDeck: ${hasActionDeck ? '✅' : '❌'}`);
  console.log(`  LoadingCard: ${hasLoadingCard ? '✅' : '❌'}`);

  // Check console logs for progressive loading debug messages
  page.on('console', msg => {
    if (msg.text().includes('useProgressiveLoading') ||
        msg.text().includes('EventScreen') ||
        msg.text().includes('Boolean Gates')) {
      console.log(`🖥️  Console: ${msg.text()}`);
    }
  });

  // Try to navigate to event screen if not already there
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);

  if (!currentUrl.includes('#event') && !currentUrl.includes('/event')) {
    console.log('🧭 Attempting to navigate to event screen...');
    // Try to navigate to event screen via hash
    await page.goto('http://localhost:5173/#event');
    await page.waitForTimeout(3000);

    // Take another screenshot
    await page.screenshot({ path: 'event-screen-state.png' });
    console.log('📸 Screenshot taken: event-screen-state.png');

    // Re-check components
    const hasResourceBarAfter = await page.locator('[data-testid="resource-bar"], .resource-bar, [class*="ResourceBar"]').count() > 0;
    const hasSupportListAfter = await page.locator('[data-testid="support-list"], .support-list, [class*="SupportList"]').count() > 0;
    const hasNewsTickerAfter = await page.locator('[data-testid="news-ticker"], .news-ticker, [class*="NewsTicker"]').count() > 0;
    const hasPlayerStatusAfter = await page.locator('[data-testid="player-status"], .player-status, [class*="PlayerStatus"]').count() > 0;

    console.log('🔍 Component Analysis After Navigation:');
    console.log(`  ResourceBar: ${hasResourceBarAfter ? '✅' : '❌'}`);
    console.log(`  SupportList: ${hasSupportListAfter ? '✅' : '❌'}`);
    console.log(`  NewsTicker: ${hasNewsTickerAfter ? '✅' : '❌'}`);
    console.log(`  PlayerStatus: ${hasPlayerStatusAfter ? '✅' : '❌'}`);
  }

  // Keep browser open for manual inspection
  console.log('🔍 Browser will remain open for manual inspection. Press Ctrl+C to close.');

  // Wait indefinitely until manually closed
  await page.waitForTimeout(60000); // 1 minute timeout

  await browser.close();
}

analyzeProgressiveLoading().catch(console.error);