const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const mongoService = require('../services/mongoService');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { mqttClient } = require('../config/mqtt');

// Get all alerts
const getAllAlerts = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    severity = '',
    status = '',
    alert_type = '',
    device_id = '',
    sensor_id = '',
    start_time,
    end_time
  } = req.query;
  
  const skip = (page - 1) * limit;
  
  try {
    const db = mongoService.getDb();
    const alertsCollection = db.collection('alerts');
    
    // Build match filter
    const matchFilter = {};
    
    if (search) {
      matchFilter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (severity) {
      matchFilter.severity = severity;
    }
    
    if (status) {
      matchFilter.status = status;
    }
    
    if (alert_type) {
      matchFilter.alert_type = alert_type;
    }
    
    if (device_id) {
      matchFilter.device_id = new ObjectId(device_id);
    }
    
    if (sensor_id) {
      matchFilter.sensor_id = new ObjectId(sensor_id);
    }
    
    if (start_time || end_time) {
      matchFilter.created_at = {};
      if (start_time) {
        matchFilter.created_at.$gte = new Date(start_time);
      }
      if (end_time) {
        matchFilter.created_at.$lte = new Date(end_time);
      }
    }
    
    // Get total count
    const totalAlerts = await alertsCollection.countDocuments(matchFilter);
    
    // Get alerts with related information using aggregation
    const alertsResult = await alertsCollection.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device'
        }
      },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'acknowledged_by',
          foreignField: '_id',
          as: 'acknowledged_user'
        }
      },
      {
        $addFields: {
          device_name: { $arrayElemAt: ['$device.name', 0] },
          device_location: { $arrayElemAt: ['$device.location', 0] },
          sensor_name: { $arrayElemAt: ['$sensor.name', 0] },
          sensor_type: { $arrayElemAt: ['$sensor.sensor_type', 0] },
          unit: { $arrayElemAt: ['$sensor.unit', 0] },
          acknowledged_by_username: { $arrayElemAt: ['$acknowledged_user.username', 0] }
        }
      },
      {
        $project: {
          device: 0,
          sensor: 0,
          acknowledged_user: 0
        }
      },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        alerts: alertsResult,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalAlerts,
          pages: Math.ceil(totalAlerts / limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    return next(new AppError('Failed to fetch alerts', 500));
  }
});

// Get alert by ID
const getAlertById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const db = mongoService.getDb();
    const alertsCollection = db.collection('alerts');
    
    const result = await alertsCollection.aggregate([
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device'
        }
      },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'acknowledged_by',
          foreignField: '_id',
          as: 'acknowledged_user'
        }
      },
      {
        $addFields: {
          device_name: { $arrayElemAt: ['$device.name', 0] },
          device_location: { $arrayElemAt: ['$device.location', 0] },
          sensor_name: { $arrayElemAt: ['$sensor.name', 0] },
          sensor_type: { $arrayElemAt: ['$sensor.sensor_type', 0] },
          unit: { $arrayElemAt: ['$sensor.unit', 0] },
          acknowledged_by_username: { $arrayElemAt: ['$acknowledged_user.username', 0] }
        }
      },
      {
        $project: {
          device: 0,
          sensor: 0,
          acknowledged_user: 0
        }
      }
    ]).toArray();
    
    if (result.length === 0) {
      return next(new AppError('Alert not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: result[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching alert by ID:', error);
    return next(new AppError('Failed to fetch alert', 500));
  }
});

