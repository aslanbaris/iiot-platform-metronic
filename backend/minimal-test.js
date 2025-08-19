const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// BaSyx test routes
app.get('/api/v1/basyx/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      aasEnvironment: 'disconnected',
      aasRegistry: 'disconnected',
      submodelRegistry: 'disconnected',
      discovery: 'disconnected'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/basyx/aas', (req, res) => {
  res.json({
    aas: [
      {
        id: 'SensorExampleAAS',
        idShort: 'SensorExampleAAS',
        description: 'Example sensor AAS for testing',
        submodels: ['TechnicalData', 'OperationalData']
      }
    ],
    count: 1
  });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Minimal test server running on port ${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔧 BaSyx Health: http://localhost:${PORT}/api/v1/basyx/health`);
  console.log(`📦 BaSyx AAS: http://localhost:${PORT}/api/v1/basyx/aas`);
});