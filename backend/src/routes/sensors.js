const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getAllSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorData,
  getSensorStats,
  calibrateSensor
} = require('../controllers/sensorController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateUUID, validatePagination, validateDateRange } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/sensors:
 *   get:
 *     summary: Get all sensors
 *     description: Retrieve a paginated list of all sensors with optional filtering
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 100
 *           default: 10
 *         description: Number of sensors per page
 *       - in: query
 *         name: device_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by device ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by sensor type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, error, calibrating]
 *         description: Filter by sensor status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in sensor name and description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, type, created_at, updated_at, last_reading]
 *           default: created_at
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
 *         description: List of sensors
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
 *                         $ref: '#/components/schemas/Sensor'
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', [
  validatePagination,
  query('device_id')
    .optional()
    .isUUID()
    .withMessage('Device ID must be a valid UUID'),
  query('type')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Type must be between 1 and 50 characters'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'error', 'calibrating'])
    .withMessage('Status must be one of: active, inactive, error, calibrating'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sort')
    .optional()
    .isIn(['name', 'type', 'created_at', 'updated_at', 'last_reading'])
    .withMessage('Sort must be one of: name, type, created_at, updated_at, last_reading'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  validate
], getAllSensors);

/**
 * @swagger
 * /api/sensors/{id}:
 *   get:
 *     summary: Get sensor by ID
 *     description: Retrieve a specific sensor by its ID
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
 *     responses:
 *       200:
 *         description: Sensor details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Sensor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id', [
  validateUUID('id'),
  validate
], getSensorById);

/**
 * @swagger
 * /api/sensors:
 *   post:
 *     summary: Create a new sensor
 *     description: Create a new sensor in the system
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *               - name
 *               - type
 *               - unit
 *             properties:
 *               device_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the device this sensor belongs to
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Sensor name
 *                 example: 'Temperature Sensor'
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Sensor description
 *                 example: 'Measures ambient temperature'
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Sensor type
 *                 example: 'temperature'
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 20
 *                 description: Measurement unit
 *                 example: '°C'
 *               min_value:
 *                 type: number
 *                 description: Minimum expected value
 *                 example: -40
 *               max_value:
 *                 type: number
 *                 description: Maximum expected value
 *                 example: 85
 *               accuracy:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Sensor accuracy percentage
 *                 example: 99.5
 *               resolution:
 *                 type: number
 *                 minimum: 0
 *                 description: Sensor resolution
 *                 example: 0.1
 *               sampling_rate:
 *                 type: integer
 *                 minimum: 1
 *                 description: Sampling rate in seconds
 *                 example: 60
 *               calibration_date:
 *                 type: string
 *                 format: date-time
 *                 description: Last calibration date
 *               calibration_interval:
 *                 type: integer
 *                 minimum: 1
 *                 description: Calibration interval in days
 *                 example: 365
 *               configuration:
 *                 type: object
 *                 description: Sensor-specific configuration
 *               metadata:
 *                 type: object
 *                 description: Additional sensor metadata
 *     responses:
 *       201:
 *         description: Sensor created successfully
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
 *                   $ref: '#/components/schemas/Sensor'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', [
  restrictTo('admin', 'manager'),
  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required')
    .isUUID()
    .withMessage('Device ID must be a valid UUID'),
  body('name')
    .notEmpty()
    .withMessage('Sensor name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Sensor name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),
  body('type')
    .notEmpty()
    .withMessage('Sensor type is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Sensor type must be between 1 and 50 characters')
    .trim(),
  body('unit')
    .notEmpty()
    .withMessage('Unit is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('Unit must be between 1 and 20 characters')
    .trim(),
  body('min_value')
    .optional()
    .isNumeric()
    .withMessage('Minimum value must be a number'),
  body('max_value')
    .optional()
    .isNumeric()
    .withMessage('Maximum value must be a number'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Accuracy must be between 0 and 100'),
  body('resolution')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Resolution must be a positive number'),
  body('sampling_rate')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sampling rate must be a positive integer'),
  body('calibration_date')
    .optional()
    .isISO8601()
    .withMessage('Calibration date must be a valid ISO 8601 date'),
  body('calibration_interval')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Calibration interval must be a positive integer'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  validate
], createSensor);

/**
 * @swagger
 * /api/sensors/{id}:
 *   put:
 *     summary: Update sensor
 *     description: Update an existing sensor
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               unit:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 20
 *               min_value:
 *                 type: number
 *               max_value:
 *                 type: number
 *               accuracy:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               resolution:
 *                 type: number
 *                 minimum: 0
 *               sampling_rate:
 *                 type: integer
 *                 minimum: 1
 *               status:
 *                 type: string
 *                 enum: [active, inactive, error, calibrating]
 *               calibration_date:
 *                 type: string
 *                 format: date-time
 *               calibration_interval:
 *                 type: integer
 *                 minimum: 1
 *               configuration:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Sensor updated successfully
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
 *                   $ref: '#/components/schemas/Sensor'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', [
  restrictTo('admin', 'manager'),
  validateUUID('id'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Sensor name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),
  body('type')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Sensor type must be between 1 and 50 characters')
    .trim(),
  body('unit')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Unit must be between 1 and 20 characters')
    .trim(),
  body('min_value')
    .optional()
    .isNumeric()
    .withMessage('Minimum value must be a number'),
  body('max_value')
    .optional()
    .isNumeric()
    .withMessage('Maximum value must be a number'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Accuracy must be between 0 and 100'),
  body('resolution')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Resolution must be a positive number'),
  body('sampling_rate')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sampling rate must be a positive integer'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'error', 'calibrating'])
    .withMessage('Status must be one of: active, inactive, error, calibrating'),
  body('calibration_date')
    .optional()
    .isISO8601()
    .withMessage('Calibration date must be a valid ISO 8601 date'),
  body('calibration_interval')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Calibration interval must be a positive integer'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  validate
], updateSensor);

/**
 * @swagger
 * /api/sensors/{id}:
 *   delete:
 *     summary: Delete sensor
 *     description: Delete a sensor from the system
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
 *     responses:
 *       200:
 *         description: Sensor deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', [
  restrictTo('admin'),
  validateUUID('id'),
  validate
], deleteSensor);

/**
 * @swagger
 * /api/sensors/{id}/data:
 *   get:
 *     summary: Get sensor data
 *     description: Retrieve data readings from a specific sensor
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
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
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1000
 *         description: Maximum number of data points
 *       - in: query
 *         name: aggregation
 *         schema:
 *           type: string
 *           enum: [none, avg, min, max, sum, count]
 *           default: none
 *         description: Data aggregation method
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 6h, 1d]
 *         description: Aggregation interval (required if aggregation is not 'none')
 *     responses:
 *       200:
 *         description: Sensor data
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
 *                     sensor_id:
 *                       type: string
 *                       format: uuid
 *                     data_points:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SensorData'
 *                     total_points:
 *                       type: integer
 *                     aggregation:
 *                       type: string
 *                     interval:
 *                       type: string
 *                     time_range:
 *                       type: object
 *                       properties:
 *                         start_time:
 *                           type: string
 *                           format: date-time
 *                         end_time:
 *                           type: string
 *                           format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id/data', [
  validateUUID('id'),
  validateDateRange,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Limit must be between 1 and 10000'),
  query('aggregation')
    .optional()
    .isIn(['none', 'avg', 'min', 'max', 'sum', 'count'])
    .withMessage('Aggregation must be one of: none, avg, min, max, sum, count'),
  query('interval')
    .optional()
    .isIn(['1m', '5m', '15m', '1h', '6h', '1d'])
    .withMessage('Interval must be one of: 1m, 5m, 15m, 1h, 6h, 1d'),
  validate
], getSensorData);

/**
 * @swagger
 * /api/sensors/{id}/stats:
 *   get:
 *     summary: Get sensor statistics
 *     description: Retrieve statistics for a specific sensor
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for statistics
 *     responses:
 *       200:
 *         description: Sensor statistics
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
 *                     sensor_id:
 *                       type: string
 *                       format: uuid
 *                     time_range:
 *                       type: string
 *                     total_readings:
 *                       type: integer
 *                     avg_value:
 *                       type: number
 *                     min_value:
 *                       type: number
 *                     max_value:
 *                       type: number
 *                     std_deviation:
 *                       type: number
 *                     data_quality_score:
 *                       type: number
 *                     last_reading:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                     calibration_status:
 *                       type: object
 *                       properties:
 *                         last_calibration:
 *                           type: string
 *                           format: date-time
 *                         next_calibration:
 *                           type: string
 *                           format: date-time
 *                         is_due:
 *                           type: boolean
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id/stats', [
  validateUUID('id'),
  query('time_range')
    .optional()
    .isIn(['1h', '6h', '24h', '7d', '30d'])
    .withMessage('Time range must be one of: 1h, 6h, 24h, 7d, 30d'),
  validate
], getSensorStats);

/**
 * @swagger
 * /api/sensors/{id}/calibrate:
 *   post:
 *     summary: Calibrate sensor
 *     description: Initiate sensor calibration process
 *     tags: [Sensors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sensor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - calibration_type
 *             properties:
 *               calibration_type:
 *                 type: string
 *                 enum: [zero_point, span, full_range, factory_reset]
 *                 description: Type of calibration to perform
 *                 example: 'zero_point'
 *               reference_value:
 *                 type: number
 *                 description: Reference value for calibration
 *                 example: 0
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Calibration notes
 *                 example: 'Monthly calibration check'
 *               performed_by:
 *                 type: string
 *                 maxLength: 100
 *                 description: Person performing calibration
 *                 example: 'John Doe'
 *     responses:
 *       200:
 *         description: Calibration initiated successfully
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
 *                     calibration_id:
 *                       type: string
 *                       format: uuid
 *                     sensor_id:
 *                       type: string
 *                       format: uuid
 *                     calibration_type:
 *                       type: string
 *                     reference_value:
 *                       type: number
 *                     status:
 *                       type: string
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *                     estimated_completion:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/calibrate', [
  restrictTo('admin', 'manager', 'technician'),
  validateUUID('id'),
  body('calibration_type')
    .notEmpty()
    .withMessage('Calibration type is required')
    .isIn(['zero_point', 'span', 'full_range', 'factory_reset'])
    .withMessage('Calibration type must be one of: zero_point, span, full_range, factory_reset'),
  body('reference_value')
    .optional()
    .isNumeric()
    .withMessage('Reference value must be a number'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters')
    .trim(),
  body('performed_by')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Performed by must not exceed 100 characters')
    .trim(),
  validate
], calibrateSensor);

module.exports = router;