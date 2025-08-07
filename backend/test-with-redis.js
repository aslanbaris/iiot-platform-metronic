const express = require('express');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('Starting server with database and Redis connection...');
logger.info('Logger initialized successfully');

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');
    logger.info('✅ Database connected successfully');
    
    console.log('Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected successfully');
    logger.info('✅ Redis connected successfully');
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      logger.info(`✅ Server running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();