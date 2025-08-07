const { chromium } = require('playwright');

async function debugAuthState() {
  console.log('Auth state debug testi başlatılıyor...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Console loglarını yakala
  page.on('console', msg => {
    console.log('🖥️ CONSOLE:', msg.type(), msg.text());
  });
  
  // Network isteklerini yakala
  page.on('request', request => {
    if (request.url().includes('/auth/login')) {
      console.log('🌐 REQUEST:', request.method(), request.url());
      console.log('🌐 REQUEST BODY:', request.postData());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/auth/login')) {
      console.log('🌐 RESPONSE:', response.status(), response.url());
    }
  });
  
  try {
    // Login sayfasına git
    console.log('Login sayfasına gidiliyor...');
    await page.goto('http://localhost:5173/auth/signin');
    await page.waitForTimeout(2000);
    
    // Login bilgilerini doldur
     console.log('Login bilgileri dolduruluyor...');
     await page.fill('input[placeholder="Your email"]', 'demo@kt.com');
     await page.fill('input[placeholder="Your password"]', 'Demo123!');
     
     console.log('Login formu dolduruldu, submit ediliyor...');
     
     // Login butonunu bul ve tıkla
     console.log('Login butonuna tıklanıyor...');
     const submitButton = await page.locator('button[type="submit"]');
     await submitButton.click();
     
     // Alternatif olarak form submit
     // await page.locator('form').press('Enter');
    
    // Login işleminin tamamlanmasını bekle
    console.log('Login işlemi bekleniyor...');
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log('Login sonrası URL:', currentUrl);
    
    // LocalStorage'daki auth bilgilerini kontrol et
    const authData = await page.evaluate(() => {
      return {
        iiot_token: localStorage.getItem('iiot_token'),
        iiot_refresh_token: localStorage.getItem('iiot_refresh_token'),
        iiot_user: localStorage.getItem('iiot_user')
      };
    });
    
    console.log('\n=== AUTH STATE DEBUG ===');
    console.log('Token var mı:', !!authData.iiot_token);
    console.log('Refresh token var mı:', !!authData.iiot_refresh_token);
    console.log('User data var mı:', !!authData.iiot_user);
    
    if (authData.iiot_token) {
      console.log('Token (ilk 20 karakter):', authData.iiot_token.substring(0, 20) + '...');
    }
    
    if (authData.iiot_user) {
      try {
        const userData = JSON.parse(authData.iiot_user);
        console.log('User email:', userData.email);
        console.log('User ID:', userData.id);
      } catch (e) {
        console.log('User data parse hatası:', e.message);
      }
    }
    
    // Auth context state'ini kontrol et
    const authContextState = await page.evaluate(() => {
      // React DevTools varsa auth state'ini al
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        return 'React DevTools mevcut';
      }
      return 'React DevTools yok';
    });
    
    console.log('React DevTools durumu:', authContextState);
    
    // Eğer hala login sayfasındaysak, dashboard'a manuel olarak gitmeyi dene
    if (currentUrl.includes('/auth/')) {
      console.log('\nHala auth sayfasında, dashboard\'a manuel olarak gidiliyor...');
      await page.goto('http://localhost:5173/');
      await page.waitForTimeout(3000);
      
      const finalUrl = page.url();
      console.log('Manuel yönlendirme sonrası URL:', finalUrl);
      
      // Dashboard içeriğini kontrol et
      const dashboardTitle = await page.locator('h1').first().textContent();
      console.log('Dashboard başlığı:', dashboardTitle);
      
      const hasContent = await page.locator('.space-y-6').count() > 0;
      console.log('Dashboard içerik var mı:', hasContent);
    }
    
    // Ekran görüntüsü al
    await page.screenshot({ path: 'auth-debug.png', fullPage: true });
    console.log('\nDebug ekran görüntüsü alındı: auth-debug.png');
    
    // 10 saniye bekle
    console.log('\n10 saniye bekleniyor...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Test sırasında hata:', error.message);
    await page.screenshot({ path: 'auth-debug-error.png' });
  } finally {
    await browser.close();
    console.log('Tarayıcı kapatıldı.');
  }
}

debugAuthState().catch(console.error);