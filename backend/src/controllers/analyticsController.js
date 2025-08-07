const { ObjectId } = require('mongodb');
const mongoService = require('../services/mongoService');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');

// Get dashboard overview analytics
const getDashboardOverview = catchAsync(async (req, res, next) => {
  const { time_range = '24h' } = req.query;
  
  try {
    const db = mongoService.getDb();
    const devicesCollection = db.collection('devices');
    const sensorsCollection = db.collection('sensors');
    const alertsCollection = db.collection('alerts');
    const sensorDataCollection = db.collection('sensor_data');
    
    // Calculate time range filter
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    const ms = timeRangeMs[time_range] || timeRangeMs['24h'];
    const timeFilter = new Date(Date.now() - ms);
    
    // Device statistics
    const deviceStats = await devicesCollection.aggregate([
      {
        $group: {
          _id: null,
          total_devices: { $sum: 1 },
          online_devices: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
          offline_devices: { $sum: { $cond: [{ $eq: ['$status', 'offline'] }, 1, 0] } },
          error_devices: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
        }
      },
      { $project: { _id: 0 } }
    ]).toArray();
    
    // Sensor statistics
    const sensorStats = await sensorsCollection.aggregate([
      {
        $group: {
          _id: null,
          total_sensors: { $sum: 1 },
          active_sensors: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive_sensors: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          error_sensors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
        }
      },
      { $project: { _id: 0 } }
    ]).toArray();
    
    // Alert statistics
    const alertStats = await alertsCollection.aggregate([
      {
        $group: {
          _id: null,
          total_alerts: { $sum: 1 },
          active_alerts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          critical_alerts: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          recent_alerts: {
            $sum: {
              $cond: [
                { $gte: ['$created_at', timeFilter] },
                1,
                0
              ]
            }
          }
        }
      },
      { $project: { _id: 0 } }
    ]).toArray();
    
    // Data statistics
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const dataStats = await sensorDataCollection.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: null,
          total_data_points: { $sum: 1 },
          recent_data_points: {
            $sum: {
              $cond: [
                { $gte: ['$timestamp', timeFilter] },
                1,
                0
              ]
            }
          },
          active_sensors_with_data: { $addToSet: '$sensor_id' }
        }
      },
      {
        $addFields: {
          active_sensors_with_data: { $size: '$active_sensors_with_data' }
        }
      },
      { $project: { _id: 0 } }
    ]).toArray();
    
    // System health (simplified calculation)
    const [deviceHealthStats, sensorHealthStats, criticalAlertsStats] = await Promise.all([
      devicesCollection.aggregate([
        {
          $group: {
            _id: null,
            online_count: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } },
            total_count: { $sum: 1 }
          }
        }
      ]).toArray(),
      sensorsCollection.aggregate([
        {
          $group: {
            _id: null,
            active_count: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            total_count: { $sum: 1 }
          }
        }
      ]).toArray(),
      alertsCollection.countDocuments({
        status: 'active',
        severity: 'critical',
        created_at: { $gte: timeFilter }
      })
    ]);
    
    const deviceHealthPercentage = deviceHealthStats[0] ? 
      Math.round((deviceHealthStats[0].online_count / deviceHealthStats[0].total_count) * 100 * 100) / 100 : 0;
    
    const sensorHealthPercentage = sensorHealthStats[0] ? 
      Math.round((sensorHealthStats[0].active_count / sensorHealthStats[0].total_count) * 100 * 100) / 100 : 0;
    
    const systemHealth = {
      device_health_percentage: deviceHealthPercentage,
      sensor_health_percentage: sensorHealthPercentage,
      critical_issues: criticalAlertsStats
    };
    
    res.status(200).json({
      success: true,
      data: {
        devices: deviceStats[0] || {},
        sensors: sensorStats[0] || {},
        alerts: alertStats[0] || {},
        data: dataStats[0] || {},
        system_health: systemHealth,
        time_range
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching dashboard overview:', error);
    return next(new AppError('Failed to fetch dashboard overview', 500));
  }
});

