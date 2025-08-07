const { chromium } = require('playwright');

async function debugNetworkRequests() {
  console.log('Network debug testi başlatılıyor...');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Network isteklerini dinle
  page.on('request', request => {
    console.log('🔵 REQUEST:', request.method(), request.url());
    if (request.method() === 'POST') {
      console.log('📤 POST Data:', request.postData());
    }
  });
  
  page.on('response', response => {
    console.log('🔴 RESPONSE:', response.status(), response.url());
  });
  
  page.on('requestfailed', request => {
    console.log('❌ REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });
  
  // Console loglarını dinle
  page.on('console', msg => {
    console.log('🖥️ CONSOLE:', msg.type(), msg.text());
  });
  
  try {
    console.log('Login sayfasına gidiliyor...');
    await page.goto('http://localhost:5173/auth/signin?next=%2F', { waitUntil: 'networkidle' });
    
    console.log('Form elemanları bekleniyor...');
    await page.waitForSelector('input[placeholder="Your email"]', { timeout: 10000 });
    await page.waitForSelector('input[placeholder="Your password"]', { timeout: 10000 });
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    
    console.log('Form dolduruluyor...');
    await page.fill('input[placeholder="Your email"]', 'demo@kt.com');
    await page.fill('input[placeholder="Your password"]', 'demo123');
    
    console.log('Submit butonuna tıklanıyor...');
    await page.click('button[type="submit"]');
    
    // 10 saniye bekle ve network isteklerini gözlemle
    console.log('Network istekleri gözlemleniyor...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Test hatası:', error);
  } finally {
    console.log('Test tamamlandı. Tarayıcı 30 saniye açık kalacak...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

debugNetworkRequests().catch(console.error);