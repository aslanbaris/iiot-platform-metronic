const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { mqttClient } = require('../config/mqtt');
const influxService = require('../services/influxService');
const mongoService = require('../services/mongoService');

// Note: Migrated from TimescaleDB to MongoDB for device metadata
// Time-series sensor data is stored in InfluxDB

// Get all devices (MongoDB implementation)
const getAllDevices = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, search = '', status = '', type = '' } = req.query;
  
  const skip = (page - 1) * limit;
  
  // Build MongoDB filter
  const filter = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) {
    filter.status = status;
  }
  
  if (type) {
    filter.device_type = type;
  }
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    // Get total count
    const totalDevices = await devicesCollection.countDocuments(filter);
    
    // Get devices with aggregation for sensor count
    const devices = await devicesCollection.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'sensors',
          localField: '_id',
          foreignField: 'device_id',
          as: 'sensors'
        }
      },
      {
        $addFields: {
          sensor_count: { $size: '$sensors' },
          id: '$_id'
        }
      },
      { $project: { sensors: 0 } },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        devices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalDevices,
          pages: Math.ceil(totalDevices / limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching devices from MongoDB:', error);
    return next(new AppError('Failed to fetch devices', 500));
  }
});

// Get device by ID (MongoDB implementation)
const getDeviceById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Check cache first
  const cachedDevice = await redisClient.get(`device:${id}`);
  if (cachedDevice) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedDevice),
      cached: true,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    // Get device with sensor count using aggregation
    const deviceResult = await devicesCollection.aggregate([
      { $match: { _id: id } },
      {
        $lookup: {
          from: 'sensors',
          localField: '_id',
          foreignField: 'device_id',
          as: 'sensors'
        }
      },
      {
        $addFields: {
          sensor_count: { $size: '$sensors' },
          id: '$_id'
        }
      },
      { $project: { sensors: 0 } }
    ]).toArray();
    
    if (deviceResult.length === 0) {
      return next(new AppError('Device not found', 404));
    }
    
    const device = deviceResult[0];
    
    // Cache device for 5 minutes
    await redisClient.setEx(`device:${id}`, 300, JSON.stringify(device));
    
    res.status(200).json({
      success: true,
      data: device,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching device:', error);
    return next(new AppError('Failed to fetch device', 500));
  }
});

// Create new device
const createDevice = catchAsync(async (req, res, next) => {
  const {
    name,
    description,
    device_type,
    location,
    ip_address,
    port,
    protocol = 'MQTT',
    configuration = {},
    tags = []
  } = req.body;
  
  const deviceId = uuidv4();
  
  const result = await transaction(async (client) => {
    // Insert device
    const deviceResult = await client.query(`
      INSERT INTO iiot.devices (
        id, name, description, device_type, location, ip_address, port, protocol,
        configuration, tags, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'offline', $11, NOW(), NOW())
      RETURNING *
    `, [
      deviceId, name, description, device_type, location, ip_address, port, protocol,
      JSON.stringify(configuration), JSON.stringify(tags), req.user.id
    ]);
    
    // Log device creation
    await client.query(`
      INSERT INTO iiot.audit_log (user_id, action, resource_type, resource_id, details, timestamp)
      VALUES ($1, 'CREATE', 'device', $2, $3, NOW())
    `, [
      req.user.id,
      deviceId,
      JSON.stringify({ name, device_type, location })
    ]);
    
    return deviceResult.rows[0];
  });
  
  // Cache new device
  await redisClient.setEx(`device:${deviceId}`, 300, JSON.stringify(result));
  
  // Publish device creation event
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish('iiot/devices/created', JSON.stringify({
      device_id: deviceId,
      name,
      device_type,
      timestamp: new Date().toISOString()
    }));
  }
  
  logger.info(`Device created: ${deviceId}`, {
    name,
    device_type,
    created_by: req.user.id
  });
  
  res.status(201).json({
    success: true,
    message: 'Device created successfully',
    data: result,
    timestamp: new Date().toISOString()
  });
});

