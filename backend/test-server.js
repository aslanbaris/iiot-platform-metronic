console.log('Starting test server...');
require('dotenv').config();
console.log('Environment loaded');

const logger = require('./src/utils/logger');
console.log('Logger loaded');
logger.info('Logger test message');

const { connectDB } = require('./src/config/database');
console.log('Database module loaded');

async function testDB() {
  try {
    console.log('Attempting database connection...');
    await connectDB();
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testDB();