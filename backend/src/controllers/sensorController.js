const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { mqttClient } = require('../config/mqtt');
const mongoService = require('../services/mongoService');

// Get all sensors
const getAllSensors = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, search = '', type = '', device_id = '', status = '' } = req.query;
  
  const skip = (page - 1) * limit;
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    
    // Build MongoDB filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (type) {
      filter.sensor_type = type;
    }
    
    if (device_id) {
      filter.device_id = device_id;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Get total count
    const totalSensors = await sensorsCollection.countDocuments(filter);
    
    // Get sensors with device info and latest reading using aggregation
    const sensors = await sensorsCollection.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device_info'
        }
      },
      { $unwind: { path: '$device_info', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sensor_data',
          let: { sensorId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$sensor_id', '$$sensorId'] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: 'latest_reading'
        }
      },
      {
        $lookup: {
          from: 'sensor_data',
          localField: '_id',
          foreignField: 'sensor_id',
          as: 'all_readings'
        }
      },
      {
        $addFields: {
          device_name: '$device_info.name',
          device_location: '$device_info.location',
          device_status: '$device_info.status',
          latest_value: { $arrayElemAt: ['$latest_reading.value', 0] },
          latest_reading_time: { $arrayElemAt: ['$latest_reading.timestamp', 0] },
          total_readings: { $size: '$all_readings' }
        }
      },
      {
        $project: {
          device_info: 0,
          latest_reading: 0,
          all_readings: 0
        }
      },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        sensors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalSensors,
          pages: Math.ceil(totalSensors / limit)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching sensors:', error);
    return next(new AppError('Failed to fetch sensors', 500));
  }
});

// Get sensor by ID
const getSensorById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Check cache first
  const cachedSensor = await redisClient.get(`sensor:${id}`);
  if (cachedSensor) {
    return res.status(200).json({
      success: true,
      data: JSON.parse(cachedSensor),
      cached: true,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    
    // Get sensor with device info and latest reading using aggregation
    const result = await sensorsCollection.aggregate([
      { $match: { _id: id } },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device_info'
        }
      },
      { $unwind: { path: '$device_info', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sensor_data',
          let: { sensorId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$sensor_id', '$$sensorId'] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 1 }
          ],
          as: 'latest_reading'
        }
      },
      {
        $lookup: {
          from: 'sensor_data',
          localField: '_id',
          foreignField: 'sensor_id',
          as: 'all_readings'
        }
      },
      {
        $addFields: {
          device_name: '$device_info.name',
          device_location: '$device_info.location',
          device_status: '$device_info.status',
          latest_value: { $arrayElemAt: ['$latest_reading.value', 0] },
          latest_reading_time: { $arrayElemAt: ['$latest_reading.timestamp', 0] },
          total_readings: { $size: '$all_readings' }
        }
      },
      {
        $project: {
          device_info: 0,
          latest_reading: 0,
          all_readings: 0
        }
      }
    ]).toArray();
    
    if (result.length === 0) {
      return next(new AppError('Sensor not found', 404));
    }
    
    const sensor = result[0];
    
    // Cache sensor for 2 minutes
    await redisClient.setex(`sensor:${id}`, 120, JSON.stringify(sensor));
    
    res.status(200).json({
      success: true,
      data: sensor,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching sensor:', error);
    return next(new AppError('Failed to fetch sensor', 500));
  }
});

