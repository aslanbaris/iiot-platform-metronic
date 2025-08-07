const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('Setting up test environment...');
  
  // Create MongoDB Memory Server
  const mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0'
    },
    instance: {
      dbName: 'iiot_platform_test'
    }
  });
  
  const mongoUri = mongoServer.getUri();
  
  // Store the MongoDB URI and server instance globally
  global.__MONGOSERVER__ = mongoServer;
  global.__MONGO_URI__ = mongoUri;
  
  // Set environment variables for tests
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoUri;
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
  process.env.MQTT_BROKER_URL = 'mqtt://localhost:1883';
  process.env.LOG_LEVEL = 'error';
  process.env.CACHE_TTL = '60';
  process.env.RATE_LIMIT_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
  
  // Create test directories if they don't exist
  const testDirs = [
    path.join(__dirname, '../logs'),
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../backups'),
    path.join(__dirname, '../temp')
  ];
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('Test environment setup completed');
  console.log(`MongoDB URI: ${mongoUri}`);
};