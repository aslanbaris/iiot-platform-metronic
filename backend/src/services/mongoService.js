const { MongoClient } = require('mongodb');

class MongoService {
  constructor() {
    this.url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
    this.dbName = process.env.MONGODB_DATABASE || 'iiot-metadata';
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      this.client = new MongoClient(this.url, {
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      
      console.log(`Connected to MongoDB: ${this.dbName}`);
      
      // Create indexes for better performance
      await this.createIndexes();
      
    } catch (error) {
      console.error('MongoDB connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Create database indexes
   */
  async createIndexes() {
    try {
      // Asset metadata indexes
      await this.db.collection('assets').createIndex({ assetId: 1 }, { unique: true });
      await this.db.collection('assets').createIndex({ type: 1 });
      await this.db.collection('assets').createIndex({ status: 1 });
      
      // Device configuration indexes
      await this.db.collection('devices').createIndex({ deviceId: 1 }, { unique: true });
      await this.db.collection('devices').createIndex({ assetId: 1 });
      
      // BaSyx AAS metadata indexes
      await this.db.collection('aas_metadata').createIndex({ aasId: 1 }, { unique: true });
      await this.db.collection('aas_metadata').createIndex({ 'identification.id': 1 });
      
      console.log('MongoDB indexes created successfully');
    } catch (error) {
      console.error('Error creating MongoDB indexes:', error);
    }
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('MongoDB not connected');
    }
    return this.db;
  }

  /**
   * Get collection
   * @param {string} collectionName - Collection name
   */
  getCollection(collectionName) {
    return this.getDb().collection(collectionName);
  }

  // Asset Management Methods
  
  /**
   * Create or update asset metadata
   * @param {Object} assetData - Asset data
   */
  async upsertAsset(assetData) {
    try {
      const collection = this.getCollection('assets');
      const result = await collection.replaceOne(
        { assetId: assetData.assetId },
        {
          ...assetData,
          updatedAt: new Date(),
          createdAt: assetData.createdAt || new Date()
        },
        { upsert: true }
      );
      
      console.log(`Asset ${assetData.assetId} upserted`);
      return result;
    } catch (error) {
      console.error('Error upserting asset:', error);
      throw error;
    }
  }

  /**
   * Get asset by ID
   * @param {string} assetId - Asset identifier
   */
  async getAsset(assetId) {
    try {
      const collection = this.getCollection('assets');
      return await collection.findOne({ assetId });
    } catch (error) {
      console.error('Error getting asset:', error);
      throw error;
    }
  }

  /**
   * Get all assets
   * @param {Object} filter - Optional filter
   * @param {Object} options - Query options
   */
  async getAssets(filter = {}, options = {}) {
    try {
      const collection = this.getCollection('assets');
      return await collection.find(filter, options).toArray();
    } catch (error) {
      console.error('Error getting assets:', error);
      throw error;
    }
  }

  // Device Management Methods
  
  /**
   * Create or update device configuration
   * @param {Object} deviceData - Device data
   */
  async upsertDevice(deviceData) {
    try {
      const collection = this.getCollection('devices');
      const result = await collection.replaceOne(
        { deviceId: deviceData.deviceId },
        {
          ...deviceData,
          updatedAt: new Date(),
          createdAt: deviceData.createdAt || new Date()
        },
        { upsert: true }
      );
      
      console.log(`Device ${deviceData.deviceId} upserted`);
      return result;
    } catch (error) {
      console.error('Error upserting device:', error);
      throw error;
    }
  }

  /**
   * Get device by ID
   * @param {string} deviceId - Device identifier
   */
  async getDevice(deviceId) {
    try {
      const collection = this.getCollection('devices');
      return await collection.findOne({ deviceId });
    } catch (error) {
      console.error('Error getting device:', error);
      throw error;
    }
  }

  /**
   * Get devices by asset ID
   * @param {string} assetId - Asset identifier
   */
  async getDevicesByAsset(assetId) {
    try {
      const collection = this.getCollection('devices');
      return await collection.find({ assetId }).toArray();
    } catch (error) {
      console.error('Error getting devices by asset:', error);
      throw error;
    }
  }

  // BaSyx AAS Metadata Methods
  
  /**
   * Store AAS metadata
   * @param {Object} aasData - AAS metadata
   */
  async storeAASMetadata(aasData) {
    try {
      const collection = this.getCollection('aas_metadata');
      const result = await collection.replaceOne(
        { aasId: aasData.aasId },
        {
          ...aasData,
          updatedAt: new Date(),
          createdAt: aasData.createdAt || new Date()
        },
        { upsert: true }
      );
      
      console.log(`AAS metadata ${aasData.aasId} stored`);
      return result;
    } catch (error) {
      console.error('Error storing AAS metadata:', error);
      throw error;
    }
  }

  /**
   * Get AAS metadata
   * @param {string} aasId - AAS identifier
   */
  async getAASMetadata(aasId) {
    try {
      const collection = this.getCollection('aas_metadata');
      return await collection.findOne({ aasId });
    } catch (error) {
      console.error('Error getting AAS metadata:', error);
      throw error;
    }
  }

  /**
   * Search AAS metadata
   * @param {Object} searchCriteria - Search criteria
   */
  async searchAASMetadata(searchCriteria) {
    try {
      const collection = this.getCollection('aas_metadata');
      return await collection.find(searchCriteria).toArray();
    } catch (error) {
      console.error('Error searching AAS metadata:', error);
      throw error;
    }
  }

  // Generic Methods
  
  /**
   * Execute aggregation pipeline
   * @param {string} collectionName - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   */
  async aggregate(collectionName, pipeline) {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error executing aggregation:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected' };
      }
      
      await this.db.admin().ping();
      return { 
        status: 'connected',
        database: this.dbName,
        timestamp: new Date()
      };
    } catch (error) {
      return { 
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Close MongoDB connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log('MongoDB connection closed');
      }
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
}

module.exports = new MongoService();