// Update device (MongoDB implementation)
const updateDevice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    description,
    device_type,
    location,
    ip_address,
    port,
    protocol,
    configuration,
    tags,
    status
  } = req.body;
  
  // Build update object dynamically
  const updateFields = {};
  
  if (name !== undefined) updateFields.name = name;
  if (description !== undefined) updateFields.description = description;
  if (device_type !== undefined) updateFields.device_type = device_type;
  if (location !== undefined) updateFields.location = location;
  if (ip_address !== undefined) updateFields.ip_address = ip_address;
  if (port !== undefined) updateFields.port = port;
  if (protocol !== undefined) updateFields.protocol = protocol;
  if (configuration !== undefined) updateFields.configuration = configuration;
  if (tags !== undefined) updateFields.tags = tags;
  if (status !== undefined) updateFields.status = status;
  
  if (Object.keys(updateFields).length === 0) {
    return next(new AppError('No fields to update', 400));
  }
  
  updateFields.updated_at = new Date();
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    const auditLogCollection = db.collection('audit_log');
    
    // Update device
    const result = await devicesCollection.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return next(new AppError('Device not found', 404));
    }
    
    const updatedDevice = result.value;
    
    // Update cache
    await redisClient.setEx(`device:${id}`, 300, JSON.stringify(updatedDevice));
    
    // Log device update
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'UPDATE',
      resource_type: 'device',
      resource_id: id,
      details: { updated_fields: Object.keys(req.body) },
      timestamp: new Date()
    });
    
    // Publish device update event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/devices/updated', JSON.stringify({
        device_id: id,
        updated_fields: Object.keys(req.body),
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Device updated: ${id}`, {
      updated_fields: Object.keys(req.body),
      updated_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      data: updatedDevice,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating device:', error);
    return next(new AppError('Failed to update device', 500));
  }
});

// Delete device (MongoDB implementation)
const deleteDevice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    const sensorsCollection = db.collection('sensors');
    const auditLogCollection = db.collection('audit_log');
    
    // Check if device exists
    const device = await devicesCollection.findOne({ _id: id });
    
    if (!device) {
      return next(new AppError('Device not found', 404));
    }
    
    const deviceName = device.name;
    
    // Count related sensors
    const sensorCount = await sensorsCollection.countDocuments({ device_id: id });
    
    // Delete related sensors
    await sensorsCollection.deleteMany({ device_id: id });
    
    // Delete device
    await devicesCollection.deleteOne({ _id: id });
    
    // Log device deletion
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'DELETE',
      resource_type: 'device',
      resource_id: id,
      details: {
        device_name: deviceName,
        deleted_sensors: sensorCount
      },
      timestamp: new Date()
    });
    
    // Remove from cache
    await redisClient.del(`device:${id}`);
    
    // Publish device deletion event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/devices/deleted', JSON.stringify({
        device_id: id,
        device_name: deviceName,
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Device deleted: ${id}`, {
      device_name: deviceName,
      deleted_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Device deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error deleting device:', error);
    return next(new AppError('Failed to delete device', 500));
  }
});

// Get device sensors (MongoDB implementation)
const getDeviceSensors = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    const sensorsCollection = db.collection('sensors');
    
    // Check if device exists
    const device = await devicesCollection.findOne({ _id: id });
    
    if (!device) {
      return next(new AppError('Device not found', 404));
    }
    
    // Get sensors for this device
    const sensors = await sensorsCollection
      .find({ device_id: id })
      .sort({ created_at: -1 })
      .toArray();
    
    res.status(200).json({
      success: true,
      data: sensors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching device sensors:', error);
    return next(new AppError('Failed to fetch device sensors', 500));
  }
});

// Get device statistics (MongoDB implementation)
const getDeviceStats = catchAsync(async (req, res, next) => {
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    // Overall statistics
    const overviewStats = await devicesCollection.aggregate([
      {
        $group: {
          _id: null,
          total_devices: { $sum: 1 },
          online_devices: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
          offline_devices: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
          error_devices: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          maintenance_devices: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          device_types: { $addToSet: '$device_type' },
          locations: { $addToSet: '$location' }
        }
      },
      {
        $project: {
          _id: 0,
          total_devices: 1,
          online_devices: 1,
          offline_devices: 1,
          error_devices: 1,
          maintenance_devices: 1,
          device_types: { $size: '$device_types' },
          locations: { $size: '$locations' }
        }
      }
    ]).toArray();
    
    // Statistics by device type
    const typeStats = await devicesCollection.aggregate([
      {
        $group: {
          _id: '$device_type',
          count: { $sum: 1 },
          online_count: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          device_type: '$_id',
          count: 1,
          online_count: 1
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Statistics by location
    const locationStats = await devicesCollection.aggregate([
      { $match: { location: { $ne: null, $exists: true } } },
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 },
          online_count: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          location: '$_id',
          count: 1,
          online_count: 1
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        overview: overviewStats[0] || {},
        by_type: typeStats,
        by_location: locationStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching device statistics:', error);
    return next(new AppError('Failed to fetch device statistics', 500));
  }
});

// Send command to device (MongoDB implementation)
const sendCommand = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { command, parameters = {} } = req.body;
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    
    // Check if device exists and is online
    const device = await devicesCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { name: 1, status: 1 } }
    );
    
    if (!device) {
      return next(new AppError('Device not found', 404));
    }
    
    if (device.status !== 'online') {
      return next(new AppError('Device is not online', 400));
    }
    
    const commandId = uuidv4();
    const commandData = {
      command_id: commandId,
      device_id: id,
      command,
      parameters,
      timestamp: new Date().toISOString(),
      sent_by: req.user.id
    };
    
    // Store command in Redis for tracking
    await redisClient.setEx(`command:${commandId}`, 300, JSON.stringify(commandData));
    
    // Send command via MQTT
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(`iiot/devices/${id}/commands`, JSON.stringify(commandData));
    } else {
      return next(new AppError('MQTT broker is not connected', 503));
    }
    
    // Log command in audit_log collection
    const auditLogCollection = db.collection('audit_log');
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'COMMAND',
      resource_type: 'device',
      resource_id: id,
      details: { command, parameters, command_id: commandId },
      timestamp: new Date()
    });
    
    logger.info(`Command sent to device: ${id}`, {
      command,
      command_id: commandId,
      sent_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Command sent successfully',
      data: {
        command_id: commandId,
        device_id: id,
        command,
        parameters
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error sending command to device:', error);
    return next(new AppError('Failed to send command to device', 500));
  }
});

module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceSensors,
  getDeviceStats,
  sendCommand
};