const express = require('express');
const { body, query } = require('express-validator');
const {
  getSystemHealth,
  getSystemInfo,
  getApplicationMetrics,
  getAuditLogs,
  getSystemConfig,
  updateSystemConfig,
  backupDatabase,
  clearCache
} = require('../controllers/systemController');
const { protect, restrictTo } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get system health status
 *     description: Returns comprehensive health check of all system components
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System health status
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
 *                     overall_status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     checks:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: boolean
 *                         redis:
 *                           type: boolean
 *                         mqtt:
 *                           type: boolean
 *                         disk_space:
 *                           type: boolean
 *                         memory:
 *                           type: boolean
 *                         cpu:
 *                           type: boolean
 *                     details:
 *                       type: object
 *                     uptime_seconds:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/health', getSystemHealth);

/**
 * @swagger
 * /api/system/info:
 *   get:
 *     summary: Get system information
 *     description: Returns detailed system information including server, memory, CPU, and database stats
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System information
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
 *                     server:
 *                       type: object
 *                     memory:
 *                       type: object
 *                     cpu:
 *                       type: object
 *                     network:
 *                       type: object
 *                     database:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/info', protect, getSystemInfo);

/**
 * @swagger
 * /api/system/metrics:
 *   get:
 *     summary: Get application metrics
 *     description: Returns application-specific metrics including data volume, device status, alerts, and user activity
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           default: '24h'
 *           enum: ['1h', '6h', '24h', '7d', '30d']
 *         description: Time range for metrics calculation
 *     responses:
 *       200:
 *         description: Application metrics
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
 *                     time_range:
 *                       type: string
 *                     data_metrics:
 *                       type: object
 *                     device_metrics:
 *                       type: object
 *                     alert_metrics:
 *                       type: object
 *                     user_metrics:
 *                       type: object
 *                     audit_metrics:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/metrics', [
  protect,
  query('time_range')
    .optional()
    .isIn(['1h', '6h', '24h', '7d', '30d'])
    .withMessage('Time range must be one of: 1h, 6h, 24h, 7d, 30d'),
  validate
], getApplicationMetrics);

/**
 * @swagger
 * /api/system/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     description: Returns paginated audit logs with optional filtering
 *     tags: [System]
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
 *           default: 50
 *         description: Number of items per page
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: start_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this timestamp
 *       - in: query
 *         name: end_time
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this timestamp
 *     responses:
 *       200:
 *         description: Audit logs
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
 *                     audit_logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           user_id:
 *                             type: string
 *                             format: uuid
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                           action:
 *                             type: string
 *                           resource_type:
 *                             type: string
 *                           resource_id:
 *                             type: string
 *                           details:
 *                             type: object
 *                           timestamp:
 *                             type: string
 *                             format: date-time
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/audit-logs', [
  protect,
  restrictTo('admin', 'manager'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  query('start_time')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  query('end_time')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  validate
], getAuditLogs);

/**
 * @swagger
 * /api/system/config:
 *   get:
 *     summary: Get system configuration
 *     description: Returns current system configuration (admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System configuration
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
 *                     application:
 *                       type: object
 *                     database:
 *                       type: object
 *                     redis:
 *                       type: object
 *                     mqtt:
 *                       type: object
 *                     security:
 *                       type: object
 *                     features:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/config', [
  protect,
  restrictTo('admin')
], getSystemConfig);

/**
 * @swagger
 * /api/system/config:
 *   put:
 *     summary: Update system configuration
 *     description: Updates a specific system configuration value (admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config_key
 *               - config_value
 *             properties:
 *               config_key:
 *                 type: string
 *                 description: Configuration key to update
 *                 example: 'rate_limit_max'
 *               config_value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *                   - type: object
 *                 description: New configuration value
 *                 example: 200
 *     responses:
 *       200:
 *         description: Configuration updated successfully
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
 *                     config_key:
 *                       type: string
 *                     config_value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                         - type: boolean
 *                         - type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/config', [
  protect,
  restrictTo('admin'),
  body('config_key')
    .notEmpty()
    .withMessage('Config key is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Config key must be between 1 and 100 characters'),
  body('config_value')
    .exists()
    .withMessage('Config value is required'),
  validate
], updateSystemConfig);

/**
 * @swagger
 * /api/system/backup:
 *   post:
 *     summary: Initiate database backup
 *     description: Initiates a database backup process (admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               backup_type:
 *                 type: string
 *                 enum: [full, schema_only, data_only]
 *                 default: full
 *                 description: Type of backup to perform
 *               include_data:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to include data in backup
 *     responses:
 *       202:
 *         description: Backup initiated successfully
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
 *                     backup_id:
 *                       type: string
 *                     backup_type:
 *                       type: string
 *                     include_data:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                     estimated_completion:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/backup', [
  protect,
  restrictTo('admin'),
  body('backup_type')
    .optional()
    .isIn(['full', 'schema_only', 'data_only'])
    .withMessage('Backup type must be one of: full, schema_only, data_only'),
  body('include_data')
    .optional()
    .isBoolean()
    .withMessage('Include data must be a boolean'),
  validate
], backupDatabase);

/**
 * @swagger
 * /api/system/cache/clear:
 *   post:
 *     summary: Clear system cache
 *     description: Clears Redis cache based on pattern (admin only)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cache_pattern:
 *                 type: string
 *                 default: '*'
 *                 description: Redis key pattern to clear (use * for all)
 *                 example: 'sensor:*'
 *     responses:
 *       200:
 *         description: Cache cleared successfully
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
 *                     pattern:
 *                       type: string
 *                     cleared_keys:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/cache/clear', [
  protect,
  restrictTo('admin'),
  body('cache_pattern')
    .optional()
    .isString()
    .withMessage('Cache pattern must be a string'),
  validate
], clearCache);

module.exports = router;