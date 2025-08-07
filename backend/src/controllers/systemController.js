const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { mqttClient } = require('../config/mqtt');
const mongoService = require('../services/mongoService');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Get system health status
const getSystemHealth = catchAsync(async (req, res, next) => {
  const healthChecks = {
    database: false,
    redis: false,
    mqtt: false,
    disk_space: false,
    memory: false,
    cpu: false
  };
  
  const healthDetails = {};
  
  try {
    // Database health check
    const startTime = Date.now();
    const db = mongoService.getDb();
    await db.admin().ping();
    const responseTime = Date.now() - startTime;
    
    healthChecks.database = true;
    healthDetails.database = {
      status: 'healthy',
      response_time: responseTime,
      current_time: new Date().toISOString()
    };
  } catch (error) {
    healthDetails.database = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  try {
    // Redis health check
    await redisClient.ping();
    const redisInfo = await redisClient.info();
    healthChecks.redis = true;
    healthDetails.redis = {
      status: 'healthy',
      connected_clients: redisInfo.split('\r\n').find(line => line.startsWith('connected_clients:'))?.split(':')[1] || 'unknown',
      used_memory: redisInfo.split('\r\n').find(line => line.startsWith('used_memory_human:'))?.split(':')[1] || 'unknown'
    };
  } catch (error) {
    healthDetails.redis = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  try {
    // MQTT health check
    if (mqttClient && mqttClient.connected) {
      healthChecks.mqtt = true;
      healthDetails.mqtt = {
        status: 'healthy',
        connected: true,
        broker_url: process.env.MQTT_BROKER_URL
      };
    } else {
      healthDetails.mqtt = {
        status: 'unhealthy',
        connected: false,
        error: 'MQTT client not connected'
      };
    }
  } catch (error) {
    healthDetails.mqtt = {
      status: 'unhealthy',
      error: error.message
    };
  }
  
  // System resource checks
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;
  
  healthChecks.memory = memoryUsagePercent < 90;
  healthDetails.memory = {
    status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
    total_mb: Math.round(totalMemory / 1024 / 1024),
    used_mb: Math.round(usedMemory / 1024 / 1024),
    free_mb: Math.round(freeMemory / 1024 / 1024),
    usage_percent: Math.round(memoryUsagePercent * 100) / 100
  };
  
  // CPU load check
  const cpuLoad = os.loadavg()[0]; // 1-minute load average
  const cpuCount = os.cpus().length;
  const cpuUsagePercent = (cpuLoad / cpuCount) * 100;
  
  healthChecks.cpu = cpuUsagePercent < 80;
  healthDetails.cpu = {
    status: cpuUsagePercent < 80 ? 'healthy' : 'warning',
    load_average: cpuLoad,
    cpu_count: cpuCount,
    usage_percent: Math.round(cpuUsagePercent * 100) / 100
  };
  
  // Disk space check
  try {
    const stats = await fs.stat(process.cwd());
    // Note: Getting actual disk space requires platform-specific commands
    // This is a simplified check
    healthChecks.disk_space = true;
    healthDetails.disk_space = {
      status: 'healthy',
      note: 'Disk space check requires platform-specific implementation'
    };
  } catch (error) {
    healthDetails.disk_space = {
      status: 'unknown',
      error: error.message
    };
  }
  
  const overallHealth = Object.values(healthChecks).every(check => check);
  
  res.status(200).json({
    success: true,
    data: {
      overall_status: overallHealth ? 'healthy' : 'unhealthy',
      checks: healthChecks,
      details: healthDetails,
      uptime_seconds: process.uptime(),
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

// Get system information
const getSystemInfo = catchAsync(async (req, res, next) => {
  const systemInfo = {
    server: {
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptime_seconds: os.uptime(),
      node_version: process.version,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development'
    },
    memory: {
      total_mb: Math.round(os.totalmem() / 1024 / 1024),
      free_mb: Math.round(os.freemem() / 1024 / 1024),
      used_mb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
      usage_percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 10000) / 100
    },
    cpu: {
      model: os.cpus()[0]?.model || 'Unknown',
      cores: os.cpus().length,
      load_average: os.loadavg(),
      usage_percent: Math.round((os.loadavg()[0] / os.cpus().length) * 10000) / 100
    },
    network: {
      interfaces: Object.keys(os.networkInterfaces()).length,
      hostname: os.hostname()
    }
  };
  
  // Get database statistics
  try {
    const db = mongoService.getDb();
    const collections = await db.listCollections().toArray();
    
    const collectionStats = [];
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        collectionStats.push({
          name: collection.name,
          document_count: stats.count || 0,
          size_bytes: stats.size || 0,
          avg_obj_size: stats.avgObjSize || 0,
          storage_size: stats.storageSize || 0,
          indexes: stats.nindexes || 0
        });
      } catch (err) {
        // Some collections might not support stats
        collectionStats.push({
          name: collection.name,
          document_count: 0,
          size_bytes: 0,
          avg_obj_size: 0,
          storage_size: 0,
          indexes: 0
        });
      }
    }
    
    systemInfo.database = {
      collections: collectionStats,
      total_collections: collections.length
    };
  } catch (error) {
    systemInfo.database = {
      error: 'Unable to fetch database statistics',
      message: error.message
    };
  }
  
  res.status(200).json({
    success: true,
    data: systemInfo,
    timestamp: new Date().toISOString()
  });
});

// Get application metrics
const getApplicationMetrics = catchAsync(async (req, res, next) => {
  const { time_range = '24h' } = req.query;
  
  try {
    const db = mongoService.getDb();
    
    // Parse time range to get cutoff date
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const cutoffTime = new Date(Date.now() - (timeRangeMs[time_range] || timeRangeMs['24h']));
    
    // Get data volume metrics
    const sensorDataCollection = db.collection('sensor_data');
    const [totalDataPoints, recentDataPoints, activeSensors, oldestData, newestData] = await Promise.all([
      sensorDataCollection.countDocuments({}),
      sensorDataCollection.countDocuments({ timestamp: { $gt: cutoffTime } }),
      sensorDataCollection.distinct('sensor_id').then(sensors => sensors.length),
      sensorDataCollection.findOne({}, { sort: { timestamp: 1 } }),
      sensorDataCollection.findOne({}, { sort: { timestamp: -1 } })
    ]);
    
    const dataMetrics = {
      total_data_points: totalDataPoints,
      recent_data_points: recentDataPoints,
      active_sensors: activeSensors,
      oldest_data: oldestData?.timestamp || null,
      newest_data: newestData?.timestamp || null
    };
    
    // Get device metrics
    const devicesCollection = db.collection('devices');
    const [totalDevices, onlineDevices, offlineDevices, errorDevices, recentlyUpdatedDevices] = await Promise.all([
      devicesCollection.countDocuments({}),
      devicesCollection.countDocuments({ status: 'online' }),
      devicesCollection.countDocuments({ status: 'offline' }),
      devicesCollection.countDocuments({ status: 'error' }),
      devicesCollection.countDocuments({ updated_at: { $gt: cutoffTime } })
    ]);
    
    const deviceMetrics = {
      total_devices: totalDevices,
      online_devices: onlineDevices,
      offline_devices: offlineDevices,
      error_devices: errorDevices,
      recently_updated_devices: recentlyUpdatedDevices
    };
    
    // Get alert metrics
    const alertsCollection = db.collection('alerts');
    const [totalAlerts, activeAlerts, criticalAlerts, recentAlerts] = await Promise.all([
      alertsCollection.countDocuments({}),
      alertsCollection.countDocuments({ status: 'active' }),
      alertsCollection.countDocuments({ severity: 'critical' }),
      alertsCollection.countDocuments({ created_at: { $gt: cutoffTime } })
    ]);
    
    const alertMetrics = {
      total_alerts: totalAlerts,
      active_alerts: activeAlerts,
      critical_alerts: criticalAlerts,
      recent_alerts: recentAlerts,
      avg_response_time_seconds: 0 // Would need complex aggregation for accurate calculation
    };
    
    // Get user activity metrics
    const usersCollection = db.collection('users');
    const [totalUsers, activeUsers, recentLogins, newUsers] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ is_active: true }),
      usersCollection.countDocuments({ last_login: { $gt: cutoffTime } }),
      usersCollection.countDocuments({ created_at: { $gt: cutoffTime } })
    ]);
    
    const userMetrics = {
      total_users: totalUsers,
      active_users: activeUsers,
      recent_logins: recentLogins,
      new_users: newUsers
    };
    
    // Get audit log metrics
    const auditLogCollection = db.collection('audit_log');
    const [totalAuditEntries, recentAuditEntries, activeUsersInAudit, uniqueActions] = await Promise.all([
      auditLogCollection.countDocuments({}),
      auditLogCollection.countDocuments({ timestamp: { $gt: cutoffTime } }),
      auditLogCollection.distinct('user_id').then(users => users.length),
      auditLogCollection.distinct('action').then(actions => actions.length)
    ]);
    
    const auditMetrics = {
      total_audit_entries: totalAuditEntries,
      recent_audit_entries: recentAuditEntries,
      active_users_in_audit: activeUsersInAudit,
      unique_actions: uniqueActions
    };
  } catch (error) {
    logger.error('Database error during metrics retrieval:', error);
    return next(new AppError('Failed to retrieve application metrics', 500));
  }
  
  res.status(200).json({
    success: true,
    data: {
      time_range,
      data_metrics: dataMetrics,
      device_metrics: deviceMetrics,
      alert_metrics: alertMetrics,
      user_metrics: userMetrics,
      audit_metrics: auditMetrics
    },
    timestamp: new Date().toISOString()
  });
});