// Get device performance analytics
const getDevicePerformance = catchAsync(async (req, res, next) => {
  const { device_id, time_range = '24h', metric = 'uptime' } = req.query;
  
  let performanceQuery;
  let queryParams = [];
  
  if (device_id) {
    queryParams.push(device_id);
  }
  
  queryParams.push(time_range);
  
  switch (metric) {
    case 'uptime':
      performanceQuery = `
        SELECT 
          d.id as device_id,
          d.name as device_name,
          d.location,
          COUNT(CASE WHEN d.status = 'online' THEN 1 END) * 100.0 / COUNT(*) as uptime_percentage,
          COUNT(*) as total_checks,
          COUNT(CASE WHEN d.status = 'online' THEN 1 END) as online_checks,
          COUNT(CASE WHEN d.status = 'offline' THEN 1 END) as offline_checks
        FROM iiot.devices d
        ${device_id ? 'WHERE d.id = $1' : ''}
        GROUP BY d.id, d.name, d.location
        ORDER BY uptime_percentage DESC
      `;
      break;
      
    case 'data_throughput':
      performanceQuery = `
        SELECT 
          d.id as device_id,
          d.name as device_name,
          d.location,
          COUNT(sd.id) as total_data_points,
          COUNT(sd.id) / EXTRACT(EPOCH FROM INTERVAL $${device_id ? '2' : '1'}) * 3600 as data_points_per_hour,
          COUNT(DISTINCT s.id) as active_sensors,
          AVG(sd.value) as avg_sensor_value
        FROM iiot.devices d
        LEFT JOIN iiot.sensors s ON d.id = s.device_id
        LEFT JOIN iiot.sensor_data sd ON s.id = sd.sensor_id AND sd.timestamp > NOW() - INTERVAL $${device_id ? '2' : '1'}
        ${device_id ? 'WHERE d.id = $1' : ''}
        GROUP BY d.id, d.name, d.location
        ORDER BY total_data_points DESC
      `;
      break;
      
    case 'alert_frequency':
      performanceQuery = `
        SELECT 
          d.id as device_id,
          d.name as device_name,
          d.location,
          COUNT(a.id) as total_alerts,
          COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN a.severity = 'high' THEN 1 END) as high_alerts,
          COUNT(CASE WHEN a.status = 'active' THEN 1 END) as active_alerts,
          ROUND(COUNT(a.id) / EXTRACT(EPOCH FROM INTERVAL $${device_id ? '2' : '1'}) * 86400, 2) as alerts_per_day
        FROM iiot.devices d
        LEFT JOIN iiot.alerts a ON d.id = a.device_id AND a.created_at > NOW() - INTERVAL $${device_id ? '2' : '1'}
        ${device_id ? 'WHERE d.id = $1' : ''}
        GROUP BY d.id, d.name, d.location
        ORDER BY total_alerts DESC
      `;
      break;
      
    default:
      return next(new AppError('Invalid metric type', 400));
  }
  
  const result = await query(performanceQuery, queryParams);
  
  res.status(200).json({
    success: true,
    data: {
      metric,
      time_range,
      device_id: device_id || 'all',
      performance_data: result.rows
    },
    timestamp: new Date().toISOString()
  });
});

