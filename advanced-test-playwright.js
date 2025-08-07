const { chromium } = require('playwright');

async function runAdvancedTest() {
  console.log('Starting advanced Playwright test...');
  
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
    
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Take initial screenshot
    await page.screenshot({ path: 'login-page-initial.png' });
    console.log('Initial screenshot saved as login-page-initial.png');
    
    // Check if we're on login page
    if (page.url().includes('/auth/signin')) {
      console.log('We are on the login page. Attempting to fill login form...');
      
      // Wait for form elements
      await page.waitForSelector('form', { timeout: 5000 });
      
      // Look for email input (try different selectors)
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]'
      ];
      
      let emailInput = null;
      for (const selector of emailSelectors) {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          emailInput = element;
          console.log(`Found email input with selector: ${selector}`);
          break;
        }
      }
      
      // Look for password input
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (emailInput && await passwordInput.count() > 0) {
        console.log('Found both email and password inputs. Filling form...');
        
        // Fill the form
        await emailInput.fill('demo@kt.com');
        await passwordInput.fill('Demo123!');
        
        console.log('Form filled with credentials');
        
        // Take screenshot after filling form
        await page.screenshot({ path: 'login-form-filled.png' });
        console.log('Screenshot after filling form saved as login-form-filled.png');
        
        // Look for submit button
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Sign In")',
          'button:has-text("Login")',
          'button:has-text("Submit")'
        ];
        
        let submitButton = null;
        for (const selector of submitSelectors) {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            submitButton = element;
            console.log(`Found submit button with selector: ${selector}`);
            break;
          }
        }
        
        if (submitButton) {
          console.log('Clicking submit button...');
          await submitButton.click();
          
          // Wait for navigation or response
          await page.waitForTimeout(3000);
          
          console.log('After submit - Current URL:', page.url());
          
          // Take screenshot after submit
          await page.screenshot({ path: 'after-login-attempt.png' });
          console.log('Screenshot after login attempt saved as after-login-attempt.png');
          
          // Check if login was successful (URL change or success message)
          if (!page.url().includes('/auth/signin')) {
            console.log('✅ Login appears to be successful! Redirected to:', page.url());
          } else {
            console.log('❌ Still on login page. Checking for error messages...');
            
            // Look for error messages
            const errorSelectors = [
              '.error',
              '.alert-danger',
              '[class*="error"]',
              '[class*="danger"]',
              'div:has-text("Invalid")',
              'div:has-text("Error")'
            ];
            
            for (const selector of errorSelectors) {
              const errorElement = page.locator(selector).first();
              if (await errorElement.count() > 0) {
                const errorText = await errorElement.textContent();
                console.log(`Found error message: ${errorText}`);
              }
            }
          }
        } else {
          console.log('❌ Could not find submit button');
        }
      } else {
        console.log('❌ Could not find email or password input fields');
        
        // Debug: show all input elements
        const allInputs = await page.locator('input').all();
        console.log(`Found ${allInputs.length} input elements:`);
        for (let i = 0; i < allInputs.length; i++) {
          const input = allInputs[i];
          const type = await input.getAttribute('type') || 'text';
          const name = await input.getAttribute('name') || 'no-name';
          const placeholder = await input.getAttribute('placeholder') || 'no-placeholder';
          console.log(`  Input ${i + 1}: type="${type}", name="${name}", placeholder="${placeholder}"`);
        }
      }
    } else {
      console.log('Not on login page. Current URL:', page.url());
    }
    
    console.log('Advanced test completed!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Error screenshot saved as error-screenshot.png');
  } finally {
    await browser.close();
  }
}

runAdvancedTest();