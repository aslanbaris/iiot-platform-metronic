const express = require('express');
const { query } = require('express-validator');
const {
  getDashboardOverview,
  getDevicePerformance,
  getSensorAnalytics,
  getEnergyAnalytics,
  getPredictiveAnalytics,
  getCustomReport
} = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateDateRange } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard overview statistics
 *     description: Retrieve comprehensive dashboard statistics for system overview
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d, 90d, 1y]
 *           default: 24h
 *         description: Time range for dashboard data
 *       - in: query
 *         name: refresh_cache
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached dashboard data
 *     responses:
 *       200:
 *         description: Dashboard overview statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_devices:
 *                           type: integer
 *                         active_devices:
 *                           type: integer
 *                         total_sensors:
 *                           type: integer
 *                         active_sensors:
 *                           type: integer
 *                         total_alerts:
 *                           type: integer
 *                         active_alerts:
 *                           type: integer
 *                         critical_alerts:
 *                           type: integer
 *                         data_points_today:
 *                           type: integer
 *                         system_uptime_percentage:
 *                           type: number
 *                         avg_response_time_ms:
 *                           type: number
 *                     device_status:
 *                       type: object
 *                       properties:
 *                         online:
 *                           type: integer
 *                         offline:
 *                           type: integer
 *                         maintenance:
 *                           type: integer
 *                         error:
 *                           type: integer
 *                     alert_trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           total_alerts:
 *                             type: integer
 *                           critical_alerts:
 *                             type: integer
 *                           resolved_alerts:
 *                             type: integer
 *                     data_volume_trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           data_points:
 *                             type: integer
 *                           data_size_mb:
 *                             type: number
 *                     top_devices_by_alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           device_id:
 *                             type: string
 *                             format: uuid
 *                           device_name:
 *                             type: string
 *                           alert_count:
 *                             type: integer
 *                           critical_count:
 *                             type: integer
 *                     recent_activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           type:
 *                             type: string
 *                           description:
 *                             type: string
 *                           severity:
 *                             type: string
 *                     cache_info:
 *                       type: object
 *                       properties:
 *                         last_updated:
 *                           type: string
 *                           format: date-time
 *                         cache_age_seconds:
 *                           type: integer
 *                         next_refresh:
 *                           type: string
 *                           format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/dashboard', [
  query('time_range')
    .optional()
    .isIn(['1h', '6h', '24h', '7d', '30d', '90d', '1y'])
    .withMessage('Time range must be one of: 1h, 6h, 24h, 7d, 30d, 90d, 1y'),
  query('refresh_cache')
    .optional()
    .isBoolean()
    .withMessage('Refresh cache must be a boolean'),
  validate
], getDashboardOverview);

