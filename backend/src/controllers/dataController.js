const mongoService = require('../services/mongoService');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');
const { ObjectId } = require('mongodb');

// Get sensor data with advanced filtering and aggregation
const getSensorData = catchAsync(async (req, res, next) => {
  const {
    sensor_ids,
    device_ids,
    start_time,
    end_time,
    limit = 1000,
    offset = 0,
    aggregation = 'none',
    interval = '1h',
    quality_filter = 'all',
    sort_order = 'desc'
  } = req.query;
  
  try {
    const db = mongoService.getDb();
    const sensorDataCollection = db.collection('sensor_data');
    
    // Build match filter
    const matchFilter = {};
    
    if (sensor_ids) {
      const sensorIdArray = Array.isArray(sensor_ids) ? sensor_ids : sensor_ids.split(',');
      matchFilter.sensor_id = { $in: sensorIdArray };
    }
    
    if (start_time) {
      matchFilter.timestamp = { ...matchFilter.timestamp, $gte: new Date(start_time) };
    }
    
    if (end_time) {
      matchFilter.timestamp = { ...matchFilter.timestamp, $lte: new Date(end_time) };
    }
    
    if (quality_filter !== 'all') {
      matchFilter.quality = quality_filter;
    }
    
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 1 : -1;
    const skip = parseInt(offset);
    const limitNum = parseInt(limit);
    
    let pipeline = [];
    
    // Add match stage
    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }
    
    // Join with sensors collection
    pipeline.push({
      $lookup: {
        from: 'sensors',
        localField: 'sensor_id',
        foreignField: '_id',
        as: 'sensor'
      }
    });
    
    // Join with devices collection
    pipeline.push({
      $lookup: {
        from: 'devices',
        localField: 'sensor.device_id',
        foreignField: '_id',
        as: 'device'
      }
    });
    
    // Unwind arrays
    pipeline.push({ $unwind: '$sensor' });
    pipeline.push({ $unwind: '$device' });
    
    // Filter by device_ids if provided
    if (device_ids) {
      const deviceIdArray = Array.isArray(device_ids) ? device_ids : device_ids.split(',');
      pipeline.push({
        $match: {
          'device._id': { $in: deviceIdArray }
        }
      });
    }
    
    if (aggregation === 'none') {
      // Raw data query
      pipeline.push({
        $project: {
          sensor_id: '$sensor_id',
          sensor_name: '$sensor.name',
          sensor_type: '$sensor.sensor_type',
          unit: '$sensor.unit',
          device_name: '$device.name',
          device_location: '$device.location',
          timestamp: '$timestamp',
          value: '$value',
          quality: '$quality'
        }
      });
      
      pipeline.push({ $sort: { timestamp: sortDirection } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
      
    } else {
      // Aggregated data query - simplified version
      const aggregationOp = {
        'avg': '$avg',
        'min': '$min',
        'max': '$max',
        'sum': '$sum',
        'count': '$sum'
      }[aggregation] || '$avg';
      
      // Group by time intervals (simplified - would need more complex logic for proper time bucketing)
      pipeline.push({
        $group: {
          _id: {
            sensor_id: '$sensor_id',
            sensor_name: '$sensor.name',
            sensor_type: '$sensor.sensor_type',
            unit: '$sensor.unit',
            device_name: '$device.name',
            device_location: '$device.location'
          },
          value: aggregationOp === '$sum' && aggregation === 'count' ? { $sum: 1 } : { [aggregationOp]: '$value' },
          data_points: { $sum: 1 },
          min_value: { $min: '$value' },
          max_value: { $max: '$value' },
          timestamp: { $first: '$timestamp' }
        }
      });
      
      pipeline.push({
        $project: {
          sensor_id: '$_id.sensor_id',
          sensor_name: '$_id.sensor_name',
          sensor_type: '$_id.sensor_type',
          unit: '$_id.unit',
          device_name: '$_id.device_name',
          device_location: '$_id.device_location',
          timestamp: '$timestamp',
          value: '$value',
          data_points: '$data_points',
          min_value: '$min_value',
          max_value: '$max_value'
        }
      });
      
      pipeline.push({ $sort: { timestamp: sortDirection } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
    }
    
    const dataResult = await sensorDataCollection.aggregate(pipeline).toArray();
    
    // Get total count for pagination
    const countPipeline = [];
    if (Object.keys(matchFilter).length > 0) {
      countPipeline.push({ $match: matchFilter });
    }
    
    if (device_ids) {
      countPipeline.push({
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      });
      countPipeline.push({ $unwind: '$sensor' });
      const deviceIdArray = Array.isArray(device_ids) ? device_ids : device_ids.split(',');
      countPipeline.push({
        $match: {
          'sensor.device_id': { $in: deviceIdArray }
        }
      });
    }
    
    countPipeline.push({ $count: 'total' });
    const countResult = await sensorDataCollection.aggregate(countPipeline).toArray();
    const totalCount = countResult[0]?.total || 0;
    
    res.status(200).json({
      success: true,
      data: {
        data_points: dataResult,
        aggregation,
        interval: aggregation !== 'none' ? interval : null,
        pagination: {
          limit: limitNum,
          offset: skip,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database error during sensor data retrieval:', error);
    return next(new AppError('Failed to retrieve sensor data', 500));
  }
});

// Get real-time data for dashboard
const getRealTimeData = catchAsync(async (req, res, next) => {
  const { device_ids, sensor_types, limit = 50 } = req.query;
  
  try {
    const db = mongoService.getDb();
    const sensorDataCollection = db.collection('sensor_data');
    
    // Build match filter for recent data (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const matchFilter = {
      timestamp: { $gt: fiveMinutesAgo }
    };
    
    const pipeline = [
      { $match: matchFilter },
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
          from: 'devices',
          localField: 'sensor.device_id',
          foreignField: '_id',
          as: 'device'
        }
      },
      { $unwind: '$sensor' },
      { $unwind: '$device' }
    ];
    
    // Add device filter if provided
    if (device_ids) {
      const deviceIdArray = Array.isArray(device_ids) ? device_ids : device_ids.split(',');
      pipeline.push({
        $match: {
          'device._id': { $in: deviceIdArray }
        }
      });
    }
    
    // Add sensor type filter if provided
    if (sensor_types) {
      const sensorTypeArray = Array.isArray(sensor_types) ? sensor_types : sensor_types.split(',');
      pipeline.push({
        $match: {
          'sensor.sensor_type': { $in: sensorTypeArray }
        }
      });
    }
    
    // Sort by timestamp descending and get latest for each sensor
    pipeline.push(
      { $sort: { sensor_id: 1, timestamp: -1 } },
      {
        $group: {
          _id: '$sensor_id',
          sensor_id: { $first: '$sensor_id' },
          sensor_name: { $first: '$sensor.name' },
          sensor_type: { $first: '$sensor.sensor_type' },
          unit: { $first: '$sensor.unit' },
          min_value: { $first: '$sensor.min_value' },
          max_value: { $first: '$sensor.max_value' },
          device_id: { $first: '$device._id' },
          device_name: { $first: '$device.name' },
          device_location: { $first: '$device.location' },
          device_status: { $first: '$device.status' },
          timestamp: { $first: '$timestamp' },
          value: { $first: '$value' },
          quality: { $first: '$quality' }
        }
      },
      {
        $project: {
          _id: 0,
          sensor_id: 1,
          sensor_name: 1,
          sensor_type: 1,
          unit: 1,
          min_value: 1,
          max_value: 1,
          device_id: 1,
          device_name: 1,
          device_location: 1,
          device_status: 1,
          timestamp: 1,
          value: 1,
          quality: 1
        }
      },
      { $limit: parseInt(limit) }
    );
    
    const dataResult = await sensorDataCollection.aggregate(pipeline).toArray();
    
    res.status(200).json({
      success: true,
      data: dataResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database error during real-time data retrieval:', error);
    return next(new AppError('Failed to retrieve real-time data', 500));
  }
});

// Get data statistics
const getDataStatistics = catchAsync(async (req, res, next) => {
  const {
    sensor_id,
    device_id,
    start_time,
    end_time,
    time_range = '24h'
  } = req.query;
  
  try {
    // Build match filter
    let matchFilter = {};
    
    if (sensor_id) {
      matchFilter.sensor_id = new ObjectId(sensor_id);
    }
    
    if (device_id) {
      // First get sensors for this device
      const deviceSensors = await mongoService.find('sensors', { device_id: new ObjectId(device_id) }, { _id: 1 });
      const sensorIds = deviceSensors.map(s => s._id);
      
      if (sensorIds.length > 0) {
        if (matchFilter.sensor_id) {
          // If sensor_id is also specified, ensure it's in the device's sensors
          if (sensorIds.some(id => id.equals(matchFilter.sensor_id))) {
            // Keep the existing sensor_id filter
          } else {
            // Sensor doesn't belong to device, return empty result
            return res.status(200).json({
              success: true,
              data: {
                statistics: {
                  total_data_points: 0,
                  sensors_count: 0,
                  devices_count: 0
                },
                hourly_distribution: []
              },
              timestamp: new Date().toISOString()
            });
          }
        } else {
          matchFilter.sensor_id = { $in: sensorIds };
        }
      }
    }
    
    // Handle time filters
    if (start_time || end_time || time_range) {
      matchFilter.timestamp = {};
      
      if (start_time) {
        matchFilter.timestamp.$gte = new Date(start_time);
      } else if (time_range) {
        const timeRangeMs = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000
        };
        const ms = timeRangeMs[time_range] || timeRangeMs['24h'];
        matchFilter.timestamp.$gte = new Date(Date.now() - ms);
      }
      
      if (end_time) {
        matchFilter.timestamp.$lte = new Date(end_time);
      }
    }
    
    // Get comprehensive statistics using aggregation
    const statsAggregation = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      { $unwind: '$sensor' },
      {
        $group: {
          _id: null,
          total_data_points: { $sum: 1 },
          sensors_count: { $addToSet: '$sensor_id' },
          devices_count: { $addToSet: '$sensor.device_id' },
          values: { $push: '$value' },
          avg_value: { $avg: '$value' },
          min_value: { $min: '$value' },
          max_value: { $max: '$value' },
          earliest_timestamp: { $min: '$timestamp' },
          latest_timestamp: { $max: '$timestamp' },
          good_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'good'] }, 1, 0] }
          },
          bad_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'bad'] }, 1, 0] }
          },
          uncertain_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'uncertain'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          sensors_count: { $size: '$sensors_count' },
          devices_count: { $size: '$devices_count' },
          stddev_value: { $stdDevPop: '$values' },
          median_value: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$values', sortBy: 1 } },
                length: { $size: '$values' }
              },
              in: {
                $cond: {
                  if: { $eq: [{ $mod: ['$$length', 2] }, 0] },
                  then: {
                    $avg: [
                      { $arrayElemAt: ['$$sorted', { $divide: [{ $subtract: ['$$length', 2] }, 2] }] },
                      { $arrayElemAt: ['$$sorted', { $divide: ['$$length', 2] }] }
                    ]
                  },
                  else: { $arrayElemAt: ['$$sorted', { $floor: { $divide: ['$$length', 2] } }] }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          values: 0
        }
      }
    ];
    
    const statsResult = await mongoService.aggregate('sensor_data', statsAggregation);
    const statistics = statsResult[0] || {
      total_data_points: 0,
      sensors_count: 0,
      devices_count: 0,
      avg_value: null,
      min_value: null,
      max_value: null,
      stddev_value: null,
      median_value: null,
      earliest_timestamp: null,
      latest_timestamp: null,
      good_quality_count: 0,
      bad_quality_count: 0,
      uncertain_quality_count: 0
    };
    
    // Get data distribution by hour
    const distributionAggregation = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      { $unwind: '$sensor' },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          data_points: { $sum: 1 },
          avg_value: { $avg: '$value' }
        }
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          data_points: 1,
          avg_value: 1
        }
      },
      { $sort: { hour: 1 } }
    ];
    
    const distributionResult = await mongoService.aggregate('sensor_data', distributionAggregation);
    
    res.status(200).json({
      success: true,
      data: {
        statistics,
        hourly_distribution: distributionResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting data statistics:', error);
    return next(new AppError('Failed to get data statistics', 500));
  }
});

