const { chromium } = require('playwright');

async function checkDashboard() {
  console.log('Dashboard kontrol testi başlatılıyor...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Login sayfasına git
    console.log('Login sayfasına gidiliyor...');
    await page.goto('http://localhost:5173/auth/signin');
    await page.waitForTimeout(2000);
    
    // Login bilgilerini doldur
    console.log('Login bilgileri dolduruluyor...');
    await page.fill('input[placeholder="Your email"]', 'demo@kt.com');
    await page.fill('input[placeholder="Your password"]', 'demo123');
    
    // Login butonuna tıkla
    console.log('Login butonuna tıklanıyor...');
    await page.click('button[type="submit"]');
    
    // Yönlendirmeyi bekle
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('Login sonrası URL:', currentUrl);
    
    // Dashboard içeriğini kontrol et
    console.log('Dashboard içeriği kontrol ediliyor...');
    
    // Sayfa başlığını al
    const title = await page.title();
    console.log('Sayfa başlığı:', title);
    
    // Ana içerik alanını kontrol et
    const mainContent = await page.locator('main, .main-content, [role="main"], .dashboard').first();
    const hasMainContent = await mainContent.count() > 0;
    console.log('Ana içerik alanı var mı:', hasMainContent);
    
    if (hasMainContent) {
      const contentText = await mainContent.textContent();
      console.log('Ana içerik uzunluğu:', contentText?.length || 0);
      console.log('İçerik önizlemesi (ilk 200 karakter):', contentText?.substring(0, 200) || 'Boş');
    }
    
    // Sidebar/navigation kontrol et
    const sidebar = await page.locator('.sidebar, .nav, .navigation, [role="navigation"]').first();
    const hasSidebar = await sidebar.count() > 0;
    console.log('Sidebar/Navigation var mı:', hasSidebar);
    
    // Dashboard widget'ları kontrol et
    const widgets = await page.locator('.widget, .card, .dashboard-item, .metric').count();
    console.log('Dashboard widget sayısı:', widgets);
    
    // Herhangi bir loading indicator var mı?
    const loading = await page.locator('.loading, .spinner, .skeleton').count();
    console.log('Loading indicator sayısı:', loading);
    
    // Error mesajları var mı?
    const errors = await page.locator('.error, .alert-danger, [role="alert"]').count();
    console.log('Error mesajı sayısı:', errors);
    
    // Ekran görüntüsü al
    await page.screenshot({ path: 'dashboard-check.png', fullPage: true });
    console.log('Dashboard ekran görüntüsü alındı: dashboard-check.png');
    
    console.log('\n=== DASHBOARD DURUM RAPORU ===');
    if (widgets > 0) {
      console.log('✅ Dashboard içerik dolu - Widget/kartlar mevcut');
    } else if (hasMainContent) {
      console.log('⚠️ Dashboard kısmen dolu - Ana içerik var ama widget yok');
    } else {
      console.log('❌ Dashboard boş görünüyor - Ana içerik bulunamadı');
    }
    
    // 10 saniye bekle
    console.log('\n10 saniye bekleniyor (görsel kontrol için)...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Test sırasında hata:', error.message);
    await page.screenshot({ path: 'dashboard-error.png' });
  } finally {
    await browser.close();
    console.log('Tarayıcı kapatıldı.');
  }
}

checkDashboard().catch(console.error);