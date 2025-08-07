const { chromium } = require('playwright');

async function loginTestCorrect() {
  console.log('Doğru bilgilerle login testi başlatılıyor...');
  
  const browser = await chromium.launch({ headless: false }); // Görsel mod
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Login sayfasına git
    console.log('Login sayfasına gidiliyor: http://localhost:5173/auth/signin?next=%2F');
    await page.goto('http://localhost:5173/auth/signin?next=%2F');
    
    // Sayfa yüklenene kadar bekle
    await page.waitForLoadState('networkidle');
    
    console.log('Mevcut URL:', page.url());
    console.log('Sayfa başlığı:', await page.title());
    
    // İlk ekran görüntüsü
    await page.screenshot({ path: 'login-correct-1-initial.png', fullPage: true });
    console.log('İlk ekran görüntüsü alındı: login-correct-1-initial.png');
    
    // Email ve şifre alanlarını bul
    const emailInput = page.locator('input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      console.log('Email ve şifre alanları bulundu. Doğru bilgilerle form dolduruluyor...');
      
      // Sayfada belirtilen demo bilgileri ile formu doldur
      await emailInput.fill('demo@kt.com');
      console.log('Email alanı dolduruldu: demo@kt.com');
      
      await passwordInput.fill('demo123'); // Sayfada belirtilen doğru şifre
      console.log('Şifre alanı dolduruldu: demo123');
      
      // Form doldurulduktan sonra ekran görüntüsü
      await page.screenshot({ path: 'login-correct-2-filled.png', fullPage: true });
      console.log('Form dolduruldu ekran görüntüsü: login-correct-2-filled.png');
      
      // Giriş butonunu bul ve tıkla
      const submitButton = page.locator('button[type="submit"]').first();
      
      if (await submitButton.count() > 0) {
        console.log('Giriş butonuna tıklanıyor...');
        await submitButton.click();
        
        // Yanıt için bekle
        await page.waitForTimeout(3000);
        
        console.log('Giriş sonrası URL:', page.url());
        
        // Giriş sonrası ekran görüntüsü
        await page.screenshot({ path: 'login-correct-3-after-submit.png', fullPage: true });
        console.log('Giriş sonrası ekran görüntüsü: login-correct-3-after-submit.png');
        
        // Giriş başarılı mı kontrol et
        if (!page.url().includes('/auth/signin')) {
          console.log('✅ GİRİŞ BAŞARILI! Yönlendirilen URL:', page.url());
          
          // Dashboard sayfasında biraz bekle
          await page.waitForTimeout(3000);
          
          // Dashboard ekran görüntüsü
          await page.screenshot({ path: 'login-correct-4-dashboard.png', fullPage: true });
          console.log('Dashboard ekran görüntüsü: login-correct-4-dashboard.png');
          
          // Dashboard'da bazı elementleri kontrol et
          const pageTitle = await page.title();
          console.log('Dashboard sayfa başlığı:', pageTitle);
          
          // Kullanıcı menüsü veya profil bilgisi var mı kontrol et
          const userMenuSelectors = [
            '[data-kt-menu-trigger]',
            '.menu-dropdown',
            '.user-menu',
            '[class*="user"]',
            '[class*="profile"]'
          ];
          
          for (const selector of userMenuSelectors) {
            const element = page.locator(selector).first();
            if (await element.count() > 0) {
              console.log(`Kullanıcı menüsü bulundu: ${selector}`);
              break;
            }
          }
          
        } else {
          console.log('❌ Giriş başarısız - hala login sayfasında');
          
          // Network Error mesajını kontrol et
          const networkError = page.locator('text=Network Error').first();
          if (await networkError.count() > 0) {
            console.log('Network Error mesajı görünüyor - backend bağlantı sorunu olabilir');
          }
          
          // Diğer hata mesajlarını kontrol et
          const errorSelectors = [
            '.alert-danger',
            '.text-danger',
            '.error-message',
            '[class*="error"]'
          ];
          
          for (const selector of errorSelectors) {
            const errorElement = page.locator(selector).first();
            if (await errorElement.count() > 0) {
              const errorText = await errorElement.textContent();
              if (errorText && errorText.trim() && !errorText.includes('function')) {
                console.log(`Hata mesajı: ${errorText.trim()}`);
              }
            }
          }
        }
      } else {
        console.log('❌ Giriş butonu bulunamadı');
      }
    } else {
      console.log('❌ Email veya şifre alanı bulunamadı');
    }
    
    console.log('\n=== DOĞRU BİLGİLERLE LOGIN TEST TAMAMLANDI ===');
    
    // Test sonunda 5 saniye bekle (görsel kontrol için)
    console.log('5 saniye bekleniyor (görsel kontrol için)...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Test hatası:', error.message);
    await page.screenshot({ path: 'login-correct-error.png', fullPage: true });
    console.log('Hata ekran görüntüsü: login-correct-error.png');
  } finally {
    await browser.close();
    console.log('Tarayıcı kapatıldı.');
  }
}

loginTestCorrect();