// Create new sensor
const createSensor = catchAsync(async (req, res, next) => {
  const {
    device_id,
    name,
    description,
    sensor_type,
    unit,
    min_value,
    max_value,
    calibration_offset = 0,
    calibration_factor = 1,
    sampling_rate = 1000,
    configuration = {},
    tags = []
  } = req.body;
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    const sensorsCollection = db.collection('sensors');
    const auditLogCollection = db.collection('audit_log');
    
    // Check if device exists
    const device = await devicesCollection.findOne({ _id: device_id });
    
    if (!device) {
      return next(new AppError('Device not found', 404));
    }
    
    const sensorId = uuidv4();
    
    // Create sensor document
    const sensorData = {
      _id: sensorId,
      device_id,
      name,
      description,
      sensor_type,
      unit,
      min_value,
      max_value,
      calibration_offset,
      calibration_factor,
      sampling_rate,
      configuration,
      tags,
      status: 'active',
      created_by: req.user.id,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Insert sensor
    await sensorsCollection.insertOne(sensorData);
    
    // Log sensor creation
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'CREATE',
      resource_type: 'sensor',
      resource_id: sensorId,
      details: { name, sensor_type, device_id, unit },
      timestamp: new Date()
    });
    
    // Cache new sensor
    await redisClient.setex(`sensor:${sensorId}`, 120, JSON.stringify(sensorData));
    
    // Publish sensor creation event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/sensors/created', JSON.stringify({
        sensor_id: sensorId,
        device_id,
        name,
        sensor_type,
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Sensor created: ${sensorId}`, {
      name,
      sensor_type,
      device_id,
      created_by: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Sensor created successfully',
      data: sensorData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating sensor:', error);
    return next(new AppError('Failed to create sensor', 500));
  }
});

// Update sensor
const updateSensor = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    description,
    sensor_type,
    unit,
    min_value,
    max_value,
    calibration_offset,
    calibration_factor,
    sampling_rate,
    configuration,
    tags,
    status
  } = req.body;
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    const auditLogCollection = db.collection('audit_log');
    
    // Build update object dynamically
    const updateFields = {};
    
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (sensor_type !== undefined) updateFields.sensor_type = sensor_type;
    if (unit !== undefined) updateFields.unit = unit;
    if (min_value !== undefined) updateFields.min_value = min_value;
    if (max_value !== undefined) updateFields.max_value = max_value;
    if (calibration_offset !== undefined) updateFields.calibration_offset = calibration_offset;
    if (calibration_factor !== undefined) updateFields.calibration_factor = calibration_factor;
    if (sampling_rate !== undefined) updateFields.sampling_rate = sampling_rate;
    if (configuration !== undefined) updateFields.configuration = configuration;
    if (tags !== undefined) updateFields.tags = tags;
    if (status !== undefined) updateFields.status = status;
    
    if (Object.keys(updateFields).length === 0) {
      return next(new AppError('No fields to update', 400));
    }
    
    updateFields.updated_at = new Date();
    
    // Update sensor
    const result = await sensorsCollection.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return next(new AppError('Sensor not found', 404));
    }
    
    const updatedSensor = result.value;
    
    // Update cache
    await redisClient.setex(`sensor:${id}`, 120, JSON.stringify(updatedSensor));
    
    // Log sensor update
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'UPDATE',
      resource_type: 'sensor',
      resource_id: id,
      details: { updated_fields: Object.keys(req.body) },
      timestamp: new Date()
    });
    
    // Publish sensor update event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/sensors/updated', JSON.stringify({
        sensor_id: id,
        updated_fields: Object.keys(req.body),
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Sensor updated: ${id}`, {
      updated_fields: Object.keys(req.body),
      updated_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Sensor updated successfully',
      data: updatedSensor,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating sensor:', error);
    return next(new AppError('Failed to update sensor', 500));
  }
});

