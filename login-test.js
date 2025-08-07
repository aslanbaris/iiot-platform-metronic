const { chromium } = require('playwright');

async function loginTest() {
  console.log('Login testi başlatılıyor...');
  
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
    await page.screenshot({ path: 'login-test-1-initial.png', fullPage: true });
    console.log('İlk ekran görüntüsü alındı: login-test-1-initial.png');
    
    // Email alanını bul ve doldur
    console.log('Email alanı aranıyor...');
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[id*="email" i]',
      'input[name*="email" i]'
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        emailInput = element;
        console.log(`Email alanı bulundu: ${selector}`);
        break;
      }
    }
    
    // Şifre alanını bul
    console.log('Şifre alanı aranıyor...');
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (emailInput && await passwordInput.count() > 0) {
      console.log('Email ve şifre alanları bulundu. Form dolduruluyor...');
      
      // Demo bilgileri ile formu doldur
      await emailInput.fill('demo@kt.com');
      console.log('Email alanı dolduruldu: demo@kt.com');
      
      await passwordInput.fill('Demo123!');
      console.log('Şifre alanı dolduruldu');
      
      // Form doldurulduktan sonra ekran görüntüsü
      await page.screenshot({ path: 'login-test-2-filled.png', fullPage: true });
      console.log('Form dolduruldu ekran görüntüsü: login-test-2-filled.png');
      
      // Giriş butonunu bul ve tıkla
      console.log('Giriş butonu aranıyor...');
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Giriş")',
        'button:has-text("Login")',
        'button:has-text("Submit")',
        'form button'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          submitButton = element;
          console.log(`Giriş butonu bulundu: ${selector}`);
          break;
        }
      }
      
      if (submitButton) {
        console.log('Giriş butonuna tıklanıyor...');
        await submitButton.click();
        
        // Yanıt için bekle
        await page.waitForTimeout(3000);
        
        console.log('Giriş sonrası URL:', page.url());
        
        // Giriş sonrası ekran görüntüsü
        await page.screenshot({ path: 'login-test-3-after-submit.png', fullPage: true });
        console.log('Giriş sonrası ekran görüntüsü: login-test-3-after-submit.png');
        
        // Giriş başarılı mı kontrol et
        if (!page.url().includes('/auth/signin')) {
          console.log('✅ GİRİŞ BAŞARILI! Yönlendirilen URL:', page.url());
          
          // Dashboard sayfasında biraz bekle
          await page.waitForTimeout(2000);
          
          // Dashboard ekran görüntüsü
          await page.screenshot({ path: 'login-test-4-dashboard.png', fullPage: true });
          console.log('Dashboard ekran görüntüsü: login-test-4-dashboard.png');
          
        } else {
          console.log('❌ Giriş başarısız - hala login sayfasında');
          
          // Hata mesajlarını kontrol et
          const errorSelectors = [
            '.error',
            '.alert-danger',
            '.text-danger',
            '[class*="error"]',
            '[class*="danger"]',
            'div:has-text("Invalid")',
            'div:has-text("Error")',
            'div:has-text("Hata")',
            '.invalid-feedback'
          ];
          
          for (const selector of errorSelectors) {
            const errorElement = page.locator(selector).first();
            if (await errorElement.count() > 0) {
              const errorText = await errorElement.textContent();
              console.log(`Hata mesajı bulundu: ${errorText}`);
            }
          }
        }
      } else {
        console.log('❌ Giriş butonu bulunamadı');
        
        // Tüm butonları listele
        const allButtons = await page.locator('button').all();
        console.log(`Sayfada ${allButtons.length} buton bulundu:`);
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = await button.textContent() || '';
          const type = await button.getAttribute('type') || 'button';
          console.log(`  Buton ${i + 1}: "${text.trim()}", type="${type}"`);
        }
      }
    } else {
      console.log('❌ Email veya şifre alanı bulunamadı');
      
      // Tüm input alanlarını listele
      const allInputs = await page.locator('input').all();
      console.log(`Sayfada ${allInputs.length} input alanı bulundu:`);
      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        const type = await input.getAttribute('type') || 'text';
        const name = await input.getAttribute('name') || 'isimsiz';
        const placeholder = await input.getAttribute('placeholder') || 'placeholder yok';
        console.log(`  Input ${i + 1}: type="${type}", name="${name}", placeholder="${placeholder}"`);
      }
    }
    
    console.log('\n=== LOGIN TEST TAMAMLANDI ===');
    
    // Test sonunda 5 saniye bekle (görsel kontrol için)
    console.log('5 saniye bekleniyor (görsel kontrol için)...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Test hatası:', error.message);
    await page.screenshot({ path: 'login-test-error.png', fullPage: true });
    console.log('Hata ekran görüntüsü: login-test-error.png');
  } finally {
    await browser.close();
    console.log('Tarayıcı kapatıldı.');
  }
}

loginTest();