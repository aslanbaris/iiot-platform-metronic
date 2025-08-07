const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { WriteApi } = require('@influxdata/influxdb-client');

class InfluxService {
  constructor() {
    this.url = process.env.INFLUXDB_URL || 'http://localhost:8086';
    this.token = process.env.INFLUXDB_TOKEN;
    this.org = process.env.INFLUXDB_ORG || 'basyx';
    this.bucket = process.env.INFLUXDB_BUCKET || 'iiot-data';
    
    if (!this.token) {
      console.warn('InfluxDB token not provided. Time-series data will not be stored.');
      return;
    }
    
    this.client = new InfluxDB({ url: this.url, token: this.token });
    this.writeApi = this.client.getWriteApi(this.org, this.bucket);
    this.queryApi = this.client.getQueryApi(this.org);
    
    // Configure write options
    this.writeApi.useDefaultTags({ source: 'iiot-platform' });
    
    console.log(`InfluxDB service initialized: ${this.url}`);
  }

  /**
   * Write time-series data point
   * @param {string} measurement - Measurement name
   * @param {Object} tags - Tags object
   * @param {Object} fields - Fields object
   * @param {Date} timestamp - Optional timestamp
   */
  async writePoint(measurement, tags = {}, fields = {}, timestamp = null) {
    if (!this.writeApi) {
      console.warn('InfluxDB not configured. Skipping write operation.');
      return;
    }

    try {
      const point = new Point(measurement);
      
      // Add tags
      Object.entries(tags).forEach(([key, value]) => {
        point.tag(key, value);
      });
      
      // Add fields
      Object.entries(fields).forEach(([key, value]) => {
        if (typeof value === 'number') {
          point.floatField(key, value);
        } else if (typeof value === 'boolean') {
          point.booleanField(key, value);
        } else {
          point.stringField(key, String(value));
        }
      });
      
      // Set timestamp if provided
      if (timestamp) {
        point.timestamp(timestamp);
      }
      
      this.writeApi.writePoint(point);
      await this.writeApi.flush();
      
      console.log(`Data written to InfluxDB: ${measurement}`);
    } catch (error) {
      console.error('Error writing to InfluxDB:', error);
      throw error;
    }
  }

  /**
   * Write sensor data
   * @param {string} deviceId - Device identifier
   * @param {string} sensorType - Type of sensor
   * @param {number} value - Sensor value
   * @param {Object} metadata - Additional metadata
   */
  async writeSensorData(deviceId, sensorType, value, metadata = {}) {
    const tags = {
      device_id: deviceId,
      sensor_type: sensorType,
      ...metadata.tags
    };
    
    const fields = {
      value: value,
      ...metadata.fields
    };
    
    await this.writePoint('sensor_data', tags, fields);
  }

  /**
   * Query time-series data
   * @param {string} query - Flux query string
   * @returns {Array} Query results
   */
  async query(query) {
    if (!this.queryApi) {
      console.warn('InfluxDB not configured. Returning empty results.');
      return [];
    }

    try {
      const results = [];
      await this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          results.push(o);
        },
        error(error) {
          console.error('Query error:', error);
        },
        complete() {
          console.log('Query completed');
        },
      });
      
      return results;
    } catch (error) {
      console.error('Error querying InfluxDB:', error);
      throw error;
    }
  }

  /**
   * Get sensor data for a device within time range
   * @param {string} deviceId - Device identifier
   * @param {string} timeRange - Time range (e.g., '-1h', '-24h')
   * @returns {Array} Sensor data
   */
  async getSensorData(deviceId, timeRange = '-1h') {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "sensor_data")
        |> filter(fn: (r) => r.device_id == "${deviceId}")
        |> sort(columns: ["_time"], desc: false)
    `;
    
    return await this.query(query);
  }

  /**
   * Get aggregated sensor data
   * @param {string} deviceId - Device identifier
   * @param {string} timeRange - Time range
   * @param {string} aggregateWindow - Aggregation window (e.g., '5m', '1h')
   * @returns {Array} Aggregated data
   */
  async getAggregatedSensorData(deviceId, timeRange = '-24h', aggregateWindow = '1h') {
    const query = `
      from(bucket: "${this.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "sensor_data")
        |> filter(fn: (r) => r.device_id == "${deviceId}")
        |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;
    
    return await this.query(query);
  }

  /**
   * Close InfluxDB connection
   */
  async close() {
    if (this.writeApi) {
      await this.writeApi.close();
    }
    console.log('InfluxDB connection closed');
  }
}

module.exports = new InfluxService();