const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceSensors,
  getDeviceStats,
  sendCommand
} = require('../controllers/deviceController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validateUUID, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Get all devices
 *     description: Retrieve a paginated list of all devices with optional filtering
 *     tags: [Devices]
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
 *         description: Number of devices per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, offline, error, maintenance]
 *         description: Filter by device status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by device type
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by device location
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in device name and description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, created_at, updated_at, status]
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
 *         description: List of devices
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
 *                         $ref: '#/components/schemas/Device'
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
  query('status')
    .optional()
    .isIn(['online', 'offline', 'error', 'maintenance'])
    .withMessage('Status must be one of: online, offline, error, maintenance'),
  query('type')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Type must be between 1 and 50 characters'),
  query('location')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sort')
    .optional()
    .isIn(['name', 'created_at', 'updated_at', 'status'])
    .withMessage('Sort must be one of: name, created_at, updated_at, status'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  validate
], getAllDevices);

/**
 * @swagger
 * /api/devices/{id}:
 *   get:
 *     summary: Get device by ID
 *     description: Retrieve a specific device by its ID
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *     responses:
 *       200:
 *         description: Device details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Device'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id', [
  validateUUID('id'),
  validate
], getDeviceById);

/**
 * @swagger
 * /api/devices:
 *   post:
 *     summary: Create a new device
 *     description: Create a new device in the system
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Device name
 *                 example: 'Temperature Sensor 01'
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Device description
 *                 example: 'Main hall temperature monitoring sensor'
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: Device type
 *                 example: 'temperature_sensor'
 *               manufacturer:
 *                 type: string
 *                 maxLength: 100
 *                 description: Device manufacturer
 *                 example: 'Siemens'
 *               model:
 *                 type: string
 *                 maxLength: 100
 *                 description: Device model
 *                 example: 'QAE2121.010'
 *               serial_number:
 *                 type: string
 *                 maxLength: 100
 *                 description: Device serial number
 *                 example: 'SN123456789'
 *               firmware_version:
 *                 type: string
 *                 maxLength: 50
 *                 description: Device firmware version
 *                 example: '1.2.3'
 *               location:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Device location
 *                 example: 'Building A - Floor 1 - Room 101'
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                 description: Device GPS coordinates
 *               configuration:
 *                 type: object
 *                 description: Device-specific configuration
 *               metadata:
 *                 type: object
 *                 description: Additional device metadata
 *     responses:
 *       201:
 *         description: Device created successfully
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
 *                   $ref: '#/components/schemas/Device'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', [
  restrictTo('admin', 'manager'),
  body('name')
    .notEmpty()
    .withMessage('Device name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),
  body('type')
    .notEmpty()
    .withMessage('Device type is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Device type must be between 1 and 50 characters')
    .trim(),
  body('manufacturer')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Manufacturer must not exceed 100 characters')
    .trim(),
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must not exceed 100 characters')
    .trim(),
  body('serial_number')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Serial number must not exceed 100 characters')
    .trim(),
  body('firmware_version')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Firmware version must not exceed 50 characters')
    .trim(),
  body('location')
    .notEmpty()
    .withMessage('Device location is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters')
    .trim(),
  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  validate
], createDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   put:
 *     summary: Update device
 *     description: Update an existing device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
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
 *               manufacturer:
 *                 type: string
 *                 maxLength: 100
 *               model:
 *                 type: string
 *                 maxLength: 100
 *               serial_number:
 *                 type: string
 *                 maxLength: 100
 *               firmware_version:
 *                 type: string
 *                 maxLength: 50
 *               location:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               status:
 *                 type: string
 *                 enum: [online, offline, error, maintenance]
 *               coordinates:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *               configuration:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Device updated successfully
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
 *                   $ref: '#/components/schemas/Device'
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
    .withMessage('Device name must be between 1 and 100 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
    .trim(),
  body('type')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Device type must be between 1 and 50 characters')
    .trim(),
  body('manufacturer')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Manufacturer must not exceed 100 characters')
    .trim(),
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must not exceed 100 characters')
    .trim(),
  body('serial_number')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Serial number must not exceed 100 characters')
    .trim(),
  body('firmware_version')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Firmware version must not exceed 50 characters')
    .trim(),
  body('location')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters')
    .trim(),
  body('status')
    .optional()
    .isIn(['online', 'offline', 'error', 'maintenance'])
    .withMessage('Status must be one of: online, offline, error, maintenance'),
  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  validate
], updateDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   delete:
 *     summary: Delete device
 *     description: Delete a device from the system
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *     responses:
 *       200:
 *         description: Device deleted successfully
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
], deleteDevice);

/**
 * @swagger
 * /api/devices/{id}/sensors:
 *   get:
 *     summary: Get device sensors
 *     description: Retrieve all sensors associated with a specific device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *     responses:
 *       200:
 *         description: Device sensors
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
 *                     device_id:
 *                       type: string
 *                       format: uuid
 *                     sensors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Sensor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id/sensors', [
  validateUUID('id'),
  validate
], getDeviceSensors);

/**
 * @swagger
 * /api/devices/{id}/stats:
 *   get:
 *     summary: Get device statistics
 *     description: Retrieve statistics for a specific device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for statistics
 *     responses:
 *       200:
 *         description: Device statistics
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
 *                     device_id:
 *                       type: string
 *                       format: uuid
 *                     time_range:
 *                       type: string
 *                     uptime_percentage:
 *                       type: number
 *                     total_data_points:
 *                       type: integer
 *                     avg_data_interval_seconds:
 *                       type: number
 *                     sensor_count:
 *                       type: integer
 *                     active_alerts:
 *                       type: integer
 *                     last_communication:
 *                       type: string
 *                       format: date-time
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
], getDeviceStats);

/**
 * @swagger
 * /api/devices/{id}/command:
 *   post:
 *     summary: Send command to device
 *     description: Send a command to a specific device via MQTT
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Command to send
 *                 example: 'restart'
 *               parameters:
 *                 type: object
 *                 description: Command parameters
 *                 example: { "delay": 5 }
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *                 description: Command priority
 *     responses:
 *       200:
 *         description: Command sent successfully
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
 *                     command_id:
 *                       type: string
 *                       format: uuid
 *                     device_id:
 *                       type: string
 *                       format: uuid
 *                     command:
 *                       type: string
 *                     parameters:
 *                       type: object
 *                     priority:
 *                       type: string
 *                     status:
 *                       type: string
 *                     sent_at:
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
router.post('/:id/command', [
  restrictTo('admin', 'manager', 'operator'),
  validateUUID('id'),
  body('command')
    .notEmpty()
    .withMessage('Command is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Command must be between 1 and 100 characters')
    .trim(),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('Parameters must be an object'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, normal, high, urgent'),
  validate
], sendCommand);

module.exports = router;