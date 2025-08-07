const { chromium } = require('playwright');

async function runTest() {
  console.log('Starting Playwright test...');
  
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the frontend application
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Take a screenshot
    await page.screenshot({ path: 'frontend-screenshot.png' });
    console.log('Screenshot saved as frontend-screenshot.png');
    
    // Check if login form exists
    const loginForm = await page.locator('form').count();
    console.log('Number of forms found:', loginForm);
    
    // Check for specific elements
    const emailInput = await page.locator('input[type="email"]').count();
    const passwordInput = await page.locator('input[type="password"]').count();
    
    console.log('Email inputs found:', emailInput);
    console.log('Password inputs found:', passwordInput);
    
    // Get page URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

runTest();