// Create new alert
const createAlert = catchAsync(async (req, res, next) => {
  const {
    title,
    description,
    alert_type,
    severity,
    device_id,
    sensor_id,
    threshold_value,
    actual_value,
    condition_details = {},
    metadata = {}
  } = req.body;
  
  const alertId = uuidv4();
  
  const result = await transaction(async (client) => {
    // Insert alert
    const alertResult = await client.query(`
      INSERT INTO iiot.alerts (
        id, title, description, alert_type, severity, device_id, sensor_id,
        threshold_value, actual_value, condition_details, metadata, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW(), NOW())
      RETURNING *
    `, [
      alertId, title, description, alert_type, severity, device_id, sensor_id,
      threshold_value, actual_value, JSON.stringify(condition_details),
      JSON.stringify(metadata)
    ]);
    
    // Log alert creation
    await client.query(`
      INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
      VALUES ($1, 'CREATE', 'alert', $2, $3, NOW())
    `, [
      req.user?.id || 'system',
      alertId,
      JSON.stringify({ title, alert_type, severity, device_id, sensor_id })
    ]);
    
    return alertResult.rows[0];
  });
  
  // Cache alert for quick access
  await redisClient.setex(`alert:${alertId}`, 300, JSON.stringify(result));
  
  // Publish alert via MQTT
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('iiot/alerts/created', JSON.stringify({
      alert_id: alertId,
      title,
      severity,
      alert_type,
      device_id,
      sensor_id,
      timestamp: new Date().toISOString()
    }));
  }
  
  // Send real-time notification via WebSocket
  if (req.io) {
    req.io.emit('alert:created', {
      alert: result,
      timestamp: new Date().toISOString()
    });
  }
  
  logger.info(`Alert created: ${alertId}`, {
    title,
    severity,
    alert_type,
    device_id,
    sensor_id
  });
  
  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: result,
    timestamp: new Date().toISOString()
  });
});