/**
 * @swagger
 * /api/analytics/devices/performance:
 *   get:
 *     summary: Get device performance analytics
 *     description: Retrieve detailed performance analytics for devices
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for performance analysis
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for performance analysis
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *           enum: [uptime, data_flow, alert_frequency, response_time, all]
 *           default: all
 *         description: Specific metrics to include
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Group performance data by time period
 *     responses:
 *       200:
 *         description: Device performance analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     devices:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           device_id:
 *                             type: string
 *                             format: uuid
 *                           device_name:
 *                             type: string
 *                           device_type:
 *                             type: string
 *                           uptime_percentage:
 *                             type: number
 *                           total_uptime_hours:
 *                             type: number
 *                           total_downtime_hours:
 *                             type: number
 *                           data_points_sent:
 *                             type: integer
 *                           data_transmission_rate:
 *                             type: number
 *                           alert_frequency:
 *                             type: number
 *                           avg_response_time_ms:
 *                             type: number
 *                           performance_score:
 *                             type: number
 *                           status_history:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 timestamp:
 *                                   type: string
 *                                   format: date-time
 *                                 status:
 *                                   type: string
 *                                 duration_minutes:
 *                                   type: number
 *                           data_flow_trends:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 period:
 *                                   type: string
 *                                 data_points:
 *                                   type: integer
 *                                 avg_interval_seconds:
 *                                   type: number
 *                                 data_quality_score:
 *                                   type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_devices_analyzed:
 *                           type: integer
 *                         avg_uptime_percentage:
 *                           type: number
 *                         total_data_points:
 *                           type: integer
 *                         avg_performance_score:
 *                           type: number
 *                         analysis_period:
 *                           type: object
 *                           properties:
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/devices/performance', [
  validateDateRange,
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('metrics')
    .optional()
    .isIn(['uptime', 'data_flow', 'alert_frequency', 'response_time', 'all'])
    .withMessage('Metrics must be one of: uptime, data_flow, alert_frequency, response_time, all'),
  query('group_by')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: hour, day, week, month'),
  validate
], getDevicePerformance);

/**
 * @swagger
 * /api/analytics/sensors:
 *   get:
 *     summary: Get sensor analytics
 *     description: Retrieve comprehensive sensor analytics including statistical analysis and trends
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: sensor_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor types
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for sensor analysis
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for sensor analysis
 *       - in: query
 *         name: analysis_type
 *         schema:
 *           type: string
 *           enum: [statistical, trend, anomaly, correlation, all]
 *           default: all
 *         description: Type of analysis to perform
 *       - in: query
 *         name: include_predictions
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include predictive analysis
 *       - in: query
 *         name: anomaly_sensitivity
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *         description: Sensitivity level for anomaly detection
 *     responses:
 *       200:
 *         description: Sensor analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sensors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sensor_id:
 *                             type: string
 *                             format: uuid
 *                           sensor_name:
 *                             type: string
 *                           sensor_type:
 *                             type: string
 *                           device_id:
 *                             type: string
 *                             format: uuid
 *                           statistical_analysis:
 *                             type: object
 *                             properties:
 *                               total_readings:
 *                                 type: integer
 *                               avg_value:
 *                                 type: number
 *                               min_value:
 *                                 type: number
 *                               max_value:
 *                                 type: number
 *                               std_deviation:
 *                                 type: number
 *                               variance:
 *                                 type: number
 *                               median:
 *                                 type: number
 *                               percentile_95:
 *                                 type: number
 *                               percentile_99:
 *                                 type: number
 *                           trend_analysis:
 *                             type: object
 *                             properties:
 *                               trend_direction:
 *                                 type: string
 *                                 enum: [increasing, decreasing, stable, volatile]
 *                               trend_strength:
 *                                 type: number
 *                               slope:
 *                                 type: number
 *                               r_squared:
 *                                 type: number
 *                               seasonal_patterns:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     pattern_type:
 *                                       type: string
 *                                     period:
 *                                       type: string
 *                                     strength:
 *                                       type: number
 *                           anomaly_detection:
 *                             type: object
 *                             properties:
 *                               total_anomalies:
 *                                 type: integer
 *                               anomaly_rate:
 *                                 type: number
 *                               anomaly_types:
 *                                 type: object
 *                                 properties:
 *                                   outliers:
 *                                     type: integer
 *                                   spikes:
 *                                     type: integer
 *                                   drifts:
 *                                     type: integer
 *                                   gaps:
 *                                     type: integer
 *                               recent_anomalies:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     timestamp:
 *                                       type: string
 *                                       format: date-time
 *                                     value:
 *                                       type: number
 *                                     anomaly_type:
 *                                       type: string
 *                                     severity:
 *                                       type: string
 *                                     confidence:
 *                                       type: number
 *                           predictions:
 *                             type: object
 *                             properties:
 *                               next_hour_forecast:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     timestamp:
 *                                       type: string
 *                                       format: date-time
 *                                     predicted_value:
 *                                       type: number
 *                                     confidence_interval:
 *                                       type: object
 *                                       properties:
 *                                         lower:
 *                                           type: number
 *                                         upper:
 *                                           type: number
 *                               model_accuracy:
 *                                 type: number
 *                               last_updated:
 *                                 type: string
 *                                 format: date-time
 *                     correlations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sensor_pair:
 *                             type: array
 *                             items:
 *                               type: string
 *                               format: uuid
 *                           correlation_coefficient:
 *                             type: number
 *                           correlation_strength:
 *                             type: string
 *                             enum: [weak, moderate, strong, very_strong]
 *                           p_value:
 *                             type: number
 *                           is_significant:
 *                             type: boolean
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_sensors_analyzed:
 *                           type: integer
 *                         analysis_period:
 *                           type: object
 *                           properties:
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *                         total_data_points:
 *                           type: integer
 *                         avg_data_quality:
 *                           type: number
 *                         total_anomalies_detected:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/sensors', [
  validateDateRange,
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('sensor_types')
    .optional()
    .isString()
    .custom((value) => {
      const types = value.split(',');
      return types.every(type => type.trim().length > 0 && type.trim().length <= 50);
    })
    .withMessage('All sensor types must be between 1 and 50 characters'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('analysis_type')
    .optional()
    .isIn(['statistical', 'trend', 'anomaly', 'correlation', 'all'])
    .withMessage('Analysis type must be one of: statistical, trend, anomaly, correlation, all'),
  query('include_predictions')
    .optional()
    .isBoolean()
    .withMessage('Include predictions must be a boolean'),
  query('anomaly_sensitivity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Anomaly sensitivity must be one of: low, medium, high'),
  validate
], getSensorAnalytics);

/**
 * @swagger
 * /api/analytics/energy:
 *   get:
 *     summary: Get energy consumption analytics
 *     description: Retrieve energy consumption analytics and optimization insights
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for energy analysis
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for energy analysis
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [device, location, type, hour, day, week, month]
 *           default: device
 *         description: Group energy data by field
 *       - in: query
 *         name: include_cost_analysis
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include cost analysis in results
 *       - in: query
 *         name: energy_rate_per_kwh
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Energy rate per kWh for cost calculations
 *     responses:
 *       200:
 *         description: Energy consumption analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     energy_consumption:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           group_key:
 *                             type: string
 *                           group_value:
 *                             type: string
 *                           total_consumption_kwh:
 *                             type: number
 *                           avg_power_consumption_w:
 *                             type: number
 *                           peak_consumption_w:
 *                             type: number
 *                           consumption_trend:
 *                             type: string
 *                             enum: [increasing, decreasing, stable]
 *                           efficiency_score:
 *                             type: number
 *                           cost_analysis:
 *                             type: object
 *                             properties:
 *                               total_cost:
 *                                 type: number
 *                               avg_daily_cost:
 *                                 type: number
 *                               projected_monthly_cost:
 *                                 type: number
 *                               cost_per_data_point:
 *                                 type: number
 *                           consumption_patterns:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 time_period:
 *                                   type: string
 *                                 avg_consumption_w:
 *                                   type: number
 *                                 pattern_type:
 *                                   type: string
 *                     optimization_insights:
 *                       type: object
 *                       properties:
 *                         potential_savings_kwh:
 *                           type: number
 *                         potential_cost_savings:
 *                           type: number
 *                         efficiency_recommendations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               device_id:
 *                                 type: string
 *                                 format: uuid
 *                               recommendation:
 *                                 type: string
 *                               potential_savings_percentage:
 *                                 type: number
 *                               priority:
 *                                 type: string
 *                                 enum: [low, medium, high]
 *                         peak_usage_times:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               time_range:
 *                                 type: string
 *                               avg_consumption_w:
 *                                 type: number
 *                               devices_count:
 *                                 type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_consumption_kwh:
 *                           type: number
 *                         total_cost:
 *                           type: number
 *                         avg_efficiency_score:
 *                           type: number
 *                         total_devices_analyzed:
 *                           type: integer
 *                         analysis_period:
 *                           type: object
 *                           properties:
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/energy', [
  validateDateRange,
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('group_by')
    .optional()
    .isIn(['device', 'location', 'type', 'hour', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: device, location, type, hour, day, week, month'),
  query('include_cost_analysis')
    .optional()
    .isBoolean()
    .withMessage('Include cost analysis must be a boolean'),
  query('energy_rate_per_kwh')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Energy rate per kWh must be a positive number'),
  validate
], getEnergyAnalytics);

/**
 * @swagger
 * /api/analytics/predictive:
 *   get:
 *     summary: Get predictive analytics
 *     description: Retrieve predictive analytics for failure prediction, maintenance scheduling, and performance forecasting
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: prediction_type
 *         schema:
 *           type: string
 *           enum: [failure, maintenance, performance, all]
 *           default: all
 *         description: Type of prediction to generate
 *       - in: query
 *         name: forecast_horizon_days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to forecast ahead
 *       - in: query
 *         name: confidence_threshold
 *         schema:
 *           type: number
 *           minimum: 0.5
 *           maximum: 0.99
 *           default: 0.8
 *         description: Minimum confidence threshold for predictions
 *       - in: query
 *         name: include_recommendations
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include actionable recommendations
 *     responses:
 *       200:
 *         description: Predictive analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     failure_predictions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           device_id:
 *                             type: string
 *                             format: uuid
 *                           device_name:
 *                             type: string
 *                           failure_probability:
 *                             type: number
 *                           predicted_failure_date:
 *                             type: string
 *                             format: date-time
 *                           confidence:
 *                             type: number
 *                           risk_factors:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 factor:
 *                                   type: string
 *                                 impact_score:
 *                                   type: number
 *                                 description:
 *                                   type: string
 *                           recommended_actions:
 *                             type: array
 *                             items:
 *                               type: string
 *                     maintenance_schedule:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           device_id:
 *                             type: string
 *                             format: uuid
 *                           device_name:
 *                             type: string
 *                           maintenance_type:
 *                             type: string
 *                             enum: [preventive, predictive, corrective]
 *                           recommended_date:
 *                             type: string
 *                             format: date-time
 *                           priority:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           estimated_duration_hours:
 *                             type: number
 *                           estimated_cost:
 *                             type: number
 *                           maintenance_tasks:
 *                             type: array
 *                             items:
 *                               type: string
 *                           last_maintenance:
 *                             type: string
 *                             format: date-time
 *                     performance_forecasts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           entity_id:
 *                             type: string
 *                             format: uuid
 *                           entity_type:
 *                             type: string
 *                             enum: [device, sensor]
 *                           entity_name:
 *                             type: string
 *                           forecast_data:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 timestamp:
 *                                   type: string
 *                                   format: date-time
 *                                 predicted_performance:
 *                                   type: number
 *                                 confidence_interval:
 *                                   type: object
 *                                   properties:
 *                                     lower:
 *                                       type: number
 *                                     upper:
 *                                       type: number
 *                           performance_trend:
 *                             type: string
 *                             enum: [improving, stable, declining]
 *                           expected_degradation_rate:
 *                             type: number
 *                     model_performance:
 *                       type: object
 *                       properties:
 *                         failure_model:
 *                           type: object
 *                           properties:
 *                             accuracy:
 *                               type: number
 *                             precision:
 *                               type: number
 *                             recall:
 *                               type: number
 *                             last_trained:
 *                               type: string
 *                               format: date-time
 *                         maintenance_model:
 *                           type: object
 *                           properties:
 *                             accuracy:
 *                               type: number
 *                             last_trained:
 *                               type: string
 *                               format: date-time
 *                         performance_model:
 *                           type: object
 *                           properties:
 *                             mae:
 *                               type: number
 *                             rmse:
 *                               type: number
 *                             r_squared:
 *                               type: number
 *                             last_trained:
 *                               type: string
 *                               format: date-time
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [immediate_action, schedule_maintenance, monitor_closely, optimize_settings]
 *                           priority:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           description:
 *                             type: string
 *                           affected_devices:
 *                             type: array
 *                             items:
 *                               type: string
 *                               format: uuid
 *                           estimated_impact:
 *                             type: string
 *                           deadline:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/predictive', [
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('prediction_type')
    .optional()
    .isIn(['failure', 'maintenance', 'performance', 'all'])
    .withMessage('Prediction type must be one of: failure, maintenance, performance, all'),
  query('forecast_horizon_days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Forecast horizon must be between 1 and 365 days'),
  query('confidence_threshold')
    .optional()
    .isFloat({ min: 0.5, max: 0.99 })
    .withMessage('Confidence threshold must be between 0.5 and 0.99'),
  query('include_recommendations')
    .optional()
    .isBoolean()
    .withMessage('Include recommendations must be a boolean'),
  validate
], getPredictiveAnalytics);

/**
 * @swagger
 * /api/analytics/reports:
 *   get:
 *     summary: Generate custom reports
 *     description: Generate customized analytical reports based on specified parameters
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: report_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [device_summary, sensor_performance, alert_analysis, energy_consumption, system_health, custom]
 *         description: Type of report to generate
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for report data
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for report data
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, pdf, csv, xlsx]
 *           default: json
 *         description: Report output format
 *       - in: query
 *         name: include_charts
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include charts in the report (for PDF format)
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [device, sensor, type, location, day, week, month]
 *         description: Group report data by field
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *         description: Comma-separated list of specific metrics to include
 *     responses:
 *       200:
 *         description: Generated report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     report_metadata:
 *                       type: object
 *                       properties:
 *                         report_id:
 *                           type: string
 *                           format: uuid
 *                         report_type:
 *                           type: string
 *                         generated_at:
 *                           type: string
 *                           format: date-time
 *                         generated_by:
 *                           type: string
 *                           format: uuid
 *                         time_range:
 *                           type: object
 *                           properties:
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *                         filters_applied:
 *                           type: object
 *                     report_data:
 *                       type: object
 *                       description: Report data structure varies by report type
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_records:
 *                           type: integer
 *                         data_sources:
 *                           type: array
 *                           items:
 *                             type: string
 *                         key_insights:
 *                           type: array
 *                           items:
 *                             type: string
 *           text/csv:
 *             schema:
 *               type: string
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/reports', [
  validateDateRange,
  query('report_type')
    .notEmpty()
    .withMessage('Report type is required')
    .isIn(['device_summary', 'sensor_performance', 'alert_analysis', 'energy_consumption', 'system_health', 'custom'])
    .withMessage('Report type must be one of: device_summary, sensor_performance, alert_analysis, energy_consumption, system_health, custom'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('format')
    .optional()
    .isIn(['json', 'pdf', 'csv', 'xlsx'])
    .withMessage('Format must be one of: json, pdf, csv, xlsx'),
  query('include_charts')
    .optional()
    .isBoolean()
    .withMessage('Include charts must be a boolean'),
  query('group_by')
    .optional()
    .isIn(['device', 'sensor', 'type', 'location', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: device, sensor, type, location, day, week, month'),
  query('metrics')
    .optional()
    .isString()
    .withMessage('Metrics must be a string'),
  validate
], getCustomReport);

module.exports = router;