// Get sensor analytics
const getSensorAnalytics = catchAsync(async (req, res, next) => {
  const {
    sensor_id,
    device_id,
    sensor_type,
    time_range = '24h',
    analysis_type = 'statistical'
  } = req.query;
  
  // Build WHERE conditions
  const conditions = [`sd.timestamp > NOW() - INTERVAL '${time_range}'`];
  const values = [];
  let paramCount = 1;
  
  if (sensor_id) {
    conditions.push(`s.id = $${paramCount}`);
    values.push(sensor_id);
    paramCount++;
  }
  
  if (device_id) {
    conditions.push(`s.device_id = $${paramCount}`);
    values.push(device_id);
    paramCount++;
  }
  
  if (sensor_type) {
    conditions.push(`s.sensor_type = $${paramCount}`);
    values.push(sensor_type);
    paramCount++;
  }
  
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  
  let analyticsQuery;
  
  switch (analysis_type) {
    case 'statistical':
      analyticsQuery = `
        SELECT 
          s.id as sensor_id,
          s.name as sensor_name,
          s.sensor_type,
          s.unit,
          d.name as device_name,
          COUNT(sd.id) as data_points,
          AVG(sd.value) as avg_value,
          MIN(sd.value) as min_value,
          MAX(sd.value) as max_value,
          STDDEV(sd.value) as stddev_value,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sd.value) as median_value,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sd.value) as q1_value,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sd.value) as q3_value,
          COUNT(CASE WHEN sd.quality = 'good' THEN 1 END) * 100.0 / COUNT(*) as data_quality_percentage
        FROM iiot.sensors s
        JOIN iiot.devices d ON s.device_id = d.id
        LEFT JOIN iiot.sensor_data sd ON s.id = sd.sensor_id
        ${whereClause}
        GROUP BY s.id, s.name, s.sensor_type, s.unit, d.name
        ORDER BY data_points DESC
      `;
      break;
      
    case 'trend':
      analyticsQuery = `
        SELECT 
          s.id as sensor_id,
          s.name as sensor_name,
          s.sensor_type,
          s.unit,
          d.name as device_name,
          time_bucket('1 hour', sd.timestamp) as time_bucket,
          AVG(sd.value) as avg_value,
          MIN(sd.value) as min_value,
          MAX(sd.value) as max_value,
          COUNT(sd.id) as data_points
        FROM iiot.sensors s
        JOIN iiot.devices d ON s.device_id = d.id
        LEFT JOIN iiot.sensor_data sd ON s.id = sd.sensor_id
        ${whereClause}
        GROUP BY s.id, s.name, s.sensor_type, s.unit, d.name, time_bucket('1 hour', sd.timestamp)
        ORDER BY s.id, time_bucket DESC
      `;
      break;
      
    case 'anomaly':
      analyticsQuery = `
        WITH sensor_stats AS (
          SELECT 
            sensor_id,
            AVG(value) as mean_value,
            STDDEV(value) as stddev_value
          FROM iiot.sensor_data
          WHERE timestamp > NOW() - INTERVAL '7 days'
          GROUP BY sensor_id
        )
        SELECT 
          s.id as sensor_id,
          s.name as sensor_name,
          s.sensor_type,
          s.unit,
          d.name as device_name,
          COUNT(CASE WHEN ABS(sd.value - ss.mean_value) > 2 * ss.stddev_value THEN 1 END) as anomaly_count,
          COUNT(sd.id) as total_readings,
          ROUND(COUNT(CASE WHEN ABS(sd.value - ss.mean_value) > 2 * ss.stddev_value THEN 1 END) * 100.0 / COUNT(sd.id), 2) as anomaly_percentage,
          ss.mean_value,
          ss.stddev_value
        FROM iiot.sensors s
        JOIN iiot.devices d ON s.device_id = d.id
        LEFT JOIN iiot.sensor_data sd ON s.id = sd.sensor_id
        LEFT JOIN sensor_stats ss ON s.id = ss.sensor_id
        ${whereClause}
        GROUP BY s.id, s.name, s.sensor_type, s.unit, d.name, ss.mean_value, ss.stddev_value
        ORDER BY anomaly_percentage DESC
      `;
      break;
      
    default:
      return next(new AppError('Invalid analysis type', 400));
  }
  
  const result = await query(analyticsQuery, values);
  
  res.status(200).json({
    success: true,
    data: {
      analysis_type,
      time_range,
      filters: {
        sensor_id: sensor_id || 'all',
        device_id: device_id || 'all',
        sensor_type: sensor_type || 'all'
      },
      analytics: result.rows
    },
    timestamp: new Date().toISOString()
  });
});

