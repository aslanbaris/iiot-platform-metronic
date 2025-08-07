const express = require('express');
const { query } = require('express-validator');
const {
  getSensorData,
  getRealTimeData,
  getDataStatistics,
  exportData,
  getDataQuality,
  deleteOldData
} = require('../controllers/dataController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateDateRange, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/data:
 *   get:
 *     summary: Get sensor data with advanced filtering
 *     description: Retrieve sensor data with comprehensive filtering and aggregation options
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *         example: '123e4567-e89b-12d3-a456-426614174000,123e4567-e89b-12d3-a456-426614174001'
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *         example: '123e4567-e89b-12d3-a456-426614174000'
 *       - in: query
 *         name: sensor_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor types
 *         example: 'temperature,humidity,pressure'
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for data range
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for data range
 *       - in: query
 *         name: min_value
 *         schema:
 *           type: number
 *         description: Minimum value filter
 *       - in: query
 *         name: max_value
 *         schema:
 *           type: number
 *         description: Maximum value filter
 *       - in: query
 *         name: quality_threshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           default: 0
 *         description: Minimum data quality threshold (0-100)
 *       - in: query
 *         name: aggregation
 *         schema:
 *           type: string
 *           enum: [none, avg, min, max, sum, count, stddev]
 *           default: none
 *         description: Data aggregation method
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d, 1w]
 *         description: Aggregation interval (required if aggregation is not 'none')
 *       - in: query
 *         name: fill_gaps
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Fill data gaps with interpolated values
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1000
 *         description: Number of data points per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [timestamp, value, sensor_id]
 *           default: timestamp
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Sensor data with metadata
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
 *                     data_points:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SensorData'
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         total_points:
 *                           type: integer
 *                         filtered_points:
 *                           type: integer
 *                         sensors_included:
 *                           type: array
 *                           items:
 *                             type: string
 *                         time_range:
 *                           type: object
 *                           properties:
 *                             start_time:
 *                               type: string
 *                               format: date-time
 *                             end_time:
 *                               type: string
 *                               format: date-time
 *                         aggregation:
 *                           type: object
 *                           properties:
 *                             method:
 *                               type: string
 *                             interval:
 *                               type: string
 *                             fill_gaps:
 *                               type: boolean
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', [
  validateDateRange,
  validatePagination,
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_types')
    .optional()
    .isString()
    .custom((value) => {
      const types = value.split(',');
      return types.every(type => type.trim().length > 0 && type.trim().length <= 50);
    })
    .withMessage('All sensor types must be between 1 and 50 characters'),
  query('min_value')
    .optional()
    .isNumeric()
    .withMessage('Minimum value must be a number'),
  query('max_value')
    .optional()
    .isNumeric()
    .withMessage('Maximum value must be a number'),
  query('quality_threshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Quality threshold must be between 0 and 100'),
  query('aggregation')
    .optional()
    .isIn(['none', 'avg', 'min', 'max', 'sum', 'count', 'stddev'])
    .withMessage('Aggregation must be one of: none, avg, min, max, sum, count, stddev'),
  query('interval')
    .optional()
    .isIn(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d', '1w'])
    .withMessage('Interval must be one of: 1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d, 1w'),
  query('fill_gaps')
    .optional()
    .isBoolean()
    .withMessage('Fill gaps must be a boolean'),
  query('sort')
    .optional()
    .isIn(['timestamp', 'value', 'sensor_id'])
    .withMessage('Sort must be one of: timestamp, value, sensor_id'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  validate
], getSensorData);

