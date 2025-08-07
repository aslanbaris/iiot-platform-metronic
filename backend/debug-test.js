console.log('Starting debug test...');

try {
  console.log('Testing logger import...');
  const logger = require('./src/utils/logger');
  console.log('Logger imported successfully');
  
  console.log('Testing database import...');
  const { connectDB } = require('./src/config/database');
  console.log('Database module imported successfully');
  
  console.log('Testing database connection...');
  connectDB().then(() => {
    console.log('Database connected successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
  
} catch (error) {
  console.error('Module import error:', error);
  process.exit(1);
}