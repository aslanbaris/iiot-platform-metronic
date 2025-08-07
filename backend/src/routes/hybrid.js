const express = require('express');
const router = express.Router();
const influxService = require('../services/influxService');
const mongoService = require('../services/mongoService');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, query, param } = require('express-validator');

/**
 * @swagger
 * /api/hybrid/health:
 *   get:
 *     summary: Check hybrid database health
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 influxdb:
 *                   type: object
 *                 mongodb:
 *                   type: object
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const [influxHealth, mongoHealth] = await Promise.all([
      influxService.healthCheck(),
      mongoService.healthCheck()
    ]);

    res.json({
      success: true,
      influxdb: influxHealth,
      mongodb: mongoHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Hybrid health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/hybrid/sensor-data:
 *   post:
 *     summary: Store sensor data in InfluxDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - sensorType
 *               - value
 *             properties:
 *               deviceId:
 *                 type: string
 *               sensorType:
 *                 type: string
 *               value:
 *                 type: number
 *               unit:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sensor data stored successfully
 */
router.post('/sensor-data', 
  authenticateToken,
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('sensorType').notEmpty().withMessage('Sensor type is required'),
    body('value').isNumeric().withMessage('Value must be numeric'),
    body('unit').optional().isString(),
    body('location').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { deviceId, sensorType, value, unit, location } = req.body;
      
      const result = await influxService.writeSensorData({
        deviceId,
        sensorType,
        value,
        unit,
        location
      });

      logger.info(`Sensor data stored for device ${deviceId}`);
      
      res.status(201).json({
        success: true,
        message: 'Sensor data stored successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error storing sensor data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to store sensor data',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/hybrid/sensor-data/{deviceId}:
 *   get:
 *     summary: Get sensor data from InfluxDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: stop
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sensorType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sensor data retrieved successfully
 */
router.get('/sensor-data/:deviceId',
  authenticateToken,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    query('start').optional().isISO8601().withMessage('Start must be valid ISO8601 date'),
    query('stop').optional().isISO8601().withMessage('Stop must be valid ISO8601 date'),
    query('sensorType').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { start, stop, sensorType } = req.query;
      
      const data = await influxService.getSensorData({
        deviceId,
        start,
        stop,
        sensorType
      });

      res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error) {
      logger.error('Error retrieving sensor data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sensor data',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/hybrid/assets:
 *   post:
 *     summary: Create or update asset metadata in MongoDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assetId
 *               - name
 *               - type
 *             properties:
 *               assetId:
 *                 type: string
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               status:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Asset created/updated successfully
 */
router.post('/assets',
  authenticateToken,
  [
    body('assetId').notEmpty().withMessage('Asset ID is required'),
    body('name').notEmpty().withMessage('Asset name is required'),
    body('type').notEmpty().withMessage('Asset type is required'),
    body('description').optional().isString(),
    body('location').optional().isString(),
    body('status').optional().isString(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const assetData = req.body;
      
      const result = await mongoService.upsertAsset(assetData);

      logger.info(`Asset ${assetData.assetId} upserted`);
      
      res.status(201).json({
        success: true,
        message: 'Asset created/updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error upserting asset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create/update asset',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/hybrid/assets/{assetId}:
 *   get:
 *     summary: Get asset metadata from MongoDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Asset retrieved successfully
 *       404:
 *         description: Asset not found
 */
router.get('/assets/:assetId',
  authenticateToken,
  [
    param('assetId').notEmpty().withMessage('Asset ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { assetId } = req.params;
      
      const asset = await mongoService.getAsset(assetId);
      
      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found'
        });
      }

      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error retrieving asset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve asset',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/hybrid/assets:
 *   get:
 *     summary: Get all assets from MongoDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Assets retrieved successfully
 */
router.get('/assets',
  authenticateToken,
  [
    query('type').optional().isString(),
    query('status').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { type, status, limit = 50, skip = 0 } = req.query;
      
      const filter = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      
      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        sort: { updatedAt: -1 }
      };
      
      const assets = await mongoService.getAssets(filter, options);

      res.json({
        success: true,
        data: assets,
        count: assets.length,
        filter,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      });
    } catch (error) {
      logger.error('Error retrieving assets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve assets',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/hybrid/analytics/aggregated:
 *   get:
 *     summary: Get aggregated sensor data from InfluxDB
 *     tags: [Hybrid Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sensorType
 *         schema:
 *           type: string
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: stop
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: window
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 1d]
 *       - in: query
 *         name: aggregation
 *         schema:
 *           type: string
 *           enum: [mean, max, min, sum, count]
 *     responses:
 *       200:
 *         description: Aggregated data retrieved successfully
 */
router.get('/analytics/aggregated',
  authenticateToken,
  [
    query('deviceId').optional().isString(),
    query('sensorType').optional().isString(),
    query('start').optional().isISO8601(),
    query('stop').optional().isISO8601(),
    query('window').optional().isIn(['1m', '5m', '15m', '1h', '1d']),
    query('aggregation').optional().isIn(['mean', 'max', 'min', 'sum', 'count'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        deviceId,
        sensorType,
        start,
        stop,
        window = '1h',
        aggregation = 'mean'
      } = req.query;
      
      const data = await influxService.getAggregatedSensorData({
        deviceId,
        sensorType,
        start,
        stop,
        window,
        aggregation
      });

      res.json({
        success: true,
        data,
        count: data.length,
        parameters: {
          deviceId,
          sensorType,
          start,
          stop,
          window,
          aggregation
        }
      });
    } catch (error) {
      logger.error('Error retrieving aggregated data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve aggregated data',
        details: error.message
      });
    }
  }
);

module.exports = router;