// Get energy consumption analytics
const getEnergyAnalytics = catchAsync(async (req, res, next) => {
  const {
    device_id,
    time_range = '24h',
    aggregation = 'hourly'
  } = req.query;
  
  const timeInterval = {
    'hourly': '1 hour',
    'daily': '1 day',
    'weekly': '1 week',
    'monthly': '1 month'
  }[aggregation] || '1 hour';
  
  // Build WHERE conditions
  const conditions = [
    `sd.timestamp > NOW() - INTERVAL '${time_range}'`,
    `s.sensor_type IN ('power', 'energy', 'current', 'voltage')`
  ];
  const values = [];
  let paramCount = 1;
  
  if (device_id) {
    conditions.push(`s.device_id = $${paramCount}`);
    values.push(device_id);
    paramCount++;
  }
  
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  
  // Energy consumption over time
  const consumptionQuery = `
    SELECT 
      time_bucket($${paramCount}, sd.timestamp) as time_bucket,
      s.sensor_type,
      d.name as device_name,
      d.location as device_location,
      AVG(sd.value) as avg_consumption,
      SUM(sd.value) as total_consumption,
      MIN(sd.value) as min_consumption,
      MAX(sd.value) as max_consumption,
      COUNT(sd.id) as data_points
    FROM iiot.sensor_data sd
    JOIN iiot.sensors s ON sd.sensor_id = s.id
    JOIN iiot.devices d ON s.device_id = d.id
    ${whereClause}
    GROUP BY time_bucket($${paramCount}, sd.timestamp), s.sensor_type, d.name, d.location
    ORDER BY time_bucket DESC, s.sensor_type
  `;
  
  values.push(timeInterval);
  
  const consumptionResult = await query(consumptionQuery, values);
  
  // Energy efficiency metrics
  const efficiencyQuery = `
    SELECT 
      d.id as device_id,
      d.name as device_name,
      d.location,
      s.sensor_type,
      AVG(sd.value) as avg_consumption,
      SUM(sd.value) as total_consumption,
      COUNT(sd.id) as operating_hours,
      ROUND(SUM(sd.value) / COUNT(sd.id), 2) as efficiency_ratio
    FROM iiot.sensor_data sd
    JOIN iiot.sensors s ON sd.sensor_id = s.id
    JOIN iiot.devices d ON s.device_id = d.id
    ${whereClause}
    GROUP BY d.id, d.name, d.location, s.sensor_type
    ORDER BY total_consumption DESC
  `;
  
  const efficiencyResult = await query(efficiencyQuery, values.slice(0, -1)); // Remove interval parameter
  
  res.status(200).json({
    success: true,
    data: {
      time_range,
      aggregation,
      device_id: device_id || 'all',
      consumption_over_time: consumptionResult.rows,
      efficiency_metrics: efficiencyResult.rows
    },
    timestamp: new Date().toISOString()
  });
});

