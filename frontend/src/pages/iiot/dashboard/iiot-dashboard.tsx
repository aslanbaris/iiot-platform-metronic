import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient, socketClient } from '@/lib/supabase';
import { Activity, Cpu, Database, Thermometer, Zap, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import BaSyxAssetsWidget from '@/components/basyx/BaSyxAssetsWidget';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SensorData {
  _id: string;
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  location?: string;
}

interface DeviceStatus {
  _id: string;
  deviceId: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  location?: string;
  sensorCount: number;
}

interface SystemMetrics {
  totalDevices: number;
  onlineDevices: number;
  totalSensors: number;
  activeSensors: number;
  alertsCount: number;
  dataPointsToday: number;
}

export function IIOTDashboard() {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalDevices: 0,
    onlineDevices: 0,
    totalSensors: 0,
    activeSensors: 0,
    alertsCount: 0,
    dataPointsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch system metrics
        const metricsResponse = await apiClient.get('/api/v1/system/metrics');
        setMetrics(metricsResponse.data);

        // Fetch recent sensor data
        const sensorResponse = await apiClient.get('/api/v1/sensors/recent?limit=50');
        setSensorData(sensorResponse.data);

        // Fetch device status
        const devicesResponse = await apiClient.get('/api/v1/devices/status');
        setDevices(devicesResponse.data);

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please check if the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Setup real-time updates
  useEffect(() => {
    // Connect to Socket.IO for real-time updates
    socketClient.connect();

    socketClient.on('sensor-data', (data: SensorData) => {
      setSensorData(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 readings
    });

    socketClient.on('device-status', (deviceStatus: DeviceStatus) => {
      setDevices(prev => 
        prev.map(device => 
          device.deviceId === deviceStatus.deviceId ? deviceStatus : device
        )
      );
    });

    socketClient.on('system-metrics', (newMetrics: SystemMetrics) => {
      setMetrics(newMetrics);
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  // Prepare chart data
  const temperatureData = sensorData
    .filter(data => data.sensorType === 'temperature')
    .slice(0, 20)
    .reverse();

  const chartData = {
    labels: temperatureData.map((_, index) => `T-${index + 1}`),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temperatureData.map(data => data.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const deviceStatusChart = {
    labels: ['Online', 'Offline', 'Error'],
    datasets: [
      {
        label: 'Device Status',
        data: [
          devices.filter(d => d.status === 'online').length,
          devices.filter(d => d.status === 'offline').length,
          devices.filter(d => d.status === 'error').length,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(156, 163, 175, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading IIOT Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IIOT Platform Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and analytics for your industrial IoT devices</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={socketClient.connected ? 'default' : 'destructive'}>
            <Wifi className="w-3 h-3 mr-1" />
            {socketClient.connected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.onlineDevices} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sensors</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeSensors}</div>
            <p className="text-xs text-muted-foreground">
              of {metrics.totalSensors} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points Today</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.dataPointsToday.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Real-time collection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.alertsCount}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Thermometer className="w-5 h-5" />
              <span>Temperature Trends</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {temperatureData.length > 0 ? (
              <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No temperature data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Device Status Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length > 0 ? (
              <Bar data={deviceStatusChart} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No device data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sensor Data */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sensor Readings</CardTitle>
        </CardHeader>
        <CardContent>
          {sensorData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Device ID</th>
                    <th className="text-left p-2">Sensor Type</th>
                    <th className="text-left p-2">Value</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorData.slice(0, 10).map((data, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{data.deviceId}</td>
                      <td className="p-2">
                        <Badge variant="outline">{data.sensorType}</Badge>
                      </td>
                      <td className="p-2 font-semibold">
                        {data.value} {data.unit}
                      </td>
                      <td className="p-2">{data.location || 'N/A'}</td>
                      <td className="p-2 text-gray-500">
                        {new Date(data.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No sensor data available. Make sure devices are connected and sending data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Status */}
      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div key={device._id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{device.name}</h4>
                    <Badge 
                      variant={device.status === 'online' ? 'default' : device.status === 'offline' ? 'secondary' : 'destructive'}
                    >
                      {device.status === 'online' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {device.status === 'error' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {device.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">ID: {device.deviceId}</p>
                  <p className="text-sm text-gray-600 mb-1">Location: {device.location || 'N/A'}</p>
                  <p className="text-sm text-gray-600 mb-1">Sensors: {device.sensorCount}</p>
                  <p className="text-xs text-gray-500">
                    Last seen: {new Date(device.lastSeen).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No devices registered. Add devices to start monitoring.
            </div>
          )}
        </CardContent>
      </Card>

      {/* BaSyx Assets */}
      <BaSyxAssetsWidget />
    </div>
  );
}