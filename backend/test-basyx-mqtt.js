const mqtt = require('mqtt');

// BaSyx MQTT broker'ına bağlan
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('✅ BaSyx MQTT broker bağlantısı başarılı!');
  console.log('📡 Test mesajı gönderiliyor...');
  
  // Test topic'ine mesaj gönder
  client.publish('IIoT/test', JSON.stringify({
    message: 'Hello from IIoT Platform',
    timestamp: new Date().toISOString(),
    source: 'iiot-backend'
  }));
  
  // BaSyx topic'lerini dinle
  client.subscribe('BaSyx/+/+/+');
  client.subscribe('IIoT/+');
  
  console.log('🔊 BaSyx ve IIoT topic\'leri dinleniyor...');
});

client.on('message', (topic, message) => {
  console.log(`📨 Mesaj alındı:`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Message: ${message.toString()}`);
});

client.on('error', (error) => {
  console.error('❌ MQTT bağlantı hatası:', error);
});

client.on('close', () => {
  console.log('🔌 MQTT bağlantısı kapatıldı');
});

// 10 saniye sonra bağlantıyı kapat
setTimeout(() => {
  console.log('🏁 Test tamamlandı, bağlantı kapatılıyor...');
  client.end();
  process.exit(0);
}, 10000);