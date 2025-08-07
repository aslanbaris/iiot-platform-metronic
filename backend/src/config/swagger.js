const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: process.env.SWAGGER_TITLE || 'IIOT Platform API',
      version: process.env.SWAGGER_VERSION || '1.0.0',
      description: process.env.SWAGGER_DESCRIPTION || 'Industrial IoT Platform REST API Documentation',
      contact: {
        name: process.env.SWAGGER_CONTACT_NAME || 'IIOT Platform Team',
        email: process.env.SWAGGER_CONTACT_EMAIL || 'support@iiot-platform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api/${process.env.API_VERSION || 'v1'}`,
        description: 'Development server'
      },
      {
        url: `https://api.iiot-platform.com/api/${process.env.API_VERSION || 'v1'}`,
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for device authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            username: {
              type: 'string',
              example: 'john_doe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            first_name: {
              type: 'string',
              example: 'John'
            },
            last_name: {
              type: 'string',
              example: 'Doe'
            },
            role: {
              type: 'string',
              enum: ['admin', 'operator', 'viewer'],
              example: 'operator'
            },
            is_active: {
              type: 'boolean',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Device: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'device-001'
            },
            name: {
              type: 'string',
              example: 'Temperature Sensor Unit 1'
            },
            type_id: {
              type: 'string',
              example: 'temp-sensor'
            },
            location: {
              type: 'string',
              example: 'Factory Floor A'
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'maintenance', 'error'],
              example: 'online'
            },
            last_seen: {
              type: 'string',
              format: 'date-time'
            },
            config: {
              type: 'object',
              description: 'Device configuration'
            },
            metadata: {
              type: 'object',
              description: 'Additional device metadata'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Sensor: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'sensor-001'
            },
            device_id: {
              type: 'string',
              example: 'device-001'
            },
            name: {
              type: 'string',
              example: 'Temperature Sensor'
            },
            type_id: {
              type: 'string',
              example: 'temperature'
            },
            unit: {
              type: 'string',
              example: '°C'
            },
            min_value: {
              type: 'number',
              example: -50
            },
            max_value: {
              type: 'number',
              example: 150
            },
            is_active: {
              type: 'boolean',
              example: true
            },
            config: {
              type: 'object',
              description: 'Sensor configuration'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        SensorData: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            device_id: {
              type: 'string',
              example: 'device-001'
            },
            sensor_id: {
              type: 'string',
              example: 'sensor-001'
            },
            value: {
              type: 'number',
              example: 23.5
            },
            unit: {
              type: 'string',
              example: '°C'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            metadata: {
              type: 'object',
              description: 'Additional data metadata'
            }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            device_id: {
              type: 'string',
              example: 'device-001'
            },
            sensor_id: {
              type: 'string',
              example: 'sensor-001'
            },
            alert_type: {
              type: 'string',
              enum: ['threshold', 'anomaly', 'offline', 'maintenance'],
              example: 'threshold'
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'high'
            },
            message: {
              type: 'string',
              example: 'Temperature exceeded maximum threshold'
            },
            value: {
              type: 'number',
              example: 85.2
            },
            threshold: {
              type: 'number',
              example: 80
            },
            is_acknowledged: {
              type: 'boolean',
              example: false
            },
            acknowledged_by: {
              type: 'string',
              format: 'uuid'
            },
            acknowledged_at: {
              type: 'string',
              format: 'date-time'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js')
  ]
};

const specs = swaggerJsdoc(options);

const swaggerSetup = (app, apiVersion) => {
  // Swagger UI options
  const swaggerOptions = {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
    customSiteTitle: 'IIOT Platform API Documentation',
    customfavIcon: '/favicon.ico'
  };

  // Serve Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
  
  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📚 Swagger documentation available at: /api-docs`);
};

module.exports = swaggerSetup;