// Export data to CSV format
const exportData = catchAsync(async (req, res, next) => {
  const {
    sensor_ids,
    device_ids,
    start_time,
    end_time,
    format = 'json',
    include_metadata = 'true'
  } = req.query;
  
  try {
    // Build match filter
    let matchFilter = {};
    
    if (sensor_ids) {
      const sensorIdArray = Array.isArray(sensor_ids) ? sensor_ids : sensor_ids.split(',');
      matchFilter.sensor_id = { $in: sensorIdArray.map(id => new ObjectId(id)) };
    }
    
    if (device_ids) {
      const deviceIdArray = Array.isArray(device_ids) ? device_ids : device_ids.split(',');
      // First get sensors for these devices
      const deviceSensors = await mongoService.find('sensors', 
        { device_id: { $in: deviceIdArray.map(id => new ObjectId(id)) } }, 
        { _id: 1 }
      );
      const sensorIds = deviceSensors.map(s => s._id);
      
      if (sensorIds.length > 0) {
        if (matchFilter.sensor_id) {
          // Intersect with existing sensor filter
          const existingSensorIds = matchFilter.sensor_id.$in;
          matchFilter.sensor_id = { 
            $in: sensorIds.filter(id => 
              existingSensorIds.some(existingId => existingId.equals(id))
            )
          };
        } else {
          matchFilter.sensor_id = { $in: sensorIds };
        }
      } else {
        // No sensors found for specified devices
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (start_time || end_time) {
      matchFilter.timestamp = {};
      if (start_time) {
        matchFilter.timestamp.$gte = new Date(start_time);
      }
      if (end_time) {
        matchFilter.timestamp.$lte = new Date(end_time);
      }
    }
    
    // Build aggregation pipeline
    const pipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      { $unwind: '$sensor' }
    ];
    
    if (include_metadata === 'true') {
      pipeline.push({
        $lookup: {
          from: 'devices',
          localField: 'sensor.device_id',
          foreignField: '_id',
          as: 'device'
        }
      });
      pipeline.push({ $unwind: '$device' });
      
      pipeline.push({
        $project: {
          timestamp: 1,
          value: 1,
          quality: 1,
          sensor_id: 1,
          sensor_name: '$sensor.name',
          sensor_type: '$sensor.sensor_type',
          unit: '$sensor.unit',
          device_id: '$device._id',
          device_name: '$device.name',
          device_location: '$device.location'
        }
      });
    } else {
      pipeline.push({
        $project: {
          timestamp: 1,
          value: 1,
          quality: 1,
          sensor_id: 1
        }
      });
    }
    
    pipeline.push({ $sort: { timestamp: -1 } });
    pipeline.push({ $limit: 10000 });
    
    const dataResult = await mongoService.aggregate('sensor_data', pipeline);
    
    if (format === 'csv') {
      // Convert to CSV format
      if (dataResult.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="sensor_data_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('No data found');
        return;
      }
      
      const headers = Object.keys(dataResult[0]);
      const csvContent = [
        headers.join(','),
        ...dataResult.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sensor_data_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON format
      res.status(200).json({
        success: true,
        data: dataResult,
        count: dataResult.length,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('Error exporting data:', error);
    return next(new AppError('Failed to export data', 500));
  }
});

// Get data quality metrics
const getDataQuality = catchAsync(async (req, res, next) => {
  const {
    sensor_id,
    device_id,
    start_time,
    end_time,
    time_range = '24h'
  } = req.query;
  
  try {
    // Build match filter
    let matchFilter = {};
    
    if (sensor_id) {
      matchFilter.sensor_id = new ObjectId(sensor_id);
    }
    
    if (device_id) {
      // First get sensors for this device
      const deviceSensors = await mongoService.find('sensors', { device_id: new ObjectId(device_id) }, { _id: 1 });
      const sensorIds = deviceSensors.map(s => s._id);
      
      if (sensorIds.length > 0) {
        if (matchFilter.sensor_id) {
          // If sensor_id is also specified, ensure it's in the device's sensors
          if (sensorIds.some(id => id.equals(matchFilter.sensor_id))) {
            // Keep the existing sensor_id filter
          } else {
            // Sensor doesn't belong to device, return empty result
            return res.status(200).json({
              success: true,
              data: {
                quality_by_sensor: [],
                overall_completeness: {
                  expected_hours: 0,
                  actual_hours: 0,
                  missing_hours: 0,
                  data_completeness_percentage: 0
                }
              },
              timestamp: new Date().toISOString()
            });
          }
        } else {
          matchFilter.sensor_id = { $in: sensorIds };
        }
      }
    }
    
    // Handle time filters
    if (start_time || end_time || time_range) {
      matchFilter.timestamp = {};
      
      if (start_time) {
        matchFilter.timestamp.$gte = new Date(start_time);
      } else if (time_range) {
        const timeRangeMs = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000
        };
        const ms = timeRangeMs[time_range] || timeRangeMs['24h'];
        matchFilter.timestamp.$gte = new Date(Date.now() - ms);
      }
      
      if (end_time) {
        matchFilter.timestamp.$lte = new Date(end_time);
      }
    }
    
    // Get quality metrics by sensor
    const qualityAggregation = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'sensors',
          localField: 'sensor_id',
          foreignField: '_id',
          as: 'sensor'
        }
      },
      { $unwind: '$sensor' },
      {
        $group: {
          _id: {
            sensor_id: '$sensor_id',
            sensor_name: '$sensor.name',
            sensor_type: '$sensor.sensor_type',
            min_value: '$sensor.min_value',
            max_value: '$sensor.max_value'
          },
          total_data_points: { $sum: 1 },
          good_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'good'] }, 1, 0] }
          },
          bad_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'bad'] }, 1, 0] }
          },
          uncertain_quality_count: {
            $sum: { $cond: [{ $eq: ['$quality', 'uncertain'] }, 1, 0] }
          },
          out_of_range_count: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $lt: ['$value', '$sensor.min_value'] },
                    { $gt: ['$value', '$sensor.max_value'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          good_quality_percentage: {
            $round: [
              { $multiply: [{ $divide: ['$good_quality_count', '$total_data_points'] }, 100] },
              2
            ]
          },
          out_of_range_percentage: {
            $round: [
              { $multiply: [{ $divide: ['$out_of_range_count', '$total_data_points'] }, 100] },
              2
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          sensor_id: '$_id.sensor_id',
          sensor_name: '$_id.sensor_name',
          sensor_type: '$_id.sensor_type',
          total_data_points: 1,
          good_quality_count: 1,
          bad_quality_count: 1,
          uncertain_quality_count: 1,
          good_quality_percentage: 1,
          out_of_range_count: 1,
          out_of_range_percentage: 1
        }
      },
      { $sort: { good_quality_percentage: -1 } }
    ];
    
    const qualityResult = await mongoService.aggregate('sensor_data', qualityAggregation);
    
    // Get overall data completeness (simplified version)
    // For MongoDB, we'll calculate based on expected vs actual data points per hour
    const completenessAggregation = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
          },
          data_count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          actual_hours: { $sum: 1 },
          total_data_points: { $sum: '$data_count' }
        }
      }
    ];
    
    const completenessResult = await mongoService.aggregate('sensor_data', completenessAggregation);
    
    // Calculate expected hours based on time range
    let expectedHours = 24; // Default for 24h
    if (time_range) {
      const timeRangeHours = {
        '1h': 1,
        '24h': 24,
        '7d': 7 * 24,
        '30d': 30 * 24
      };
      expectedHours = timeRangeHours[time_range] || 24;
    } else if (start_time && end_time) {
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      expectedHours = Math.ceil((endDate - startDate) / (1000 * 60 * 60));
    }
    
    const actualHours = completenessResult[0]?.actual_hours || 0;
    const missingHours = Math.max(0, expectedHours - actualHours);
    const completenessPercentage = expectedHours > 0 ? 
      Math.round((actualHours / expectedHours) * 100 * 100) / 100 : 0;
    
    const overallCompleteness = {
      expected_hours: expectedHours,
      actual_hours: actualHours,
      missing_hours: missingHours,
      data_completeness_percentage: completenessPercentage
    };
    
    res.status(200).json({
      success: true,
      data: {
        quality_by_sensor: qualityResult,
        overall_completeness: overallCompleteness
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting data quality:', error);
    return next(new AppError('Failed to get data quality metrics', 500));
  }
});

