// Simple login test without puppeteer
const https = require('http');

const postData = JSON.stringify({
  email: 'demo@kt.com',
  password: 'Demo123!'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing login API endpoint...');
console.log('URL: http://localhost:5001/api/v1/auth/login');
console.log('Data:', postData);

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        console.log('✅ Login API is working!');
        console.log('Access Token:', parsed.data?.token ? 'Present' : 'Missing');
        console.log('User Data:', parsed.data?.user ? 'Present' : 'Missing');
      } else {
        console.log('❌ Login failed:', parsed.error?.message || 'Unknown error');
      }
    } catch (e) {
      console.log('❌ Invalid JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.write(postData);
req.end();