// Delete sensor
const deleteSensor = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    const sensorDataCollection = db.collection('sensor_data');
    const auditLogCollection = db.collection('audit_log');
    
    // Check if sensor exists
    const sensor = await sensorsCollection.findOne({ _id: id });
    
    if (!sensor) {
      return next(new AppError('Sensor not found', 404));
    }
    
    // Count sensor data to be deleted
    const dataCount = await sensorDataCollection.countDocuments({ sensor_id: id });
    
    // Delete sensor data first
    await sensorDataCollection.deleteMany({ sensor_id: id });
    
    // Delete sensor
    await sensorsCollection.deleteOne({ _id: id });
    
    // Log sensor deletion
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'DELETE',
      resource_type: 'sensor',
      resource_id: id,
      details: {
        sensor_name: sensor.name,
        device_id: sensor.device_id,
        deleted_data_points: dataCount
      },
      timestamp: new Date()
    });
    
    // Remove from cache
    await redisClient.del(`sensor:${id}`);
    
    // Publish sensor deletion event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/sensors/deleted', JSON.stringify({
        sensor_id: id,
        sensor_name: sensor.name,
        device_id: sensor.device_id,
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Sensor deleted: ${id}`, {
      sensor_name: sensor.name,
      device_id: sensor.device_id,
      deleted_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Sensor deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error deleting sensor:', error);
    return next(new AppError('Failed to delete sensor', 500));
  }
});

// Get sensor data
const getSensorData = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    start_time,
    end_time,
    limit = 100,
    aggregation = 'none',
    interval = '1h'
  } = req.query;
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    const sensorDataCollection = db.collection('sensor_data');
    
    // Check if sensor exists
    const sensor = await sensorsCollection.findOne({ _id: id });
    
    if (!sensor) {
      return next(new AppError('Sensor not found', 404));
    }
    
    // Build time filter
    const timeFilter = { sensor_id: id };
    
    if (start_time || end_time) {
      timeFilter.timestamp = {};
      if (start_time) timeFilter.timestamp.$gte = new Date(start_time);
      if (end_time) timeFilter.timestamp.$lte = new Date(end_time);
    }
    
    let dataPoints;
    
    if (aggregation === 'none') {
      // Raw data query
      dataPoints = await sensorDataCollection
        .find(timeFilter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .project({ timestamp: 1, value: 1, quality: 1, _id: 0 })
        .toArray();
    } else {
      // Aggregated data query using MongoDB aggregation
      const aggregationFunc = {
        'avg': '$avg',
        'min': '$min',
        'max': '$max',
        'sum': '$sum',
        'count': '$sum'
      }[aggregation] || '$avg';
      
      // Convert interval to milliseconds for grouping
      const intervalMs = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '30m': 1800000,
        '1h': 3600000,
        '6h': 21600000,
        '12h': 43200000,
        '1d': 86400000
      }[interval] || 3600000;
      
      const pipeline = [
        { $match: timeFilter },
        {
          $group: {
            _id: {
              $subtract: [
                { $toLong: '$timestamp' },
                { $mod: [{ $toLong: '$timestamp' }, intervalMs] }
              ]
            },
            timestamp: { $first: '$timestamp' },
            value: aggregationFunc === '$count' ? { $sum: 1 } : { [aggregationFunc]: '$value' },
            data_points: { $sum: 1 }
          }
        },
        { $sort: { timestamp: -1 } },
        { $limit: parseInt(limit) },
        { $project: { _id: 0, timestamp: 1, value: 1, data_points: 1 } }
      ];
      
      dataPoints = await sensorDataCollection.aggregate(pipeline).toArray();
    }
    
    res.status(200).json({
      success: true,
      data: {
        sensor_id: id,
        sensor_name: sensor.name,
        aggregation,
        interval: aggregation !== 'none' ? interval : null,
        data_points: dataPoints
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching sensor data:', error);
    return next(new AppError('Failed to fetch sensor data', 500));
  }
});

// Get sensor statistics
const getSensorStats = catchAsync(async (req, res, next) => {
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    const sensorDataCollection = db.collection('sensor_data');
    
    // Overall sensor statistics
    const overviewStats = await sensorsCollection.aggregate([
      {
        $group: {
          _id: null,
          total_sensors: { $sum: 1 },
          active_sensors: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive_sensors: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          error_sensors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          maintenance_sensors: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          sensor_types: { $addToSet: '$sensor_type' },
          devices_with_sensors: { $addToSet: '$device_id' }
        }
      },
      {
        $addFields: {
          sensor_types: { $size: '$sensor_types' },
          devices_with_sensors: { $size: '$devices_with_sensors' }
        }
      },
      {
        $project: {
          _id: 0,
          total_sensors: 1,
          active_sensors: 1,
          inactive_sensors: 1,
          error_sensors: 1,
          maintenance_sensors: 1,
          sensor_types: 1,
          devices_with_sensors: 1
        }
      }
    ]).toArray();
    
    // Statistics by sensor type
    const typeStats = await sensorsCollection.aggregate([
      {
        $group: {
          _id: '$sensor_type',
          count: { $sum: 1 },
          active_count: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          sensor_type: '$_id',
          count: 1,
          active_count: 1
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    // Data overview statistics
    const dataOverviewStats = await sensorDataCollection.aggregate([
      {
        $group: {
          _id: null,
          total_data_points: { $sum: 1 },
          sensors_with_data: { $addToSet: '$sensor_id' },
          oldest_data: { $min: '$timestamp' },
          newest_data: { $max: '$timestamp' }
        }
      },
      {
        $addFields: {
          sensors_with_data: { $size: '$sensors_with_data' }
        }
      },
      {
        $project: {
          _id: 0,
          total_data_points: 1,
          sensors_with_data: 1,
          oldest_data: 1,
          newest_data: 1
        }
      }
    ]).toArray();
    
    res.status(200).json({
      success: true,
      data: {
        overview: overviewStats[0] || {},
        by_type: typeStats,
        data_overview: dataOverviewStats[0] || {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching sensor statistics:', error);
    return next(new AppError('Failed to fetch sensor statistics', 500));
  }
});

// Calibrate sensor
const calibrateSensor = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { calibration_offset, calibration_factor, reference_value, measured_value } = req.body;
  
  let newOffset = calibration_offset;
  let newFactor = calibration_factor;
  
  // Calculate calibration values if reference and measured values are provided
  if (reference_value !== undefined && measured_value !== undefined) {
    newOffset = reference_value - measured_value;
    newFactor = reference_value / measured_value;
  }
  
  try {
    const db = mongoService.getDb();
    const sensorsCollection = db.collection('sensors');
    const auditLogCollection = db.collection('audit_log');
    
    const result = await sensorsCollection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          calibration_offset: newOffset,
          calibration_factor: newFactor,
          last_calibration: new Date(),
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return next(new AppError('Sensor not found', 404));
    }
    
    const updatedSensor = result.value;
    
    // Update cache
    await redisClient.setex(`sensor:${id}`, 120, JSON.stringify(updatedSensor));
    
    // Log calibration
    await auditLogCollection.insertOne({
      user_id: req.user.id,
      action: 'CALIBRATE',
      resource_type: 'sensor',
      resource_id: id,
      details: {
        calibration_offset: newOffset,
        calibration_factor: newFactor,
        reference_value,
        measured_value
      },
      timestamp: new Date()
    });
    
    // Publish sensor calibration event
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('iiot/sensors/calibrated', JSON.stringify({
        sensor_id: id,
        calibration_offset: newOffset,
        calibration_factor: newFactor,
        timestamp: new Date().toISOString()
      }));
    }
    
    logger.info(`Sensor calibrated: ${id}`, {
      calibration_offset: newOffset,
      calibration_factor: newFactor,
      calibrated_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Sensor calibrated successfully',
      data: updatedSensor,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calibrating sensor:', error);
    return next(new AppError('Failed to calibrate sensor', 500));
  }
});

module.exports = {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorData,
  getSensorStats,
  calibrateSensor
};