// Delete old data (data retention)
const deleteOldData = catchAsync(async (req, res, next) => {
  const { retention_days = 90, sensor_id, device_id } = req.body;
  
  try {
    // Build filter conditions
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention_days);
    
    let matchFilter = {
      timestamp: { $lt: cutoffDate }
    };
    
    // If sensor_id or device_id is specified, we need to join with sensors collection
    if (sensor_id || device_id) {
      const sensorFilter = {};
      if (sensor_id) sensorFilter._id = new ObjectId(sensor_id);
      if (device_id) sensorFilter.device_id = new ObjectId(device_id);
      
      // Get matching sensor IDs
      const matchingSensors = await mongoService.find('sensors', sensorFilter, { _id: 1 });
      const sensorIds = matchingSensors.map(s => s._id);
      
      if (sensorIds.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No sensors found matching criteria',
          deleted_count: 0,
          timestamp: new Date().toISOString()
        });
      }
      
      matchFilter.sensor_id = { $in: sensorIds };
    }
    
    // Count data to be deleted
    const deleteCount = await mongoService.countDocuments('sensor_data', matchFilter);
    
    if (deleteCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No old data found to delete',
        deleted_count: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Delete old data
    await mongoService.deleteMany('sensor_data', matchFilter);
    
    // Log data deletion
    await mongoService.insertOne('audit_log', {
      user_id: new ObjectId(req.user.id),
      action: 'DELETE',
      resource_type: 'sensor_data',
      resource_id: 'bulk',
      details: {
        retention_days,
        deleted_count: deleteCount,
        sensor_id,
        device_id
      },
      timestamp: new Date()
    });
    
    logger.info(`Old sensor data deleted`, {
      retention_days,
      deleted_count: deleteCount,
      sensor_id,
      device_id,
      deleted_by: req.user.id
    });
    
    res.status(200).json({
      success: true,
      message: 'Old data deleted successfully',
      deleted_count: deleteCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error deleting old data:', error);
    return next(new AppError('Failed to delete old data', 500));
  }
});

module.exports = {
  getSensorData,
  getRealTimeData,
  getDataStatistics,
  exportData,
  getDataQuality,
  deleteOldData
};