# IIOT Platform Backend

A comprehensive Industrial Internet of Things (IIOT) platform backend built with Node.js, Express, MongoDB, Redis, and MQTT.

## Features

### Core Functionality
- **Device Management**: Complete CRUD operations for industrial devices
- **Sensor Management**: Real-time sensor data collection and management
- **Data Analytics**: Advanced analytics and reporting capabilities
- **Alert System**: Real-time alerting with configurable thresholds
- **User Authentication**: JWT-based authentication with role-based access control
- **Real-time Communication**: WebSocket support for live data streaming
- **MQTT Integration**: Industrial protocol support for device communication

### Technical Features
- **RESTful API**: Well-structured REST endpoints with comprehensive documentation
- **Real-time Data**: WebSocket and MQTT integration for live data streaming
- **Caching**: Redis-based caching for improved performance
- **Security**: Comprehensive security middleware (Helmet, CORS, Rate limiting)
- **Validation**: Input validation and sanitization
- **Logging**: Structured logging with Winston
- **Error Handling**: Centralized error handling with custom error classes
- **API Documentation**: Swagger/OpenAPI documentation
- **Testing**: Comprehensive test suite with Jest
- **Code Quality**: ESLint and Prettier for code formatting

## Technology Stack

- **Runtime**: Node.js (>=16.0.0)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Message Broker**: MQTT
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express-validator
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Logging**: Winston

## Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (>=16.0.0)
- npm (>=8.0.0)
- MongoDB (>=5.0)
- Redis (>=6.0)
- MQTT Broker (Mosquitto recommended)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd iiot-platform-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration settings.

4. **Start required services**
   
   **MongoDB**:
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or install locally and start
   mongod
   ```
   
   **Redis**:
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   
   # Or install locally and start
   redis-server
   ```
   
   **MQTT Broker (Mosquitto)**:
   ```bash
   # Using Docker
   docker run -d -p 1883:1883 --name mosquitto eclipse-mosquitto:latest
   
   # Or install locally and start
   mosquitto
   ```

## Usage

### Development

```bash
# Start in development mode with auto-reload
npm run dev

# Start in production mode
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Operations

```bash
# Run database migrations
npm run migrate

# Seed database with sample data
npm run seed
```

## API Documentation

Once the server is running, you can access the API documentation at:

- **Swagger UI**: `http://localhost:5000/api-docs`
- **Health Check**: `http://localhost:5000/health`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update user profile
- `PUT /api/v1/auth/change-password` - Change password

### Devices
- `GET /api/v1/devices` - List all devices
- `GET /api/v1/devices/:id` - Get device by ID
- `POST /api/v1/devices` - Create new device
- `PUT /api/v1/devices/:id` - Update device
- `DELETE /api/v1/devices/:id` - Delete device
- `GET /api/v1/devices/:id/sensors` - Get device sensors
- `GET /api/v1/devices/:id/stats` - Get device statistics
- `POST /api/v1/devices/:id/commands` - Send command to device

### Sensors
- `GET /api/v1/sensors` - List all sensors
- `GET /api/v1/sensors/:id` - Get sensor by ID
- `POST /api/v1/sensors` - Create new sensor
- `PUT /api/v1/sensors/:id` - Update sensor
- `DELETE /api/v1/sensors/:id` - Delete sensor
- `GET /api/v1/sensors/:id/data` - Get sensor data
- `GET /api/v1/sensors/:id/stats` - Get sensor statistics
- `POST /api/v1/sensors/:id/calibrate` - Calibrate sensor

### Data
- `GET /api/v1/data` - Get sensor data with filtering
- `GET /api/v1/data/realtime` - Get real-time data stream
- `GET /api/v1/data/stats` - Get data statistics
- `GET /api/v1/data/export` - Export data (CSV/JSON/XLSX)
- `GET /api/v1/data/quality` - Get data quality metrics
- `DELETE /api/v1/data/cleanup` - Clean up old data