/**
 * @swagger
 * /api/data/realtime:
 *   get:
 *     summary: Get real-time sensor data
 *     description: Retrieve the latest sensor readings for real-time monitoring
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: sensor_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor types
 *       - in: query
 *         name: max_age_minutes
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1440
 *           default: 5
 *         description: Maximum age of data in minutes
 *       - in: query
 *         name: include_offline
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include sensors that are offline
 *     responses:
 *       200:
 *         description: Real-time sensor data
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
 *                           device_name:
 *                             type: string
 *                           latest_reading:
 *                             $ref: '#/components/schemas/SensorData'
 *                           status:
 *                             type: string
 *                             enum: [online, offline, stale]
 *                           last_seen:
 *                             type: string
 *                             format: date-time
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_sensors:
 *                           type: integer
 *                         online_sensors:
 *                           type: integer
 *                         offline_sensors:
 *                           type: integer
 *                         stale_sensors:
 *                           type: integer
 *                         last_updated:
 *                           type: string
 *                           format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/realtime', [
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_types')
    .optional()
    .isString()
    .custom((value) => {
      const types = value.split(',');
      return types.every(type => type.trim().length > 0 && type.trim().length <= 50);
    })
    .withMessage('All sensor types must be between 1 and 50 characters'),
  query('max_age_minutes')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Max age must be between 1 and 1440 minutes'),
  query('include_offline')
    .optional()
    .isBoolean()
    .withMessage('Include offline must be a boolean'),
  validate
], getRealTimeData);

/**
 * @swagger
 * /api/data/stats:
 *   get:
 *     summary: Get data statistics
 *     description: Retrieve comprehensive statistics about sensor data
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: sensor_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor types
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for statistics calculation
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for statistics calculation
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [sensor, device, type, hour, day, week, month]
 *           default: sensor
 *         description: Group statistics by field
 *     responses:
 *       200:
 *         description: Data statistics
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
 *                     statistics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           group_key:
 *                             type: string
 *                           group_value:
 *                             type: string
 *                           total_readings:
 *                             type: integer
 *                           avg_value:
 *                             type: number
 *                           min_value:
 *                             type: number
 *                           max_value:
 *                             type: number
 *                           std_deviation:
 *                             type: number
 *                           first_reading:
 *                             type: string
 *                             format: date-time
 *                           last_reading:
 *                             type: string
 *                             format: date-time
 *                           data_quality_score:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_groups:
 *                           type: integer
 *                         total_readings:
 *                           type: integer
 *                         overall_avg:
 *                           type: number
 *                         overall_min:
 *                           type: number
 *                         overall_max:
 *                           type: number
 *                         time_range:
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
router.get('/stats', [
  validateDateRange,
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_types')
    .optional()
    .isString()
    .custom((value) => {
      const types = value.split(',');
      return types.every(type => type.trim().length > 0 && type.trim().length <= 50);
    })
    .withMessage('All sensor types must be between 1 and 50 characters'),
  query('group_by')
    .optional()
    .isIn(['sensor', 'device', 'type', 'hour', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: sensor, device, type, hour, day, week, month'),
  validate
], getDataStatistics);

/**
 * @swagger
 * /api/data/export:
 *   get:
 *     summary: Export sensor data
 *     description: Export sensor data in CSV format
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *       - in: query
 *         name: sensor_types
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor types
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for data export
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for data export
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json, xlsx]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: include_metadata
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include sensor and device metadata
 *       - in: query
 *         name: aggregation
 *         schema:
 *           type: string
 *           enum: [none, avg, min, max, sum]
 *           default: none
 *         description: Data aggregation for export
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d]
 *         description: Aggregation interval
 *     responses:
 *       200:
 *         description: Exported data file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/export', [
  validateDateRange,
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('sensor_types')
    .optional()
    .isString()
    .custom((value) => {
      const types = value.split(',');
      return types.every(type => type.trim().length > 0 && type.trim().length <= 50);
    })
    .withMessage('All sensor types must be between 1 and 50 characters'),
  query('format')
    .optional()
    .isIn(['csv', 'json', 'xlsx'])
    .withMessage('Format must be one of: csv, json, xlsx'),
  query('include_metadata')
    .optional()
    .isBoolean()
    .withMessage('Include metadata must be a boolean'),
  query('aggregation')
    .optional()
    .isIn(['none', 'avg', 'min', 'max', 'sum'])
    .withMessage('Aggregation must be one of: none, avg, min, max, sum'),
  query('interval')
    .optional()
    .isIn(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'])
    .withMessage('Interval must be one of: 1m, 5m, 15m, 30m, 1h, 6h, 12h, 1d'),
  validate
], exportData);

/**
 * @swagger
 * /api/data/quality:
 *   get:
 *     summary: Get data quality metrics
 *     description: Retrieve data quality metrics and anomaly detection results
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs
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
 *         description: Start time for quality analysis
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for quality analysis
 *       - in: query
 *         name: include_anomalies
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include anomaly detection results
 *     responses:
 *       200:
 *         description: Data quality metrics
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
 *                     quality_metrics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sensor_id:
 *                             type: string
 *                             format: uuid
 *                           sensor_name:
 *                             type: string
 *                           completeness_score:
 *                             type: number
 *                           accuracy_score:
 *                             type: number
 *                           consistency_score:
 *                             type: number
 *                           timeliness_score:
 *                             type: number
 *                           overall_quality_score:
 *                             type: number
 *                           total_readings:
 *                             type: integer
 *                           missing_readings:
 *                             type: integer
 *                           duplicate_readings:
 *                             type: integer
 *                           out_of_range_readings:
 *                             type: integer
 *                           anomalous_readings:
 *                             type: integer
 *                     anomalies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           sensor_id:
 *                             type: string
 *                             format: uuid
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           value:
 *                             type: number
 *                           anomaly_type:
 *                             type: string
 *                             enum: [outlier, spike, drift, gap]
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high]
 *                           confidence:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         overall_quality_score:
 *                           type: number
 *                         total_sensors_analyzed:
 *                           type: integer
 *                         total_anomalies_detected:
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
router.get('/quality', [
  validateDateRange,
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  query('include_anomalies')
    .optional()
    .isBoolean()
    .withMessage('Include anomalies must be a boolean'),
  validate
], getDataQuality);

/**
 * @swagger
 * /api/data/cleanup:
 *   delete:
 *     summary: Delete old data
 *     description: Delete old sensor data based on retention policies (admin only)
 *     tags: [Data]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: older_than_days
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Delete data older than specified days
 *       - in: query
 *         name: sensor_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of sensor IDs (optional, deletes from all sensors if not specified)
 *       - in: query
 *         name: dry_run
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Perform a dry run without actually deleting data
 *     responses:
 *       200:
 *         description: Data cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_records:
 *                       type: integer
 *                     affected_sensors:
 *                       type: array
 *                       items:
 *                         type: string
 *                     cutoff_date:
 *                       type: string
 *                       format: date-time
 *                     dry_run:
 *                       type: boolean
 *                     execution_time_ms:
 *                       type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/cleanup', [
  restrictTo('admin'),
  query('older_than_days')
    .notEmpty()
    .withMessage('Older than days is required')
    .isInt({ min: 1 })
    .withMessage('Older than days must be a positive integer'),
  query('sensor_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All sensor IDs must be valid UUIDs'),
  query('dry_run')
    .optional()
    .isBoolean()
    .withMessage('Dry run must be a boolean'),
  validate
], deleteOldData);

module.exports = router;