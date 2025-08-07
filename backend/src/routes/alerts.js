const express = require('express');
const { body, query, param } = require('express-validator');
const {
  getAllAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
  deleteAlert,
  getAlertStats,
  bulkAcknowledge
} = require('../controllers/alertController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, validatePagination, validateUUID } = require('../middleware/validation');

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get all alerts with filtering
 *     description: Retrieve alerts with comprehensive filtering and pagination options
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved, all]
 *           default: all
 *         description: Filter by alert status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by alert severity
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [threshold, anomaly, device_offline, sensor_malfunction, system_error, custom]
 *         description: Filter by alert type
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
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time for alert filtering
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time for alert filtering
 *       - in: query
 *         name: acknowledged_by
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user who acknowledged the alert
 *       - in: query
 *         name: resolved_by
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user who resolved the alert
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in alert title and description
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
 *           default: 20
 *         description: Number of alerts per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, severity, status]
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
 *         description: List of alerts with pagination
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
 *                     alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Alert'
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
 *                     filters:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         severity:
 *                           type: string
 *                         type:
 *                           type: string
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
router.get('/', [
  validatePagination,
  query('status')
    .optional()
    .isIn(['active', 'acknowledged', 'resolved', 'all'])
    .withMessage('Status must be one of: active, acknowledged, resolved, all'),
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be one of: low, medium, high, critical'),
  query('type')
    .optional()
    .isIn(['threshold', 'anomaly', 'device_offline', 'sensor_malfunction', 'system_error', 'custom'])
    .withMessage('Type must be one of: threshold, anomaly, device_offline, sensor_malfunction, system_error, custom'),
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
  query('start_time')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  query('end_time')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  query('acknowledged_by')
    .optional()
    .isUUID()
    .withMessage('Acknowledged by must be a valid UUID'),
  query('resolved_by')
    .optional()
    .isUUID()
    .withMessage('Resolved by must be a valid UUID'),
  query('search')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search must be between 1 and 100 characters'),
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'severity', 'status'])
    .withMessage('Sort must be one of: created_at, updated_at, severity, status'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  validate
], getAllAlerts);

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     summary: Get alert statistics
 *     description: Retrieve comprehensive alert statistics and trends
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Group statistics by time period
 *       - in: query
 *         name: device_ids
 *         schema:
 *           type: string
 *         description: Comma-separated list of device IDs
 *     responses:
 *       200:
 *         description: Alert statistics
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
 *                         total_alerts:
 *                           type: integer
 *                         active_alerts:
 *                           type: integer
 *                         acknowledged_alerts:
 *                           type: integer
 *                         resolved_alerts:
 *                           type: integer
 *                         critical_alerts:
 *                           type: integer
 *                         high_alerts:
 *                           type: integer
 *                         medium_alerts:
 *                           type: integer
 *                         low_alerts:
 *                           type: integer
 *                     by_type:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           percentage:
 *                             type: number
 *                     by_device:
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
 *                           last_alert:
 *                             type: string
 *                             format: date-time
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           period:
 *                             type: string
 *                           total_alerts:
 *                             type: integer
 *                           critical_alerts:
 *                             type: integer
 *                           resolved_alerts:
 *                             type: integer
 *                           avg_resolution_time_minutes:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/stats', [
  query('start_time')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  query('end_time')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  query('group_by')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: hour, day, week, month'),
  query('device_ids')
    .optional()
    .isString()
    .custom((value) => {
      const ids = value.split(',');
      return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim()));
    })
    .withMessage('All device IDs must be valid UUIDs'),
  validate
], getAlertStats);

