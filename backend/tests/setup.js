const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const { createClient } = require('redis');

// Global test variables
let mongoServer;
let redisClient;

// Setup before all tests
beforeAll(async () => {
  // Setup MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to MongoDB
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  // Setup Redis Mock
  const redis = require('redis-mock');
  redisClient = redis.createClient();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  process.env.MONGODB_URI = mongoUri;
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.MQTT_BROKER_URL = 'mqtt://localhost:1883';
  process.env.LOG_LEVEL = 'error';
  
  // Suppress console output during tests
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}, 60000);

// Cleanup after all tests
afterAll(async () => {
  // Close MongoDB connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  // Stop MongoDB Memory Server
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  // Close Redis connection
  if (redisClient) {
    redisClient.disconnect();
  }
}, 60000);

// Clean up after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Clear Redis cache
  if (redisClient) {
    await redisClient.flushall();
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: async (userData = {}) => {
    const User = require('../src/models/User');
    const bcrypt = require('bcryptjs');
    
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 12),
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isActive: true,
      isEmailVerified: true
    };
    
    return User.create({ ...defaultUser, ...userData });
  },
  
  // Create test device
  createTestDevice: async (deviceData = {}) => {
    const Device = require('../src/models/Device');
    
    const defaultDevice = {
      name: 'Test Device',
      type: 'sensor',
      location: 'Test Location',
      description: 'Test device description',
      isActive: true,
      configuration: {
        sampleRate: 1000,
        protocol: 'MQTT'
      }
    };
    
    return Device.create({ ...defaultDevice, ...deviceData });
  },
  
  // Create test sensor
  createTestSensor: async (sensorData = {}) => {
    const Sensor = require('../src/models/Sensor');
    
    const defaultSensor = {
      name: 'Test Sensor',
      type: 'temperature',
      unit: '°C',
      description: 'Test sensor description',
      isActive: true,
      configuration: {
        minValue: -50,
        maxValue: 100,
        precision: 2
      }
    };
    
    return Sensor.create({ ...defaultSensor, ...sensorData });
  },
  
  // Create test alert
  createTestAlert: async (alertData = {}) => {
    const Alert = require('../src/models/Alert');
    
    const defaultAlert = {
      title: 'Test Alert',
      description: 'Test alert description',
      type: 'threshold',
      severity: 'medium',
      status: 'active',
      source: 'system'
    };
    
    return Alert.create({ ...defaultAlert, ...alertData });
  },
  
  // Generate JWT token for testing
  generateTestToken: (userId, role = 'user') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        userId, 
        role,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  // Generate refresh token for testing
  generateTestRefreshToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        userId,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  },
  
  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock MQTT client
  mockMQTTClient: () => {
    const EventEmitter = require('events');
    const mockClient = new EventEmitter();
    
    mockClient.publish = jest.fn((topic, message, callback) => {
      if (callback) callback();
    });
    
    mockClient.subscribe = jest.fn((topic, callback) => {
      if (callback) callback();
    });
    
    mockClient.unsubscribe = jest.fn((topic, callback) => {
      if (callback) callback();
    });
    
    mockClient.end = jest.fn((callback) => {
      if (callback) callback();
    });
    
    mockClient.connected = true;
    
    return mockClient;
  },
  
  // Mock WebSocket
  mockWebSocket: () => {
    const EventEmitter = require('events');
    const mockWS = new EventEmitter();
    
    mockWS.send = jest.fn();
    mockWS.close = jest.fn();
    mockWS.terminate = jest.fn();
    mockWS.readyState = 1; // OPEN
    
    return mockWS;
  },
  
  // Mock Redis client
  mockRedisClient: () => {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      flushall: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn()
    };
  }
};

// Custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false
      };
    }
  },
  
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Date`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Date`,
        pass: false
      };
    }
  },
  
  toBeValidJWT(received) {
    const jwt = require('jsonwebtoken');
    try {
      jwt.verify(received, process.env.JWT_SECRET);
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false
      };
    }
  }
});

// Increase timeout for async operations
jest.setTimeout(30000);