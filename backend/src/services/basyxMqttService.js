const mqtt = require('mqtt');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const { createClient } = require('redis');

class BaSyxMQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 5000;
    
    // Redis client for caching and pub/sub
    this.redis = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    // Connect to Redis
    this.redis.connect().catch(err => {
      logger.error('Redis connection error:', err);
    });
    
    // BaSyx MQTT configuration
    this.config = {
      host: process.env.BASYX_MQTT_HOST || 'localhost',
      port: process.env.BASYX_MQTT_PORT || 1883,
      username: process.env.BASYX_MQTT_USERNAME || '',
      password: process.env.BASYX_MQTT_PASSWORD || '',
      clientId: `iiot-platform-${Date.now()}`,
      keepalive: 60,
      clean: true,
      reconnectPeriod: this.reconnectInterval
    };
    
    // Topic patterns for BaSyx events
    this.topics = {
      aasEvents: 'BaSyxAAS/+/events/+',
      submodelEvents: 'BaSyxSubmodel/+/events/+',
      registryEvents: 'BaSyxRegistry/+/events/+',
      discoveryEvents: 'BaSyxDiscovery/+/events/+'
    };
    
    this.init();
  }
  
  async init() {
    try {
      await this.connect();
      this.setupEventHandlers();
      this.subscribeToTopics();
      logger.info('BaSyx MQTT Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize BaSyx MQTT Service:', error);
      this.scheduleReconnect();
    }
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const mqttUrl = `mqtt://${this.config.host}:${this.config.port}`;
        logger.info(`Connecting to BaSyx MQTT broker at ${mqttUrl}`);
        
        this.client = mqtt.connect(mqttUrl, {
          clientId: this.config.clientId,
          username: this.config.username,
          password: this.config.password,
          keepalive: this.config.keepalive,
          clean: this.config.clean,
          reconnectPeriod: this.config.reconnectPeriod
        });
        
        this.client.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to BaSyx MQTT broker');
          resolve();
        });
        
        this.client.on('error', (error) => {
          logger.error('BaSyx MQTT connection error:', error);
          reject(error);
        });
        
        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  setupEventHandlers() {
    if (!this.client) return;
    
    this.client.on('message', async (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        await this.handleBaSyxMessage(topic, payload);
      } catch (error) {
        logger.error('Error processing BaSyx MQTT message:', error);
      }
    });
    
    this.client.on('disconnect', () => {
      this.isConnected = false;
      logger.warn('Disconnected from BaSyx MQTT broker');
    });
    
    this.client.on('offline', () => {
      this.isConnected = false;
      logger.warn('BaSyx MQTT client went offline');
    });
    
    this.client.on('reconnect', () => {
      logger.info('Attempting to reconnect to BaSyx MQTT broker');
    });
  }
  
  async subscribeToTopics() {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot subscribe: MQTT client not connected');
      return;
    }
    
    const topicList = Object.values(this.topics);
    
    for (const topic of topicList) {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to topic ${topic}:`, error);
        } else {
          logger.info(`Subscribed to BaSyx topic: ${topic}`);
        }
      });
    }
  }
  
  async handleBaSyxMessage(topic, payload) {
    try {
      // Cache the message in Redis
      const cacheKey = `basyx:message:${Date.now()}`;
      await this.redis.setEx(cacheKey, 3600, JSON.stringify({ topic, payload, timestamp: new Date() }));
      
      // Determine message type based on topic
      const messageType = this.getMessageType(topic);
      
      // Process different types of BaSyx events
      switch (messageType) {
        case 'aas':
          await this.handleAASEvent(topic, payload);
          break;
        case 'submodel':
          await this.handleSubmodelEvent(topic, payload);
          break;
        case 'registry':
          await this.handleRegistryEvent(topic, payload);
          break;
        case 'discovery':
          await this.handleDiscoveryEvent(topic, payload);
          break;
        default:
          logger.warn(`Unknown BaSyx message type for topic: ${topic}`);
      }
      
      // Emit event for real-time updates
      this.emit('basyxMessage', { topic, payload, messageType });
      
      // Publish to Redis for other services
      await this.redis.publish('basyx:events', JSON.stringify({ topic, payload, messageType }));
      
    } catch (error) {
      logger.error('Error handling BaSyx message:', error);
    }
  }
  
  getMessageType(topic) {
    if (topic.includes('BaSyxAAS')) return 'aas';
    if (topic.includes('BaSyxSubmodel')) return 'submodel';
    if (topic.includes('BaSyxRegistry')) return 'registry';
    if (topic.includes('BaSyxDiscovery')) return 'discovery';
    return 'unknown';
  }
  
  async handleAASEvent(topic, payload) {
    logger.info('Processing AAS event:', { topic, payload });
    
    // Extract AAS ID from topic
    const aasId = this.extractIdFromTopic(topic, 'BaSyxAAS');
    
    // Store AAS event data
    if (aasId) {
      const eventData = {
        aasId,
        eventType: payload.eventType || 'unknown',
        timestamp: new Date(),
        data: payload
      };
      
      await this.redis.lPush('basyx:aas:events', JSON.stringify(eventData));
      await this.redis.lTrim('basyx:aas:events', 0, 999); // Keep last 1000 events
    }
  }
  
  async handleSubmodelEvent(topic, payload) {
    logger.info('Processing Submodel event:', { topic, payload });
    
    const submodelId = this.extractIdFromTopic(topic, 'BaSyxSubmodel');
    
    if (submodelId) {
      const eventData = {
        submodelId,
        eventType: payload.eventType || 'unknown',
        timestamp: new Date(),
        data: payload
      };
      
      await this.redis.lPush('basyx:submodel:events', JSON.stringify(eventData));
      await this.redis.lTrim('basyx:submodel:events', 0, 999);
    }
  }
  
  async handleRegistryEvent(topic, payload) {
    logger.info('Processing Registry event:', { topic, payload });
    
    const eventData = {
      eventType: payload.eventType || 'unknown',
      timestamp: new Date(),
      data: payload
    };
    
    await this.redis.lPush('basyx:registry:events', JSON.stringify(eventData));
    await this.redis.lTrim('basyx:registry:events', 0, 999);
  }
  
  async handleDiscoveryEvent(topic, payload) {
    logger.info('Processing Discovery event:', { topic, payload });
    
    const eventData = {
      eventType: payload.eventType || 'unknown',
      timestamp: new Date(),
      data: payload
    };
    
    await this.redis.lPush('basyx:discovery:events', JSON.stringify(eventData));
    await this.redis.lTrim('basyx:discovery:events', 0, 999);
  }
  
  extractIdFromTopic(topic, prefix) {
    const parts = topic.split('/');
    const prefixIndex = parts.findIndex(part => part === prefix);
    return prefixIndex !== -1 && prefixIndex + 1 < parts.length ? parts[prefixIndex + 1] : null;
  }
  
  async publishToBaSyx(topic, message) {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }
    
    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(message), { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to publish to BaSyx MQTT:', error);
          reject(error);
        } else {
          logger.info(`Published message to BaSyx topic: ${topic}`);
          resolve();
        }
      });
    });
  }
  
  async getRecentEvents(type = 'all', limit = 100) {
    try {
      let events = [];
      
      if (type === 'all' || type === 'aas') {
        const aasEvents = await this.redis.lRange('basyx:aas:events', 0, limit - 1);
        events = events.concat(aasEvents.map(event => JSON.parse(event)));
      }
      
      if (type === 'all' || type === 'submodel') {
        const submodelEvents = await this.redis.lRange('basyx:submodel:events', 0, limit - 1);
        events = events.concat(submodelEvents.map(event => JSON.parse(event)));
      }
      
      if (type === 'all' || type === 'registry') {
        const registryEvents = await this.redis.lRange('basyx:registry:events', 0, limit - 1);
        events = events.concat(registryEvents.map(event => JSON.parse(event)));
      }
      
      if (type === 'all' || type === 'discovery') {
        const discoveryEvents = await this.redis.lRange('basyx:discovery:events', 0, limit - 1);
        events = events.concat(discoveryEvents.map(event => JSON.parse(event)));
      }
      
      // Sort by timestamp
      return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
      
    } catch (error) {
      logger.error('Error fetching recent BaSyx events:', error);
      return [];
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.init();
    }, delay);
  }
  
  async disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      logger.info('Disconnected from BaSyx MQTT broker');
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
  }
  
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      clientId: this.config.clientId,
      subscribedTopics: Object.values(this.topics)
    };
  }
}

module.exports = BaSyxMQTTService;