// Get predictive analytics
const getPredictiveAnalytics = catchAsync(async (req, res, next) => {
  const {
    sensor_id,
    device_id,
    prediction_type = 'failure',
    time_horizon = '7d'
  } = req.query;
  
  // Build WHERE conditions
  const conditions = [`sd.timestamp > NOW() - INTERVAL '30 days'`];
  const values = [];
  let paramCount = 1;
  
  if (sensor_id) {
    conditions.push(`s.id = $${paramCount}`);
    values.push(sensor_id);
    paramCount++;
  }
  
  if (device_id) {
    conditions.push(`s.device_id = $${paramCount}`);
    values.push(device_id);
    paramCount++;
  }
  
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  
  let predictiveQuery;
  
  switch (prediction_type) {
    case 'failure':
      // Simple failure prediction based on anomaly patterns
      predictiveQuery = `
        WITH recent_anomalies AS (
          SELECT 
            s.id as sensor_id,
            s.name as sensor_name,
            d.name as device_name,
            COUNT(CASE WHEN sd.quality = 'bad' THEN 1 END) as bad_quality_count,
            COUNT(sd.id) as total_readings,
            AVG(sd.value) as avg_value,
            STDDEV(sd.value) as stddev_value,
            COUNT(CASE WHEN ABS(sd.value - AVG(sd.value) OVER (PARTITION BY s.id)) > 2 * STDDEV(sd.value) OVER (PARTITION BY s.id) THEN 1 END) as anomaly_count
          FROM iiot.sensor_data sd
          JOIN iiot.sensors s ON sd.sensor_id = s.id
          JOIN iiot.devices d ON s.device_id = d.id
          ${whereClause}
          GROUP BY s.id, s.name, d.name
        )
        SELECT 
          *,
          CASE 
            WHEN bad_quality_count > total_readings * 0.1 OR anomaly_count > total_readings * 0.05 THEN 'high'
            WHEN bad_quality_count > total_readings * 0.05 OR anomaly_count > total_readings * 0.02 THEN 'medium'
            ELSE 'low'
          END as failure_risk,
          ROUND(((bad_quality_count + anomaly_count) * 100.0 / total_readings), 2) as risk_score
        FROM recent_anomalies
        ORDER BY risk_score DESC
      `;
      break;
      
    case 'maintenance':
      // Maintenance prediction based on usage patterns
      predictiveQuery = `
        SELECT 
          d.id as device_id,
          d.name as device_name,
          d.location,
          COUNT(sd.id) as total_data_points,
          AVG(sd.value) as avg_sensor_value,
          COUNT(CASE WHEN sd.timestamp > NOW() - INTERVAL '7 days' THEN 1 END) as recent_activity,
          EXTRACT(DAYS FROM (NOW() - MAX(sd.timestamp))) as days_since_last_data,
          CASE 
            WHEN COUNT(sd.id) > 10000 AND AVG(sd.value) > (SELECT AVG(value) * 1.2 FROM iiot.sensor_data WHERE sensor_id = s.id) THEN 'high'
            WHEN COUNT(sd.id) > 5000 AND AVG(sd.value) > (SELECT AVG(value) * 1.1 FROM iiot.sensor_data WHERE sensor_id = s.id) THEN 'medium'
            ELSE 'low'
          END as maintenance_priority,
          ROUND(COUNT(sd.id) / 1000.0, 2) as usage_intensity_score
        FROM iiot.devices d
        JOIN iiot.sensors s ON d.id = s.device_id
        LEFT JOIN iiot.sensor_data sd ON s.id = sd.sensor_id
        ${whereClause}
        GROUP BY d.id, d.name, d.location, s.id
        ORDER BY usage_intensity_score DESC
      `;
      break;
      
    case 'performance':
      // Performance degradation prediction
      predictiveQuery = `
        WITH performance_trends AS (
          SELECT 
            s.id as sensor_id,
            s.name as sensor_name,
            d.name as device_name,
            date_trunc('day', sd.timestamp) as day,
            AVG(sd.value) as daily_avg,
            COUNT(sd.id) as daily_count
          FROM iiot.sensor_data sd
          JOIN iiot.sensors s ON sd.sensor_id = s.id
          JOIN iiot.devices d ON s.device_id = d.id
          ${whereClause}
          GROUP BY s.id, s.name, d.name, date_trunc('day', sd.timestamp)
        ),
        trend_analysis AS (
          SELECT 
            sensor_id,
            sensor_name,
            device_name,
            AVG(daily_avg) as avg_performance,
            STDDEV(daily_avg) as performance_variance,
            COUNT(*) as days_analyzed,
            (SELECT daily_avg FROM performance_trends pt2 WHERE pt2.sensor_id = pt1.sensor_id ORDER BY day DESC LIMIT 1) as latest_performance,
            (SELECT daily_avg FROM performance_trends pt2 WHERE pt2.sensor_id = pt1.sensor_id ORDER BY day ASC LIMIT 1) as earliest_performance
          FROM performance_trends pt1
          GROUP BY sensor_id, sensor_name, device_name
        )
        SELECT 
          *,
          ROUND(((latest_performance - earliest_performance) / earliest_performance * 100), 2) as performance_change_percentage,
          CASE 
            WHEN ABS(latest_performance - avg_performance) > 2 * performance_variance THEN 'degrading'
            WHEN latest_performance < avg_performance * 0.9 THEN 'declining'
            WHEN latest_performance > avg_performance * 1.1 THEN 'improving'
            ELSE 'stable'
          END as performance_trend
        FROM trend_analysis
        ORDER BY ABS(performance_change_percentage) DESC
      `;
      break;
      
    default:
      return next(new AppError('Invalid prediction type', 400));
  }
  
  const result = await query(predictiveQuery, values);
  
  res.status(200).json({
    success: true,
    data: {
      prediction_type,
      time_horizon,
      filters: {
        sensor_id: sensor_id || 'all',
        device_id: device_id || 'all'
      },
      predictions: result.rows
    },
    timestamp: new Date().toISOString()
  });
});