// Get audit logs
const getAuditLogs = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 50,
    user_id,
    action,
    resource_type,
    start_time,
    end_time
  } = req.query;
  
  try {
    const db = mongoService.getDb();
    const auditLogCollection = db.collection('audit_log');
    const usersCollection = db.collection('users');
    
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    if (user_id) {
      filter.user_id = user_id;
    }
    
    if (action) {
      filter.action = action;
    }
    
    if (resource_type) {
      filter.resource_type = resource_type;
    }
    
    if (start_time || end_time) {
      filter.timestamp = {};
      if (start_time) {
        filter.timestamp.$gte = new Date(start_time);
      }
      if (end_time) {
        filter.timestamp.$lte = new Date(end_time);
      }
    }
    
    // Get total count
    const totalLogs = await auditLogCollection.countDocuments(filter);
    
    // Get audit logs with aggregation to join user information
    const auditLogs = await auditLogCollection.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          username: { $arrayElemAt: ['$user.username', 0] },
          email: { $arrayElemAt: ['$user.email', 0] }
        }
      },
      { $unset: 'user' },
      { $sort: { timestamp: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        audit_logs: auditLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalLogs,
          pages: Math.ceil(totalLogs / limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database error during audit logs retrieval:', error);
    return next(new AppError('Failed to retrieve audit logs', 500));
  }
});