// Update alert
const updateAlert = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    title,
    description,
    severity,
    status,
    condition_details,
    metadata
  } = req.body;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  if (title !== undefined) {
    updates.push(`title = $${paramCount}`);
    values.push(title);
    paramCount++;
  }
  
  if (description !== undefined) {
    updates.push(`description = $${paramCount}`);
    values.push(description);
    paramCount++;
  }
  
  if (severity !== undefined) {
    updates.push(`severity = $${paramCount}`);
    values.push(severity);
    paramCount++;
  }
  
  if (status !== undefined) {
    updates.push(`status = $${paramCount}`);
    values.push(status);
    paramCount++;
  }
  
  if (condition_details !== undefined) {
    updates.push(`condition_details = $${paramCount}`);
    values.push(JSON.stringify(condition_details));
    paramCount++;
  }
  
  if (metadata !== undefined) {
    updates.push(`metadata = $${paramCount}`);
    values.push(JSON.stringify(metadata));
    paramCount++;
  }
  
  if (updates.length === 0) {
    return next(new AppError('No fields to update', 400));
  }
  
  updates.push(`updated_at = NOW()`);
  values.push(id);
  
  const updateQuery = `
    UPDATE iiot.alerts 
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const result = await query(updateQuery, values);
  
  if (result.rows.length === 0) {
    return next(new AppError('Alert not found', 404));
  }
  
  const updatedAlert = result.rows[0];
  
  // Update cache
  await redisClient.setex(`alert:${id}`, 300, JSON.stringify(updatedAlert));
  
  // Log alert update
  await query(`
    INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
    VALUES ($1, 'UPDATE', 'alert', $2, $3, NOW())
  `, [
    req.user.id,
    id,
    JSON.stringify({ updated_fields: Object.keys(req.body) })
  ]);
  
  // Publish alert update
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('iiot/alerts/updated', JSON.stringify({
      alert_id: id,
      updated_fields: Object.keys(req.body),
      timestamp: new Date().toISOString()
    }));
  }
  
  logger.info(`Alert updated: ${id}`, {
    updated_fields: Object.keys(req.body),
    updated_by: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: 'Alert updated successfully',
    data: updatedAlert,
    timestamp: new Date().toISOString()
  });
});

// Acknowledge alert
const acknowledgeAlert = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { acknowledgment_note = '' } = req.body;
  
  const result = await query(`
    UPDATE iiot.alerts 
    SET 
      status = 'acknowledged',
      acknowledged_by = $1,
      acknowledged_at = NOW(),
      acknowledgment_note = $2,
      updated_at = NOW()
    WHERE id = $3 AND status = 'active'
    RETURNING *
  `, [req.user.id, acknowledgment_note, id]);
  
  if (result.rows.length === 0) {
    return next(new AppError('Alert not found or already acknowledged', 404));
  }
  
  const acknowledgedAlert = result.rows[0];
  
  // Update cache
  await redisClient.setex(`alert:${id}`, 300, JSON.stringify(acknowledgedAlert));
  
  // Log acknowledgment
  await query(`
    INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
    VALUES ($1, 'ACKNOWLEDGE', 'alert', $2, $3, NOW())
  `, [
    req.user.id,
    id,
    JSON.stringify({ acknowledgment_note })
  ]);
  
  // Publish acknowledgment
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('iiot/alerts/acknowledged', JSON.stringify({
      alert_id: id,
      acknowledged_by: req.user.id,
      acknowledgment_note,
      timestamp: new Date().toISOString()
    }));
  }
  
  // Send real-time notification
  if (req.io) {
    req.io.emit('alert:acknowledged', {
      alert_id: id,
      acknowledged_by: req.user.username,
      timestamp: new Date().toISOString()
    });
  }
  
  logger.info(`Alert acknowledged: ${id}`, {
    acknowledged_by: req.user.id,
    acknowledgment_note
  });
  
  res.status(200).json({
    success: true,
    message: 'Alert acknowledged successfully',
    data: acknowledgedAlert,
    timestamp: new Date().toISOString()
  });
});

// Resolve alert
const resolveAlert = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { resolution_note = '' } = req.body;
  
  const result = await query(`
    UPDATE iiot.alerts 
    SET 
      status = 'resolved',
      resolved_by = $1,
      resolved_at = NOW(),
      resolution_note = $2,
      updated_at = NOW()
    WHERE id = $3 AND status IN ('active', 'acknowledged')
    RETURNING *
  `, [req.user.id, resolution_note, id]);
  
  if (result.rows.length === 0) {
    return next(new AppError('Alert not found or already resolved', 404));
  }
  
  const resolvedAlert = result.rows[0];
  
  // Update cache
  await redisClient.setex(`alert:${id}`, 300, JSON.stringify(resolvedAlert));
  
  // Log resolution
  await query(`
    INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
    VALUES ($1, 'RESOLVE', 'alert', $2, $3, NOW())
  `, [
    req.user.id,
    id,
    JSON.stringify({ resolution_note })
  ]);
  
  // Publish resolution
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('iiot/alerts/resolved', JSON.stringify({
      alert_id: id,
      resolved_by: req.user.id,
      resolution_note,
      timestamp: new Date().toISOString()
    }));
  }
  
  // Send real-time notification
  if (req.io) {
    req.io.emit('alert:resolved', {
      alert_id: id,
      resolved_by: req.user.username,
      timestamp: new Date().toISOString()
    });
  }
  
  logger.info(`Alert resolved: ${id}`, {
    resolved_by: req.user.id,
    resolution_note
  });
  
  res.status(200).json({
    success: true,
    message: 'Alert resolved successfully',
    data: resolvedAlert,
    timestamp: new Date().toISOString()
  });
});

// Delete alert
const deleteAlert = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const result = await transaction(async (client) => {
    // Check if alert exists
    const alertResult = await client.query('SELECT title, severity FROM iiot.alerts WHERE id = $1', [id]);
    
    if (alertResult.rows.length === 0) {
      throw new AppError('Alert not found', 404);
    }
    
    const alert = alertResult.rows[0];
    
    // Delete alert
    await client.query('DELETE FROM iiot.alerts WHERE id = $1', [id]);
    
    // Log alert deletion
    await client.query(`
      INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
      VALUES ($1, 'DELETE', 'alert', $2, $3, NOW())
    `, [
      req.user.id,
      id,
      JSON.stringify({ title: alert.title, severity: alert.severity })
    ]);
    
    return alert;
  });
  
  // Remove from cache
  await redisClient.del(`alert:${id}`);
  
  logger.info(`Alert deleted: ${id}`, {
    title: result.title,
    deleted_by: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: 'Alert deleted successfully',
    timestamp: new Date().toISOString()
  });
});

// Get alert statistics
const getAlertStats = catchAsync(async (req, res, next) => {
  const { time_range = '24h' } = req.query;
  
  // Overall statistics
  const overallStats = await query(`
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
      COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
      COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
      COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_alerts,
      COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_alerts,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL $1 THEN 1 END) as recent_alerts
    FROM iiot.alerts
  `, [time_range]);
  
  // Alerts by type
  const typeStats = await query(`
    SELECT 
      alert_type,
      COUNT(*) as count,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count
    FROM iiot.alerts
    WHERE created_at > NOW() - INTERVAL $1
    GROUP BY alert_type
    ORDER BY count DESC
  `, [time_range]);
  
  // Alerts by device
  const deviceStats = await query(`
    SELECT 
      d.name as device_name,
      d.location as device_location,
      COUNT(a.*) as alert_count,
      COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_count,
      COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_count
    FROM iiot.alerts a
    JOIN iiot.devices d ON a.device_id = d.id
    WHERE a.created_at > NOW() - INTERVAL $1
    GROUP BY d.id, d.name, d.location
    ORDER BY alert_count DESC
    LIMIT 10
  `, [time_range]);
  
  // Alert trends (hourly)
  const trendStats = await query(`
    SELECT 
      date_trunc('hour', created_at) as hour,
      COUNT(*) as alert_count,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count
    FROM iiot.alerts
    WHERE created_at > NOW() - INTERVAL $1
    GROUP BY date_trunc('hour', created_at)
    ORDER BY hour DESC
  `, [time_range]);
  
  res.status(200).json({
    success: true,
    data: {
      overview: overallStats.rows[0],
      by_type: typeStats.rows,
      by_device: deviceStats.rows,
      trends: trendStats.rows
    },
    timestamp: new Date().toISOString()
  });
});

// Bulk acknowledge alerts
const bulkAcknowledge = catchAsync(async (req, res, next) => {
  const { alert_ids, acknowledgment_note = '' } = req.body;
  
  if (!Array.isArray(alert_ids) || alert_ids.length === 0) {
    return next(new AppError('Alert IDs array is required', 400));
  }
  
  const result = await query(`
    UPDATE iiot.alerts 
    SET 
      status = 'acknowledged',
      acknowledged_by = $1,
      acknowledged_at = NOW(),
      acknowledgment_note = $2,
      updated_at = NOW()
    WHERE id = ANY($3) AND status = 'active'
    RETURNING id, title
  `, [req.user.id, acknowledgment_note, alert_ids]);
  
  const acknowledgedCount = result.rows.length;
  
  if (acknowledgedCount === 0) {
    return next(new AppError('No active alerts found to acknowledge', 404));
  }
  
  // Log bulk acknowledgment
  await query(`
    INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
    VALUES ($1, 'BULK_ACKNOWLEDGE', 'alert', 'multiple', $2, NOW())
  `, [
    req.user.id,
    JSON.stringify({
      acknowledged_count: acknowledgedCount,
      alert_ids: result.rows.map(r => r.id),
      acknowledgment_note
    })
  ]);
  
  logger.info(`Bulk alert acknowledgment`, {
    acknowledged_count: acknowledgedCount,
    acknowledged_by: req.user.id
  });
  
  res.status(200).json({
    success: true,
    message: `${acknowledgedCount} alerts acknowledged successfully`,
    data: {
      acknowledged_count: acknowledgedCount,
      acknowledged_alerts: result.rows
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getAllAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
  deleteAlert,
  getAlertStats,
  bulkAcknowledge
};