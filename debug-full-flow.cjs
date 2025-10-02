// Debug script to analyze the complete user flow from splash screen to event screen
const { chromium } = require('playwright');

async function analyzeFullFlow() {
  console.log('🎭 Starting complete user flow analysis...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down actions to see what's happening
  });
  const page = await browser.newPage();

  // Listen to all console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('useProgressiveLoading') ||
        text.includes('EventScreen') ||
        text.includes('Boolean Gates') ||
        text.includes('startFirstDayLoading') ||
        text.includes('progressive') ||
        text.includes('Loading') ||
        text.includes('[') // Catch debug logs
        ) {
      console.log(`🖥️  Console: ${text}`);
    }
  });

  // Navigate to the app
  console.log('📍 Step 1: Navigating to http://localhost:5173');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Take screenshot of splash screen
  await page.screenshot({ path: 'step1-splash.png' });
  console.log('📸 Screenshot: step1-splash.png');

  console.log('🔍 Step 1 Analysis: Looking for splash screen elements...');
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);

  // Look for navigation elements or buttons to proceed
  const hasStartButton = await page.locator('button, [role="button"]').count();
  console.log(`🔘 Found ${hasStartButton} buttons/clickable elements`);

  // Try to find and click the first button or navigation element
  if (hasStartButton > 0) {
    console.log('👆 Step 2: Clicking first available button/link...');
    await page.locator('button, [role="button"], a').first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'step2-after-click.png' });
    console.log('📸 Screenshot: step2-after-click.png');
  }

  // Check if we've moved to a different screen
  const newUrl = page.url();
  console.log(`📍 URL after click: ${newUrl}`);

  // If we're on role selection, try to enter a role
  if (newUrl.includes('role') || await page.locator('input[type="text"], textarea').count() > 0) {
    console.log('📝 Step 3: Found role input, entering role...');
    const roleInput = page.locator('input[type="text"], textarea').first();
    await roleInput.fill('Chancellor of Modern Germany');
    await page.waitForTimeout(1000);

    // Look for submit/continue button
    const submitButton = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Submit"), button[type="submit"]').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'step3-role-submitted.png' });
      console.log('📸 Screenshot: step3-role-submitted.png');
    }
  }

  // Continue through the flow - look for power distribution screen
  let currentStep = 4;
  for (let i = 0; i < 10; i++) { // Max 10 steps to prevent infinite loop
    const url = page.url();
    console.log(`📍 Step ${currentStep}: Current URL: ${url}`);

    // Take screenshot of current state
    await page.screenshot({ path: `step${currentStep}-current.png` });
    console.log(`📸 Screenshot: step${currentStep}-current.png`);

    // Look for continue/next buttons
    const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Start"), button:has-text("Begin")').first();
    const clickableElements = await page.locator('button, [role="button"], a').count();

    console.log(`🔘 Found ${clickableElements} clickable elements`);

    if (await continueButton.count() > 0) {
      console.log(`👆 Step ${currentStep}: Clicking continue button...`);
      await continueButton.click();
      await page.waitForTimeout(3000);
    } else if (clickableElements > 0) {
      console.log(`👆 Step ${currentStep}: Clicking first available element...`);
      await page.locator('button, [role="button"], a').first().click();
      await page.waitForTimeout(3000);
    } else {
      console.log(`⏭️  Step ${currentStep}: No clickable elements found, checking if we're on event screen...`);
      break;
    }

    // Check if we've reached the event screen
    if (url.includes('event') || url.includes('#event')) {
      console.log('🎯 Reached event screen! Analyzing components...');
      break;
    }

    currentStep++;
  }

  // Final analysis on event screen
  console.log('\n🔍 FINAL EVENT SCREEN ANALYSIS:');
  const finalUrl = page.url();
  console.log(`📍 Final URL: ${finalUrl}`);

  // Wait a bit more for any loading to complete
  await page.waitForTimeout(5000);

  // Check for all event screen components
  const hasResourceBar = await page.locator('[class*="ResourceBar"], [class*="resource"], .sticky').count() > 0;
  const hasSupportList = await page.locator('[class*="SupportList"], [class*="support"]').count() > 0;
  const hasNewsTicker = await page.locator('[class*="NewsTicker"], [class*="news"], [class*="ticker"]').count() > 0;
  const hasPlayerStatus = await page.locator('[class*="PlayerStatus"], [class*="player"], [class*="status"]').count() > 0;
  const hasDilemmaCard = await page.locator('[class*="DilemmaCard"], [class*="dilemma"]').count() > 0;
  const hasActionDeck = await page.locator('[class*="ActionDeck"], [class*="action"]').count() > 0;
  const hasLoadingCard = await page.locator('[class*="LoadingCard"], [class*="loading"]').count() > 0;

  console.log('🔍 Component Analysis (with role data):');
  console.log(`  ResourceBar: ${hasResourceBar ? '✅' : '❌'}`);
  console.log(`  SupportList: ${hasSupportList ? '✅' : '❌'}`);
  console.log(`  NewsTicker: ${hasNewsTicker ? '✅' : '❌'}`);
  console.log(`  PlayerStatus: ${hasPlayerStatus ? '✅' : '❌'}`);
  console.log(`  DilemmaCard: ${hasDilemmaCard ? '✅' : '❌'}`);
  console.log(`  ActionDeck: ${hasActionDeck ? '✅' : '❌'}`);
  console.log(`  LoadingCard: ${hasLoadingCard ? '✅' : '❌'}`);

  // Take final screenshot
  await page.screenshot({ path: 'final-event-screen.png' });
  console.log('📸 Final Screenshot: final-event-screen.png');

  // Check DOM structure
  const allElements = await page.locator('*').count();
  const visibleElements = await page.locator(':visible').count();
  console.log(`📊 Total DOM elements: ${allElements}`);
  console.log(`👁️  Visible elements: ${visibleElements}`);

  console.log('\n🔍 Browser will remain open for manual inspection. Press Ctrl+C to close.');

  // Wait for manual inspection
  await page.waitForTimeout(60000); // 1 minute timeout

  await browser.close();
}

analyzeFullFlow().catch(console.error);