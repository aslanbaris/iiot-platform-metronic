const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { connectRedis } = require('./src/config/redis');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'IIoT Platform Backend'
  });
});

// Basic info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'IIoT Platform Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting IIoT Platform Backend...');
    logger.info('🚀 Starting IIoT Platform Backend...');
    
    // Connect to Redis
    console.log('🔴 Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected successfully');
    logger.info('✅ Redis connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📋 API Info: http://localhost:${PORT}/api/info`);
      logger.info(`🚀 Server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();