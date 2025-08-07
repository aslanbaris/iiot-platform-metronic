const mqtt = require('mqtt');
const logger = require('../utils/logger');
const { redisClient } = require('./redis');

class MQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.io = null;
    this.subscriptions = new Set();
  }

  async connect(socketIO) {
    try {
      this.io = socketIO;
      
      // Use MQTT_BROKER_URL if available, otherwise fallback to host/port
      const brokerUrl = process.env.MQTT_BROKER_URL;
      let options;
      
      if (brokerUrl) {
        options = {
          clientId: process.env.MQTT_CLIENT_ID || `iiot-backend-${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 1000,
          keepalive: 60,
        };
      } else {
        options = {
          host: process.env.MQTT_HOST || 'localhost',
          port: parseInt(process.env.MQTT_PORT) || 1883,
          clientId: process.env.MQTT_CLIENT_ID || `iiot-backend-${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 1000,
          keepalive: 60,
        };
      }

      // Add authentication if provided
      if (process.env.MQTT_USERNAME) {
        options.username = process.env.MQTT_USERNAME;
      }
      if (process.env.MQTT_PASSWORD) {
        options.password = process.env.MQTT_PASSWORD;
      }

      this.client = brokerUrl ? mqtt.connect(brokerUrl, options) : mqtt.connect(options);

      // Event listeners
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info(`MQTT client connected with ID: ${options.clientId}`);
        this.subscribeToTopics();
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('MQTT client error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.info('MQTT client disconnected');
      });

      this.client.on('reconnect', () => {
        logger.info('MQTT client reconnecting...');
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      return new Promise((resolve, reject) => {
        this.client.on('connect', () => resolve(this.client));
        this.client.on('error', reject);
      });
    } catch (error) {
      logger.error('MQTT connection failed:', error);
      throw error;
    }
  }

  async subscribeToTopics() {
    try {
      // Subscribe to device data topics
      const topics = [
        'iiot/+/data',           // Device data: iiot/{device_id}/data
        'iiot/+/status',         // Device status: iiot/{device_id}/status
        'iiot/+/alerts',         // Device alerts: iiot/{device_id}/alerts
        'iiot/+/config',         // Device config: iiot/{device_id}/config
        'iiot/system/+',         // System messages: iiot/system/{message_type}
        'iiot/broadcast/+',      // Broadcast messages: iiot/broadcast/{message_type}
      ];

      for (const topic of topics) {
        this.client.subscribe(topic, { qos: 1 }, (error) => {
          if (error) {
            logger.error(`Failed to subscribe to topic ${topic}:`, error);
          } else {
            this.subscriptions.add(topic);
            logger.info(`Subscribed to topic: ${topic}`);
          }
        });
      }
    } catch (error) {
      logger.error('Failed to subscribe to topics:', error);
    }
  }

  async handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      logger.debug(`MQTT message received on topic ${topic}: ${messageStr}`);

      // Parse message
      let data;
      try {
        data = JSON.parse(messageStr);
      } catch (parseError) {
        logger.warn(`Invalid JSON message on topic ${topic}: ${messageStr}`);
        return;
      }

      // Extract device ID from topic
      const topicParts = topic.split('/');
      const deviceId = topicParts[1];
      const messageType = topicParts[2];

      // Handle different message types
      switch (messageType) {
        case 'data':
          await this.handleSensorData(deviceId, data);
          break;
        case 'status':
          await this.handleDeviceStatus(deviceId, data);
          break;
        case 'alerts':
          await this.handleDeviceAlert(deviceId, data);
          break;
        case 'config':
          await this.handleDeviceConfig(deviceId, data);
          break;
        default:
          if (topicParts[1] === 'system') {
            await this.handleSystemMessage(topicParts[2], data);
          } else if (topicParts[1] === 'broadcast') {
            await this.handleBroadcastMessage(topicParts[2], data);
          }
          break;
      }
    } catch (error) {
      logger.error(`Error handling MQTT message on topic ${topic}:`, error);
    }
  }

  async handleSensorData(deviceId, data) {
    try {
      // Validate required fields
      if (!data.sensors || !Array.isArray(data.sensors)) {
        logger.warn(`Invalid sensor data format for device ${deviceId}`);
        return;
      }

      const timestamp = data.timestamp || new Date().toISOString();
      
      // Insert sensor data into database
      for (const sensor of data.sensors) {
        if (!sensor.sensor_id || sensor.value === undefined) {
          logger.warn(`Invalid sensor data: ${JSON.stringify(sensor)}`);
          continue;
        }

        // TODO: Replace with InfluxDB write
        // await query(`
        //   INSERT INTO iiot.sensor_data (device_id, sensor_id, value, unit, timestamp, metadata)
        //   VALUES ($1, $2, $3, $4, $5, $6)
        // `, [
        //   deviceId,
        //   sensor.sensor_id,
        //   sensor.value,
        //   sensor.unit || null,
        //   timestamp,
        //   sensor.metadata || null
        // ]);
      }

      // Cache latest data in Redis
      await redisClient.hset(`device:${deviceId}:latest`, 'data', {
        ...data,
        timestamp,
        received_at: new Date().toISOString()
      });

      // Emit to WebSocket clients
      if (this.io) {
        this.io.to(`device-${deviceId}`).emit('sensor-data', {
          device_id: deviceId,
          ...data,
          timestamp
        });
      }

      logger.debug(`Processed sensor data for device ${deviceId}`);
    } catch (error) {
      logger.error(`Error processing sensor data for device ${deviceId}:`, error);
    }
  }

  async handleDeviceStatus(deviceId, data) {
    try {
      const timestamp = new Date().toISOString();
      
      // TODO: Replace with MongoDB update
      // await query(`
      //   UPDATE iiot.devices 
      //   SET status = $1, last_seen = $2, metadata = $3
      //   WHERE id = $4
      // `, [data.status || 'unknown', timestamp, data.metadata || null, deviceId]);

      // Cache status in Redis
      await redisClient.hset(`device:${deviceId}:latest`, 'status', {
        ...data,
        timestamp
      });

      // Emit to WebSocket clients
      if (this.io) {
        this.io.to(`device-${deviceId}`).emit('device-status', {
          device_id: deviceId,
          ...data,
          timestamp
        });
      }

      logger.debug(`Updated status for device ${deviceId}: ${data.status}`);
    } catch (error) {
      logger.error(`Error updating device status for ${deviceId}:`, error);
    }
  }

  async handleDeviceAlert(deviceId, data) {
    try {
      const timestamp = new Date().toISOString();
      
      // TODO: Replace with MongoDB insert
      // const result = await query(`
      //   INSERT INTO iiot.alerts (device_id, sensor_id, alert_type, severity, message, value, threshold, timestamp)
      //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      //   RETURNING id
      // `, [
      //   deviceId,
      //   data.sensor_id || null,
      //   data.alert_type || 'threshold',
      //   data.severity || 'medium',
      //   data.message || 'Alert triggered',
      //   data.value || null,
      //   data.threshold || null,
      //   timestamp
      // ]);

      const alertId = Date.now(); // Temporary ID

      // Cache alert in Redis
      await redisClient.lpush(`device:${deviceId}:alerts`, {
        id: alertId,
        ...data,
        timestamp
      });

      // Emit to WebSocket clients
      if (this.io) {
        this.io.emit('device-alert', {
          id: alertId,
          device_id: deviceId,
          ...data,
          timestamp
        });
      }

      logger.info(`Alert created for device ${deviceId}: ${data.message}`);
    } catch (error) {
      logger.error(`Error processing alert for device ${deviceId}:`, error);
    }
  }

  async handleDeviceConfig(deviceId, data) {
    try {
      // TODO: Replace with MongoDB update
      // await query(`
      //   UPDATE iiot.devices 
      //   SET config = $1, updated_at = NOW()
      //   WHERE id = $2
      // `, [data, deviceId]);

      logger.info(`Configuration updated for device ${deviceId}`);
    } catch (error) {
      logger.error(`Error updating config for device ${deviceId}:`, error);
    }
  }

  async handleSystemMessage(messageType, data) {
    try {
      logger.info(`System message received: ${messageType}`, data);
      
      // Emit to all WebSocket clients
      if (this.io) {
        this.io.emit('system-message', {
          type: messageType,
          data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Error processing system message ${messageType}:`, error);
    }
  }

  async handleBroadcastMessage(messageType, data) {
    try {
      logger.info(`Broadcast message received: ${messageType}`, data);
      
      // Emit to all WebSocket clients
      if (this.io) {
        this.io.emit('broadcast-message', {
          type: messageType,
          data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Error processing broadcast message ${messageType}:`, error);
    }
  }

  async publish(topic, message, options = {}) {
    try {
      if (!this.isConnected) {
        logger.warn('MQTT client not connected, cannot publish message');
        return false;
      }

      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      return new Promise((resolve, reject) => {
        this.client.publish(topic, messageStr, { qos: 1, ...options }, (error) => {
          if (error) {
            logger.error(`Failed to publish to topic ${topic}:`, error);
            reject(error);
          } else {
            logger.debug(`Message published to topic ${topic}`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error(`Error publishing to topic ${topic}:`, error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      logger.info('MQTT client disconnected');
    }
  }

  async healthCheck() {
    return this.isConnected;
  }

  getSubscriptions() {
    return Array.from(this.subscriptions);
  }
}

// Create singleton instance
const mqttClient = new MQTTClient();

// Export connection function
const connectMQTT = async (socketIO) => {
  return await mqttClient.connect(socketIO);
};

module.exports = {
  mqttClient,
  connectMQTT
};