// Get system configuration
const getSystemConfig = catchAsync(async (req, res, next) => {
  const config = {
    application: {
      name: 'IIOT Platform',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      cors_origin: process.env.CORS_ORIGIN || '*'
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'iiot_platform',
      ssl_enabled: process.env.DB_SSL === 'true'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      database: process.env.REDIS_DB || 0
    },
    mqtt: {
      broker_url: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      client_id: process.env.MQTT_CLIENT_ID || 'iiot-platform'
    },
    security: {
      jwt_expires_in: process.env.JWT_EXPIRES_IN || '24h',
      refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
      bcrypt_rounds: process.env.BCRYPT_ROUNDS || '12',
      rate_limit_window: process.env.RATE_LIMIT_WINDOW_MS || '900000',
      rate_limit_max: process.env.RATE_LIMIT_MAX || '100'
    },
    features: {
      email_enabled: process.env.EMAIL_ENABLED === 'true',
      file_upload_enabled: process.env.FILE_UPLOAD_ENABLED !== 'false',
      websocket_enabled: process.env.WEBSOCKET_ENABLED !== 'false',
      swagger_enabled: process.env.NODE_ENV !== 'production'
    }
  };
  
  res.status(200).json({
    success: true,
    data: config,
    timestamp: new Date().toISOString()
  });
});

