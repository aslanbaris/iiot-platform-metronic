async function createDemoUser() {
  console.log('Demo kullanıcısı oluşturuluyor...');
  
  try {
    const response = await fetch('http://localhost:5001/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'demo',
        email: 'demo@kt.com',
        password: 'Demo123!',
        first_name: 'Demo',
        last_name: 'User',
        role: 'admin'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Demo kullanıcısı başarıyla oluşturuldu!');
      console.log('Email:', data.data.user.email);
      console.log('Username:', data.data.user.username);
      console.log('Role:', data.data.user.role);
      console.log('ID:', data.data.user.id);
    } else {
      console.log('❌ Hata:', data.message);
      console.log('Status:', response.status);
      
      if (response.status === 409) {
        console.log('ℹ️ Demo kullanıcısı zaten mevcut.');
        
        // Mevcut kullanıcıyla login testi yap
        console.log('\nMevcut kullanıcıyla login testi yapılıyor...');
        try {
          const loginResponse = await fetch('http://localhost:5001/api/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: 'demo@kt.com',
              password: 'Demo123!'
            })
          });
          
          const loginData = await loginResponse.json();
          
          if (loginResponse.ok) {
            console.log('✅ Login başarılı!');
            console.log('Token alındı:', !!loginData.data.token);
            console.log('User ID:', loginData.data.user.id);
          } else {
            console.log('❌ Login hatası:', loginData.message);
          }
          
        } catch (loginError) {
          console.log('❌ Login network hatası:', loginError.message);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Network hatası:', error.message);
  }
}

createDemoUser().catch(console.error);