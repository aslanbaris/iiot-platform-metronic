const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('Tearing down test environment...');
  
  // Stop MongoDB Memory Server
  if (global.__MONGOSERVER__) {
    await global.__MONGOSERVER__.stop();
    console.log('MongoDB Memory Server stopped');
  }
  
  // Clean up test directories
  const testDirs = [
    path.join(__dirname, '../logs'),
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../backups'),
    path.join(__dirname, '../temp')
  ];
  
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        // Remove all files in the directory
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        });
        
        console.log(`Cleaned up test directory: ${dir}`);
      } catch (error) {
        console.warn(`Failed to clean up directory ${dir}:`, error.message);
      }
    }
  });
  
  // Clean up environment variables
  delete process.env.MONGODB_URI;
  delete process.env.REDIS_URL;
  delete process.env.JWT_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
  delete process.env.MQTT_BROKER_URL;
  
  console.log('Test environment teardown completed');
};