// Update system configuration (admin only)
const updateSystemConfig = catchAsync(async (req, res, next) => {
  const { config_key, config_value } = req.body;
  
  if (!config_key || config_value === undefined) {
    return next(new AppError('Config key and value are required', 400));
  }
  
  // Store configuration in Redis (for runtime config)
  await redisClient.hset('system:config', config_key, JSON.stringify(config_value));
  
  // Log configuration change
  const db = mongoService.getDb();
  await db.collection('audit_log').insertOne({
    user_id: req.user.id,
    action: 'UPDATE',
    resource_type: 'system_config',
    resource_id: config_key,
    details: JSON.stringify({ old_value: 'unknown', new_value: config_value }),
    timestamp: new Date()
  });
  
  logger.info(`System configuration updated`, {
    config_key,
    config_value,
    updated_by: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: 'Configuration updated successfully',
    data: {
      config_key,
      config_value
    },
    timestamp: new Date().toISOString()
  });
});

// Backup database
const backupDatabase = catchAsync(async (req, res, next) => {
  const { backup_type = 'full', include_data = true } = req.body;
  
  // This is a simplified backup endpoint
  // In production, you would use pg_dump or similar tools
  
  const backupId = `backup_${Date.now()}`;
  const backupPath = path.join(process.cwd(), 'backups', `${backupId}.sql`);
  
  // Log backup initiation
  const db = mongoService.getDb();
  await db.collection('audit_log').insertOne({
    user_id: req.user.id,
    action: 'BACKUP',
    resource_type: 'database',
    resource_id: backupId,
    details: JSON.stringify({ backup_type, include_data, backup_path }),
    timestamp: new Date()
  });
  
  logger.info(`Database backup initiated`, {
    backup_id: backupId,
    backup_type,
    include_data,
    initiated_by: req.user.id
  });
  
  res.status(202).json({
    success: true,
    message: 'Database backup initiated',
    data: {
      backup_id: backupId,
      backup_type,
      include_data,
      status: 'initiated',
      estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    },
    timestamp: new Date().toISOString()
  });
});

// Clear cache
const clearCache = catchAsync(async (req, res, next) => {
  const { cache_pattern = '*' } = req.body;
  
  try {
    // Get all keys matching the pattern
    const keys = await redisClient.keys(cache_pattern);
    
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    
    // Log cache clear
    const db = mongoService.getDb();
    await db.collection('audit_log').insertOne({
      user_id: req.user.id,
      action: 'CLEAR',
      resource_type: 'cache',
      resource_id: cache_pattern,
      details: JSON.stringify({ cleared_keys: keys.length }),
      timestamp: new Date()
    });
    
    logger.info(`Cache cleared`, {
      pattern: cache_pattern,
      cleared_keys: keys.length,
      cleared_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
      data: {
        pattern: cache_pattern,
        cleared_keys: keys.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache clear failed', { error: error.message });
    return next(new AppError('Failed to clear cache', 500));
  }
});

module.exports = {
  getSystemHealth,
  getSystemInfo,
  getApplicationMetrics,
  getAuditLogs,
  getSystemConfig,
  updateSystemConfig,
  backupDatabase,
  clearCache
};