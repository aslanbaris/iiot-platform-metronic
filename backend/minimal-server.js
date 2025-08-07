const express = require('express');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('Starting minimal server...');
logger.info('Logger initialized successfully');

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
  logger.info(`✅ Minimal server running on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});