### Alerts
- `GET /api/v1/alerts` - List alerts with filtering
- `GET /api/v1/alerts/stats` - Get alert statistics
- `POST /api/v1/alerts` - Create new alert
- `POST /api/v1/alerts/bulk-acknowledge` - Bulk acknowledge alerts
- `GET /api/v1/alerts/:id` - Get alert by ID
- `PUT /api/v1/alerts/:id` - Update alert
- `PUT /api/v1/alerts/:id/acknowledge` - Acknowledge alert
- `PUT /api/v1/alerts/:id/resolve` - Resolve alert
- `DELETE /api/v1/alerts/:id` - Delete alert

### Analytics
- `GET /api/v1/analytics/dashboard` - Dashboard overview
- `GET /api/v1/analytics/device-performance` - Device performance metrics
- `GET /api/v1/analytics/sensor-analysis` - Sensor analysis
- `GET /api/v1/analytics/energy-consumption` - Energy consumption analysis
- `GET /api/v1/analytics/predictive` - Predictive analytics
- `POST /api/v1/analytics/reports` - Generate custom reports

### System
- `GET /api/v1/system/health` - System health check
- `GET /api/v1/system/info` - System information
- `GET /api/v1/system/metrics` - Application metrics
- `GET /api/v1/system/audit-logs` - Audit logs
- `GET /api/v1/system/config` - System configuration
- `PUT /api/v1/system/config` - Update system configuration
- `POST /api/v1/system/backup` - Create database backup
- `DELETE /api/v1/system/cache` - Clear cache

## WebSocket Events

### Client to Server
- `authenticate` - Authenticate WebSocket connection
- `subscribe_device` - Subscribe to device data
- `subscribe_sensor` - Subscribe to sensor data
- `subscribe_alerts` - Subscribe to alerts
- `unsubscribe` - Unsubscribe from data streams
- `ping` - Connection health check

### Server to Client
- `authenticated` - Authentication successful
- `auth_error` - Authentication failed
- `subscribed` - Subscription successful
- `unsubscribed` - Unsubscription successful
- `sensor_data` - Real-time sensor data
- `device_status` - Device status updates
- `new_alert` - New alert notification
- `user_alert` - User-specific alert
- `system_notification` - System notifications
- `pong` - Response to ping
- `error` - Error messages

## MQTT Topics

- `iiot/devices/+/data` - Device data
- `iiot/devices/+/status` - Device status
- `iiot/devices/+/commands` - Device commands
- `iiot/sensors/+/data` - Sensor data
- `iiot/alerts` - Alert notifications
- `iiot/system` - System messages

## Environment Variables

See `.env.example` for a complete list of environment variables. Key variables include:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `MQTT_BROKER_URL` - MQTT broker URL
- `JWT_SECRET` - JWT signing secret
- `CORS_ORIGIN` - Allowed CORS origins

## Docker Support

### Build Docker Image
```bash
npm run docker:build
```

### Run with Docker
```bash
npm run docker:run
```

### Docker Compose
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down
```

## Deployment

### Production Checklist

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Configure secure JWT secrets
   - Set up production database URLs
   - Configure CORS origins

2. **Security**
   - Enable HTTPS
   - Configure rate limiting
   - Set up firewall rules
   - Enable security headers

3. **Monitoring**
   - Set up logging aggregation
   - Configure health checks
   - Set up monitoring dashboards
   - Configure alerting

4. **Performance**
   - Enable clustering
   - Configure caching
   - Optimize database indexes
   - Set up load balancing

### Deployment Options

- **Traditional Server**: PM2 process manager
- **Container**: Docker with orchestration
- **Cloud**: AWS ECS, Azure Container Instances, GCP Cloud Run
- **Serverless**: AWS Lambda, Azure Functions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use conventional commit messages
- Ensure all tests pass before submitting PR

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Redis Connection Failed**
   - Ensure Redis is running
   - Check Redis URL in `.env`
   - Verify Redis configuration

3. **MQTT Connection Failed**
   - Ensure MQTT broker is running
   - Check broker URL in `.env`
   - Verify MQTT credentials

4. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify WebSocket URL
   - Check firewall settings

### Debugging

```bash
# Enable debug mode
DEBUG=* npm run dev

# Check logs
tail -f logs/combined.log

# Monitor system resources
npm run system:monitor
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the FAQ section
- Contact the development team

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

---

**Built with ❤️ by the IIOT Platform Team**