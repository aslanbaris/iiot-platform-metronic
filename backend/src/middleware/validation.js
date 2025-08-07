const { validationResult } = require('express-validator');
const { AppError, formatValidationErrors } = require('./errorHandler');
const logger = require('../utils/logger');

// Middleware to handle validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = formatValidationErrors(errors.array());
    
    logger.warn('Validation failed', {
      url: req.originalUrl,
      method: req.method,
      errors: formattedErrors,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Custom validation functions
const isValidUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

const isValidDeviceId = (value) => {
  // Device IDs can be alphanumeric with hyphens and underscores
  const deviceIdRegex = /^[a-zA-Z0-9_-]{1,50}$/;
  return deviceIdRegex.test(value);
};

const isValidSensorId = (value) => {
  // Sensor IDs can be alphanumeric with hyphens and underscores
  const sensorIdRegex = /^[a-zA-Z0-9_-]{1,50}$/;
  return sensorIdRegex.test(value);
};

const isValidTimestamp = (value) => {
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
};

const isValidSeverity = (value) => {
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  return validSeverities.includes(value);
};

const isValidStatus = (value) => {
  const validStatuses = ['online', 'offline', 'maintenance', 'error'];
  return validStatuses.includes(value);
};

const isValidRole = (value) => {
  const validRoles = ['admin', 'operator', 'viewer'];
  return validRoles.includes(value);
};

const isValidAlertType = (value) => {
  const validTypes = ['threshold', 'anomaly', 'offline', 'maintenance'];
  return validTypes.includes(value);
};

// Sanitization functions
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>"'&]/g, '');
};

const sanitizeNumber = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const sanitizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

// Validation middleware for specific data types
const validateSensorData = (req, res, next) => {
  const { sensors } = req.body;
  
  if (!Array.isArray(sensors)) {
    return next(new AppError('Sensors data must be an array', 400));
  }
  
  for (let i = 0; i < sensors.length; i++) {
    const sensor = sensors[i];
    
    if (!sensor.sensor_id || !isValidSensorId(sensor.sensor_id)) {
      return next(new AppError(`Invalid sensor_id at index ${i}`, 400));
    }
    
    if (sensor.value === undefined || sensor.value === null) {
      return next(new AppError(`Missing value for sensor at index ${i}`, 400));
    }
    
    if (typeof sensor.value !== 'number' && isNaN(parseFloat(sensor.value))) {
      return next(new AppError(`Invalid value for sensor at index ${i}`, 400));
    }
    
    // Sanitize the sensor data
    sensors[i] = {
      sensor_id: sanitizeString(sensor.sensor_id),
      value: sanitizeNumber(sensor.value),
      unit: sensor.unit ? sanitizeString(sensor.unit) : null,
      metadata: sensor.metadata || null
    };
  }
  
  req.body.sensors = sensors;
  next();
};

// Validate pagination parameters
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10, sort = 'created_at', order = 'desc' } = req.query;
  
  // Validate page
  const pageNum = parseInt(page);
  if (isNaN(pageNum) || pageNum < 1) {
    return next(new AppError('Page must be a positive integer', 400));
  }
  
  // Validate limit
  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return next(new AppError('Limit must be between 1 and 100', 400));
  }
  
  // Validate order
  if (!['asc', 'desc'].includes(order.toLowerCase())) {
    return next(new AppError('Order must be asc or desc', 400));
  }
  
  // Set validated values
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
    sort: sanitizeString(sort),
    order: order.toLowerCase()
  };
  
  next();
};

// Validate date range parameters
const validateDateRange = (req, res, next) => {
  const { start_date, end_date } = req.query;
  
  if (start_date && !isValidTimestamp(start_date)) {
    return next(new AppError('Invalid start_date format', 400));
  }
  
  if (end_date && !isValidTimestamp(end_date)) {
    return next(new AppError('Invalid end_date format', 400));
  }
  
  if (start_date && end_date) {
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (startDate >= endDate) {
      return next(new AppError('start_date must be before end_date', 400));
    }
    
    // Check if date range is not too large (max 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (endDate - startDate > maxRange) {
      return next(new AppError('Date range cannot exceed 1 year', 400));
    }
  }
  
  req.dateRange = {
    start_date: start_date ? new Date(start_date) : null,
    end_date: end_date ? new Date(end_date) : null
  };
  
  next();
};

// Validate file upload
const validateFileUpload = (allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }
    
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
      return next(new AppError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400));
    }
    
    // Check file size
    if (req.file.size > maxSize) {
      return next(new AppError(`File size too large. Maximum size: ${maxSize / (1024 * 1024)}MB`, 400));
    }
    
    next();
  };
};

// Validate JSON structure
const validateJSON = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        const errorMessage = error.details.map(detail => detail.message).join(', ');
        return next(new AppError(`Validation error: ${errorMessage}`, 400));
      }
      
      req.body = value;
      next();
    } catch (err) {
      return next(new AppError('Invalid JSON structure', 400));
    }
  };
};

// UUID validation middleware factory
const validateUUID = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    
    if (!value) {
      return res.status(400).json({
        success: false,
        message: `Parameter ${paramName} is required`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!isValidUUID(value)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UUID format',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = {
  validate: validateRequest,
  validateRequest,
  validateSensorData,
  validatePagination,
  validateDateRange,
  validateFileUpload,
  validateJSON,
  validateUUID,
  // Validation functions
  isValidUUID,
  isValidDeviceId,
  isValidSensorId,
  isValidTimestamp,
  isValidSeverity,
  isValidStatus,
  isValidRole,
  isValidAlertType,
  // Sanitization functions
  sanitizeString,
  sanitizeNumber,
  sanitizeBoolean
};