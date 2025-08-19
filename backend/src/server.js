const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectRedis } = require('./config/redis');
const { connectMQTT } = require('./config/mqtt');
const influxService = require('./services/influxService');
const mongoService = require('./services/mongoService');
// const BaSyxMQTTService = require('./services/basyxMqttService');
const { globalErrorHandler } = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const swaggerSetup = require('./config/swagger');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const sensorRoutes = require('./routes/sensors');
const dataRoutes = require('./routes/data');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const systemRoutes = require('./routes/system');
const hybridRoutes = require('./routes/hybrid');
const basyxRoutes = require('./routes/basyx');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to our router
app.set('io', io);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
const apiVersion = process.env.API_VERSION || 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/devices`, deviceRoutes);
app.use(`/api/${apiVersion}/sensors`, sensorRoutes);
app.use(`/api/${apiVersion}/data`, dataRoutes);
app.use(`/api/${apiVersion}/alerts`, alertRoutes);
app.use(`/api/${apiVersion}/analytics`, analyticsRoutes);
app.use(`/api/${apiVersion}/system`, systemRoutes);
app.use(`/api/${apiVersion}/hybrid`, hybridRoutes);
app.use(`/api/${apiVersion}/basyx`, basyxRoutes);

// Swagger documentation
swaggerSetup(app, apiVersion);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-device', (deviceId) => {
    socket.join(`device-${deviceId}`);
    logger.info(`Client ${socket.id} joined device room: ${deviceId}`);
  });
  
  socket.on('leave-device', (deviceId) => {
    socket.leave(`device-${deviceId}`);
    logger.info(`Client ${socket.id} left device room: ${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(globalErrorHandler);

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to InfluxDB (Primary time-series database)
    try {
      await influxService.connect();
      logger.info('InfluxDB connected successfully');
    } catch (error) {
      logger.error('InfluxDB connection failed:', error.message);
      logger.info('Continuing without InfluxDB...');
    }
    
    // Connect to MongoDB (Primary metadata and document database)
    try {
      await mongoService.connect();
      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('MongoDB connection failed:', error.message);
      logger.info('Continuing without MongoDB...');
    }
    
    // Connect to Redis (temporarily disabled for debugging)
    // await connectRedis();
    // logger.info('Redis connected successfully');
    logger.info('Redis temporarily disabled for debugging');
    
    // Connect to MQTT (temporarily disabled for debugging)
    // try {
    //   await connectMQTT(io);
    //   logger.info('MQTT connected successfully');
    // } catch (error) {
    //   logger.error('MQTT connection failed:', error.message);
    //   logger.info('Continuing without MQTT...');
    // }
    logger.info('MQTT temporarily disabled for debugging');
    
    // Initialize BaSyx MQTT Service (temporarily disabled)
    // try {
    //   const basyxMqtt = new BaSyxMQTTService();
    //   
    //   // Make BaSyx MQTT service available globally
    //   app.locals.basyxMqtt = basyxMqtt;
    //   
    //   // Setup BaSyx real-time events
    //   basyxMqtt.on('basyxMessage', (data) => {
    //     io.emit('basyx:event', data);
    //   });
    //   
    //   logger.info('BaSyx MQTT services initialized successfully');
    // } catch (error) {
    //   logger.error('BaSyx MQTT service initialization failed:', error.message);
    //   logger.info('Continuing without BaSyx MQTT...');
    // }
    logger.info('BaSyx MQTT service temporarily disabled');
    logger.info('All services are ready!');
    
    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };