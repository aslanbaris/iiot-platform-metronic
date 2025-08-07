const express = require('express');
const axios = require('axios');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// BaSyx service URLs
const BASYX_CONFIG = {
  aasEnvironment: process.env.BASYX_AAS_URL || 'http://localhost:8081',
  aasRegistry: process.env.BASYX_AAS_REGISTRY || 'http://localhost:8082',
  submodelRegistry: process.env.BASYX_SM_REGISTRY || 'http://localhost:8083',
  discovery: process.env.BASYX_DISCOVERY || 'http://localhost:8084'
};

// Middleware to add BaSyx headers
const addBaSyxHeaders = (req, res, next) => {
  req.basyxHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  next();
};

// Apply authentication and BaSyx headers to all routes
router.use(authenticateToken);
router.use(addBaSyxHeaders);

/**
 * @swagger
 * /api/basyx/health:
 *   get:
 *     summary: Check BaSyx services health
 *     tags: [BaSyx]
 *     responses:
 *       200:
 *         description: Health status of all BaSyx services
 */
router.get('/health', async (req, res) => {
  try {
    const healthChecks = await Promise.allSettled([
      axios.get(`${BASYX_CONFIG.aasEnvironment}/actuator/health`, { timeout: 3000 }),
      axios.get(`${BASYX_CONFIG.aasRegistry}/actuator/health`, { timeout: 3000 }),
      axios.get(`${BASYX_CONFIG.submodelRegistry}/actuator/health`, { timeout: 3000 }),
      axios.get(`${BASYX_CONFIG.discovery}/actuator/health`, { timeout: 3000 })
    ]);

    const services = ['aasEnvironment', 'aasRegistry', 'submodelRegistry', 'discovery'];
    const healthStatus = {};

    healthChecks.forEach((result, index) => {
      healthStatus[services[index]] = {
        status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: result.status === 'fulfilled' ? result.value.data : result.reason.message
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: healthStatus
    });
  } catch (error) {
    logger.error('BaSyx health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/aas:
 *   get:
 *     summary: Get all Asset Administration Shells
 *     tags: [BaSyx]
 *     responses:
 *       200:
 *         description: List of AAS
 */
router.get('/aas', async (req, res) => {
  try {
    const response = await axios.get(
      `${BASYX_CONFIG.aasEnvironment}/shells`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    logger.info(`Fetched ${response.data.result?.length || 0} AAS from BaSyx`);
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch AAS list:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch AAS list',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/aas/{aasId}:
 *   get:
 *     summary: Get specific AAS by ID
 *     tags: [BaSyx]
 *     parameters:
 *       - in: path
 *         name: aasId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AAS details
 */
router.get('/aas/:aasId', async (req, res) => {
  try {
    const { aasId } = req.params;
    const encodedAasId = encodeURIComponent(aasId);
    
    const response = await axios.get(
      `${BASYX_CONFIG.aasEnvironment}/shells/${encodedAasId}`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to fetch AAS ${req.params.aasId}:`, error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: `Failed to fetch AAS ${req.params.aasId}`,
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/aas/{aasId}/submodels:
 *   get:
 *     summary: Get submodels for specific AAS
 *     tags: [BaSyx]
 *     parameters:
 *       - in: path
 *         name: aasId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of submodels
 */
router.get('/aas/:aasId/submodels', async (req, res) => {
  try {
    const { aasId } = req.params;
    const encodedAasId = encodeURIComponent(aasId);
    
    const response = await axios.get(
      `${BASYX_CONFIG.aasEnvironment}/shells/${encodedAasId}/submodels`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to fetch submodels for AAS ${req.params.aasId}:`, error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: `Failed to fetch submodels for AAS ${req.params.aasId}`,
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/submodels/{submodelId}:
 *   get:
 *     summary: Get specific submodel by ID
 *     tags: [BaSyx]
 *     parameters:
 *       - in: path
 *         name: submodelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submodel details
 */
router.get('/submodels/:submodelId', async (req, res) => {
  try {
    const { submodelId } = req.params;
    const encodedSubmodelId = encodeURIComponent(submodelId);
    
    const response = await axios.get(
      `${BASYX_CONFIG.aasEnvironment}/submodels/${encodedSubmodelId}`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to fetch submodel ${req.params.submodelId}:`, error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: `Failed to fetch submodel ${req.params.submodelId}`,
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/registry/aas:
 *   get:
 *     summary: Get AAS registry entries
 *     tags: [BaSyx]
 *     responses:
 *       200:
 *         description: AAS registry entries
 */
router.get('/registry/aas', async (req, res) => {
  try {
    const response = await axios.get(
      `${BASYX_CONFIG.aasRegistry}/shell-descriptors`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch AAS registry:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch AAS registry',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/registry/submodels:
 *   get:
 *     summary: Get submodel registry entries
 *     tags: [BaSyx]
 *     responses:
 *       200:
 *         description: Submodel registry entries
 */
router.get('/registry/submodels', async (req, res) => {
  try {
    const response = await axios.get(
      `${BASYX_CONFIG.submodelRegistry}/submodel-descriptors`,
      { 
        headers: req.basyxHeaders,
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch submodel registry:', error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch submodel registry',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/events:
 *   get:
 *     summary: Get recent BaSyx MQTT events
 *     tags: [BaSyx]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, aas, submodel, registry, discovery]
 *         description: Type of events to retrieve
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         description: Maximum number of events to retrieve
 *     responses:
 *       200:
 *         description: Recent BaSyx events
 */
router.get('/events', async (req, res) => {
  try {
    const { type = 'all', limit = 100 } = req.query;
    const basyxMqtt = req.app.locals.basyxMqtt;
    
    if (!basyxMqtt) {
      return res.status(503).json({
        success: false,
        error: 'BaSyx MQTT service not available'
      });
    }
    
    const events = await basyxMqtt.getRecentEvents(type, parseInt(limit));
    
    res.json({
      success: true,
      data: events,
      count: events.length,
      type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to fetch BaSyx events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch BaSyx events',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/basyx/mqtt/status:
 *   get:
 *     summary: Get BaSyx MQTT service status
 *     tags: [BaSyx]
 *     responses:
 *       200:
 *         description: MQTT service status
 */
router.get('/mqtt/status', (req, res) => {
  try {
    const basyxMqtt = req.app.locals.basyxMqtt;
    
    if (!basyxMqtt) {
      return res.status(503).json({
        success: false,
        error: 'BaSyx MQTT service not available'
      });
    }
    
    const status = basyxMqtt.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get MQTT status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MQTT status',
      details: error.message
    });
  }
});

module.exports = router;