// Get custom analytics report
const getCustomReport = catchAsync(async (req, res, next) => {
  const {
    report_type,
    start_time,
    end_time,
    device_ids,
    sensor_ids,
    metrics,
    aggregation = 'hourly'
  } = req.body;
  
  if (!report_type || !start_time || !end_time) {
    return next(new AppError('Report type, start time, and end time are required', 400));
  }
  
  // Build dynamic query based on parameters
  const timeInterval = {
    'hourly': '1 hour',
    'daily': '1 day',
    'weekly': '1 week',
    'monthly': '1 month'
  }[aggregation] || '1 hour';
  
  const conditions = [
    `sd.timestamp >= $1`,
    `sd.timestamp <= $2`
  ];
  const values = [start_time, end_time];
  let paramCount = 3;
  
  if (device_ids && device_ids.length > 0) {
    conditions.push(`s.device_id = ANY($${paramCount})`);
    values.push(device_ids);
    paramCount++;
  }
  
  if (sensor_ids && sensor_ids.length > 0) {
    conditions.push(`s.id = ANY($${paramCount})`);
    values.push(sensor_ids);
    paramCount++;
  }
  
  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  
  // Build SELECT clause based on requested metrics
  const metricSelections = [];
  if (metrics && metrics.includes('avg')) metricSelections.push('AVG(sd.value) as avg_value');
  if (metrics && metrics.includes('min')) metricSelections.push('MIN(sd.value) as min_value');
  if (metrics && metrics.includes('max')) metricSelections.push('MAX(sd.value) as max_value');
  if (metrics && metrics.includes('sum')) metricSelections.push('SUM(sd.value) as sum_value');
  if (metrics && metrics.includes('count')) metricSelections.push('COUNT(sd.id) as count_value');
  if (metrics && metrics.includes('stddev')) metricSelections.push('STDDEV(sd.value) as stddev_value');
  
  if (metricSelections.length === 0) {
    metricSelections.push('AVG(sd.value) as avg_value', 'COUNT(sd.id) as count_value');
  }
  
  const customQuery = `
    SELECT 
      time_bucket($${paramCount}, sd.timestamp) as time_bucket,
      s.id as sensor_id,
      s.name as sensor_name,
      s.sensor_type,
      s.unit,
      d.id as device_id,
      d.name as device_name,
      d.location as device_location,
      ${metricSelections.join(', ')}
    FROM iiot.sensor_data sd
    JOIN iiot.sensors s ON sd.sensor_id = s.id
    JOIN iiot.devices d ON s.device_id = d.id
    ${whereClause}
    GROUP BY time_bucket($${paramCount}, sd.timestamp), s.id, s.name, s.sensor_type, s.unit, d.id, d.name, d.location
    ORDER BY time_bucket DESC, s.name
  `;
  
  values.push(timeInterval);
  
  const result = await query(customQuery, values);
  
  // Cache the report for 10 minutes
  const cacheKey = `custom_report:${Buffer.from(JSON.stringify(req.body)).toString('base64')}`;
  await redisClient.setex(cacheKey, 600, JSON.stringify(result.rows));
  
  res.status(200).json({
    success: true,
    data: {
      report_type,
      parameters: {
        start_time,
        end_time,
        device_ids: device_ids || 'all',
        sensor_ids: sensor_ids || 'all',
        metrics: metrics || ['avg', 'count'],
        aggregation
      },
      report_data: result.rows,
      cache_key: cacheKey
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getDashboardOverview,
  getDevicePerformance,
  getSensorAnalytics,
  getEnergyAnalytics,
  getPredictiveAnalytics,
  getCustomReport
};