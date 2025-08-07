const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '')) * 1024 * 1024 || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
    maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '')) * 1024 * 1024 || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  })
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports,
  exitOnError: false
});

// Add HTTP request logging format
logger.http = (message, meta = {}) => {
  logger.log('http', message, meta);
};

// Add custom methods for structured logging
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'anonymous'
  };
  
  const level = res.statusCode >= 400 ? 'error' : 'http';
  logger.log(level, `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`, logData);
};

logger.logError = (error, context = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };
  
  logger.error('Application Error', errorData);
};

logger.logDatabase = (query, duration, error = null) => {
  const logData = {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    duration: `${duration}ms`,
    error: error?.message
  };
  
  if (error) {
    logger.error('Database Query Error', logData);
  } else if (duration > 1000) {
    logger.warn('Slow Database Query', logData);
  } else {
    logger.debug('Database Query', logData);
  }
};

logger.logMQTT = (topic, message, direction = 'received') => {
  const logData = {
    topic,
    direction,
    messageSize: typeof message === 'string' ? message.length : JSON.stringify(message).length,
    timestamp: new Date().toISOString()
  };
  
  logger.debug(`MQTT Message ${direction}`, logData);
};

logger.logAuth = (action, userId, success, details = {}) => {
  const logData = {
    action,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  const level = success ? 'info' : 'warn';
  logger.log(level, `Auth ${action}: ${success ? 'Success' : 'Failed'}`, logData);
};

logger.logSecurity = (event, severity, details = {}) => {
  const logData = {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger.log(level, `Security Event: ${event}`, logData);
};

logger.logPerformance = (operation, duration, metadata = {}) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  
  if (duration > 5000) {
    logger.warn('Slow Operation', logData);
  } else if (duration > 1000) {
    logger.info('Performance Log', logData);
  } else {
    logger.debug('Performance Log', logData);
  }
};

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV !== 'test') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  );
  
  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  );
}

// Export logger instance
module.exports = logger;