/**
 * @swagger
 * /api/alerts:
 *   post:
 *     summary: Create a new alert
 *     description: Create a new alert in the system
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - severity
 *               - device_id
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Alert title
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed alert description
 *               type:
 *                 type: string
 *                 enum: [threshold, anomaly, device_offline, sensor_malfunction, system_error, custom]
 *                 description: Type of alert
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 description: Alert severity level
 *               device_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the related device
 *               sensor_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the related sensor (optional)
 *               threshold_config:
 *                 type: object
 *                 description: Threshold configuration for threshold alerts
 *                 properties:
 *                   min_value:
 *                     type: number
 *                   max_value:
 *                     type: number
 *                   operator:
 *                     type: string
 *                     enum: [gt, lt, gte, lte, eq, ne]
 *                   value:
 *                     type: number
 *               metadata:
 *                 type: object
 *                 description: Additional alert metadata
 *               auto_resolve:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the alert should auto-resolve
 *               auto_resolve_timeout_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10080
 *                 description: Auto-resolve timeout in minutes
 *     responses:
 *       201:
 *         description: Alert created successfully
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['threshold', 'anomaly', 'device_offline', 'sensor_malfunction', 'system_error', 'custom'])
    .withMessage('Type must be one of: threshold, anomaly, device_offline, sensor_malfunction, system_error, custom'),
  body('severity')
    .notEmpty()
    .withMessage('Severity is required')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be one of: low, medium, high, critical'),
  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required')
    .isUUID()
    .withMessage('Device ID must be a valid UUID'),
  body('sensor_id')
    .optional()
    .isUUID()
    .withMessage('Sensor ID must be a valid UUID'),
  body('threshold_config')
    .optional()
    .isObject()
    .withMessage('Threshold config must be an object'),
  body('threshold_config.min_value')
    .optional()
    .isNumeric()
    .withMessage('Min value must be a number'),
  body('threshold_config.max_value')
    .optional()
    .isNumeric()
    .withMessage('Max value must be a number'),
  body('threshold_config.operator')
    .optional()
    .isIn(['gt', 'lt', 'gte', 'lte', 'eq', 'ne'])
    .withMessage('Operator must be one of: gt, lt, gte, lte, eq, ne'),
  body('threshold_config.value')
    .optional()
    .isNumeric()
    .withMessage('Value must be a number'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('auto_resolve')
    .optional()
    .isBoolean()
    .withMessage('Auto resolve must be a boolean'),
  body('auto_resolve_timeout_minutes')
    .optional()
    .isInt({ min: 1, max: 10080 })
    .withMessage('Auto resolve timeout must be between 1 and 10080 minutes'),
  validate
], createAlert);

/**
 * @swagger
 * /api/alerts/bulk-acknowledge:
 *   patch:
 *     summary: Bulk acknowledge alerts
 *     description: Acknowledge multiple alerts at once
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alert_ids
 *             properties:
 *               alert_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of alert IDs to acknowledge
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional acknowledgment note
 *     responses:
 *       200:
 *         description: Alerts acknowledged successfully
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
 *                     acknowledged_count:
 *                       type: integer
 *                     failed_count:
 *                       type: integer
 *                     failed_alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           alert_id:
 *                             type: string
 *                             format: uuid
 *                           error:
 *                             type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch('/bulk-acknowledge', [
  body('alert_ids')
    .notEmpty()
    .withMessage('Alert IDs are required')
    .isArray({ min: 1, max: 100 })
    .withMessage('Alert IDs must be an array with 1-100 items'),
  body('alert_ids.*')
    .isUUID()
    .withMessage('Each alert ID must be a valid UUID'),
  body('note')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters'),
  validate
], bulkAcknowledge);

/**
 * @swagger
 * /api/alerts/{id}:
 *   get:
 *     summary: Get alert by ID
 *     description: Retrieve a specific alert by its ID
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id', [
  validateUUID('id'),
  validate
], getAlertById);

/**
 * @swagger
 * /api/alerts/{id}:
 *   patch:
 *     summary: Update alert
 *     description: Update an existing alert (admin or alert creator only)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               threshold_config:
 *                 type: object
 *               metadata:
 *                 type: object
 *               auto_resolve:
 *                 type: boolean
 *               auto_resolve_timeout_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10080
 *     responses:
 *       200:
 *         description: Alert updated successfully
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', [
  validateUUID('id'),
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Severity must be one of: low, medium, high, critical'),
  body('threshold_config')
    .optional()
    .isObject()
    .withMessage('Threshold config must be an object'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  body('auto_resolve')
    .optional()
    .isBoolean()
    .withMessage('Auto resolve must be a boolean'),
  body('auto_resolve_timeout_minutes')
    .optional()
    .isInt({ min: 1, max: 10080 })
    .withMessage('Auto resolve timeout must be between 1 and 10080 minutes'),
  validate
], updateAlert);

/**
 * @swagger
 * /api/alerts/{id}/acknowledge:
 *   patch:
 *     summary: Acknowledge alert
 *     description: Acknowledge a specific alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional acknowledgment note
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/acknowledge', [
  validateUUID('id'),
  body('note')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Note must not exceed 500 characters'),
  validate
], acknowledgeAlert);

/**
 * @swagger
 * /api/alerts/{id}/resolve:
 *   patch:
 *     summary: Resolve alert
 *     description: Mark an alert as resolved
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolution_note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Resolution note explaining how the alert was resolved
 *               root_cause:
 *                 type: string
 *                 maxLength: 500
 *                 description: Root cause of the alert
 *               preventive_actions:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Actions taken to prevent similar alerts
 *     responses:
 *       200:
 *         description: Alert resolved successfully
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
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/resolve', [
  validateUUID('id'),
  body('resolution_note')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Resolution note must not exceed 1000 characters'),
  body('root_cause')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Root cause must not exceed 500 characters'),
  body('preventive_actions')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Preventive actions must not exceed 1000 characters'),
  validate
], resolveAlert);

/**
 * @swagger
 * /api/alerts/{id}:
 *   delete:
 *     summary: Delete alert
 *     description: Delete an alert (admin only)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert deleted successfully
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
], deleteAlert);

module.exports = router;