// src/pages/SensorsPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  FaChartLine, FaPlus, FaSearch, FaThermometerHalf, 
  FaTint, FaWind, FaBolt, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle, FaHistory
} from 'react-icons/fa';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'power' | 'vibration' | 'air-quality' | 'sound' | 'light';
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  location: string;
  lastUpdate: Date;
  trend: 'up' | 'down' | 'stable';
  min: number;
  max: number;
  average24h: number;
  alerts: number;
  history?: DataPoint[];
}

interface DataPoint {
  time: string;
  value: number;
}

const SensorsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);

  // Mock data with history
  const generateHistory = (baseValue: number, variance: number): DataPoint[] => {
    const points: DataPoint[] = [];
    const now = new Date();
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      points.push({
        time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        value: baseValue + (Math.random() - 0.5) * variance
      });
    }
    return points;
  };

  const [sensors, setSensors] = useState<Sensor[]>([
    {
      id: '1',
      name: 'Workshop Temperature',
      type: 'temperature',
      value: 22.5,
      unit: '°C',
      status: 'normal',
      location: 'Main Area',
      lastUpdate: new Date(),
      trend: 'stable',
      min: 18,
      max: 26,
      average24h: 22.3,
      alerts: 0,
      history: generateHistory(22, 2)
    },
    {
      id: '2',
      name: 'Humidity Level',
      type: 'humidity',
      value: 45,
      unit: '%',
      status: 'normal',
      location: 'Main Area',
      lastUpdate: new Date(),
      trend: 'up',
      min: 30,
      max: 60,
      average24h: 43,
      alerts: 0,
      history: generateHistory(45, 5)
    },
    {
      id: '3',
      name: 'Air Pressure',
      type: 'pressure',
      value: 1013.25,
      unit: 'hPa',
      status: 'normal',
      location: 'Main Area',
      lastUpdate: new Date(),
      trend: 'down',
      min: 1000,
      max: 1030,
      average24h: 1014.5,
      alerts: 0,
      history: generateHistory(1013, 3)
    },
    {
      id: '4',
      name: 'Power Consumption',
      type: 'power',
      value: 2.8,
      unit: 'kW',
      status: 'warning',
      location: 'Machine Bay',
      lastUpdate: new Date(),
      trend: 'up',
      min: 0,
      max: 5,
      average24h: 2.5,
      alerts: 3,
      history: generateHistory(2.5, 1)
    },
    {
      id: '5',
      name: 'CNC Vibration',
      type: 'vibration',
      value: 0.8,
      unit: 'mm/s',
      status: 'critical',
      location: 'CNC Station',
      lastUpdate: new Date(),
      trend: 'up',
      min: 0,
      max: 0.5,
      average24h: 0.6,
      alerts: 12,
      history: generateHistory(0.6, 0.3)
    },
    {
      id: '6',
      name: 'Air Quality Index',
      type: 'air-quality',
      value: 85,
      unit: 'AQI',
      status: 'normal',
      location: 'Paint Booth',
      lastUpdate: new Date(),
      trend: 'stable',
      min: 0,
      max: 150,
      average24h: 82,
      alerts: 0,
      history: generateHistory(85, 10)
    },
    {
      id: '7',
      name: 'Sound Level',
      type: 'sound',
      value: 68,
      unit: 'dB',
      status: 'warning',
      location: 'Machine Bay',
      lastUpdate: new Date(),
      trend: 'up',
      min: 40,
      max: 85,
      average24h: 65,
      alerts: 2,
      history: generateHistory(65, 8)
    },
    {
      id: '8',
      name: 'Light Level',
      type: 'light',
      value: 450,
      unit: 'lux',
      status: 'normal',
      location: 'Work Bench',
      lastUpdate: new Date(),
      trend: 'stable',
      min: 300,
      max: 1000,
      average24h: 480,
      alerts: 0,
      history: generateHistory(450, 50)
    }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prevSensors => 
        prevSensors.map(sensor => {
          const change = (Math.random() - 0.5) * 0.5;
          const newValue = sensor.value + change;
          const newStatus = 
            newValue > sensor.max * 0.9 || newValue < sensor.min * 1.1 ? 'critical' :
            newValue > sensor.max * 0.8 || newValue < sensor.min * 1.2 ? 'warning' :
            'normal';
          
          return {
            ...sensor,
            value: newValue,
            status: newStatus,
            lastUpdate: new Date(),
            trend: change > 0.2 ? 'up' : change < -0.2 ? 'down' : 'stable'
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getSensorIcon = (type: Sensor['type']) => {
    const icons = {
      'temperature': <FaThermometerHalf className="text-orange-500" />,
      'humidity': <FaTint className="text-blue-500" />,
      'pressure': <FaWind className="text-gray-500" />,
      'power': <FaBolt className="text-yellow-500" />,
      'vibration': <FaChartLine className="text-purple-500" />,
      'air-quality': <FaWind className="text-green-500" />,
      'sound': <FaChartLine className="text-indigo-500" />,
      'light': <FaBolt className="text-amber-500" />
    };
    return icons[type] || <FaChartLine className="text-gray-500" />;
  };

  const getStatusIcon = (status: Sensor['status']) => {
    switch (status) {
      case 'normal': return <FaCheckCircle className="text-green-500" />;
      case 'warning': return <FaExclamationTriangle className="text-yellow-500" />;
      case 'critical': return <FaTimesCircle className="text-red-500" />;
      case 'offline': return <FaTimesCircle className="text-gray-400" />;
    }
  };

  const formatTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const filteredSensors = sensors.filter(sensor => {
    const matchesSearch = 
      sensor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sensor.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || sensor.type === filterType;
    const matchesStatus = filterStatus === 'all' || sensor.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Summary statistics
  const stats = {
    total: sensors.length,
    normal: sensors.filter(s => s.status === 'normal').length,
    warning: sensors.filter(s => s.status === 'warning').length,
    critical: sensors.filter(s => s.status === 'critical').length,
    offline: sensors.filter(s => s.status === 'offline').length,
    totalAlerts: sensors.reduce((sum, s) => sum + s.alerts, 0)
  };

  return (
    <div className="page-container">
      {/* Header - Fixed */}
      <div className="bg-white shadow-sm px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaChartLine className="text-green-600" />
            Sensor Dashboard
          </h1>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 transition-colors">
            <FaPlus /> Add Sensor
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow max-w-md">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sensors, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Types</option>
            <option value="temperature">Temperature</option>
            <option value="humidity">Humidity</option>
            <option value="pressure">Pressure</option>
            <option value="power">Power</option>
            <option value="vibration">Vibration</option>
            <option value="air-quality">Air Quality</option>
            <option value="sound">Sound</option>
            <option value="light">Light</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="normal">Normal</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {/* Status Summary */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-green-600 text-sm">Normal</p>
            <p className="text-2xl font-bold text-green-800">{stats.normal}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-yellow-600 text-sm">Warning</p>
            <p className="text-2xl font-bold text-yellow-800">{stats.warning}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-red-600 text-sm">Critical</p>
            <p className="text-2xl font-bold text-red-800">{stats.critical}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-600 text-sm">Offline</p>
            <p className="text-2xl font-bold text-gray-800">{stats.offline}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-purple-600 text-sm">Total Alerts</p>
            <p className="text-2xl font-bold text-purple-800">{stats.totalAlerts}</p>
          </div>
        </div>
      </div>

      {/* Sensors Grid - Scrollable */}
      <div className="page-content">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSensors.map((sensor) => (
            <div 
              key={sensor.id} 
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow animate-fadeIn cursor-pointer"
              onClick={() => setSelectedSensor(selectedSensor === sensor.id ? null : sensor.id)}
            >
              <div className="p-6">
                {/* Sensor Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getSensorIcon(sensor.type)}</div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{sensor.name}</h3>
                      <p className="text-sm text-gray-500">{sensor.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(sensor.status)}
                    <span className="text-xs text-gray-500">{formatTime(sensor.lastUpdate)}</span>
                  </div>
                </div>

                {/* Current Value */}
                <div className="text-center mb-4">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {sensor.value.toFixed(sensor.unit === 'hPa' ? 2 : 1)}
                    </span>
                    <span className="text-lg text-gray-600">{sensor.unit}</span>
                    {sensor.trend === 'up' && <span className="text-red-500 text-xl">↑</span>}
                    {sensor.trend === 'down' && <span className="text-blue-500 text-xl">↓</span>}
                    {sensor.trend === 'stable' && <span className="text-gray-500 text-xl">→</span>}
                  </div>
                  
                  {/* Min/Max Range */}
                  <div className="mt-2 px-8">
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`absolute h-2 rounded-full ${
                            sensor.status === 'normal' ? 'bg-green-500' :
                            sensor.status === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{
                            left: `${((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100}%`,
                            width: '4px'
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{sensor.min}{sensor.unit}</span>
                        <span>{sensor.max}{sensor.unit}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">24h Average</p>
                    <p className="font-medium text-gray-800">
                      {sensor.average24h.toFixed(1)} {sensor.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Alerts (24h)</p>
                    <p className={`font-medium ${sensor.alerts > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {sensor.alerts}
                    </p>
                  </div>
                </div>

                {/* Chart - Show when selected */}
                {selectedSensor === sensor.id && sensor.history && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                      <FaHistory /> 24 Hour History
                    </p>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sensor.history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="time" 
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }}
                            domain={[sensor.min, sensor.max]}
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: 12 }}
                            formatter={(value: number) => `${value.toFixed(1)} ${sensor.unit}`}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={
                              sensor.status === 'normal' ? '#10b981' :
                              sensor.status === 'warning' ? '#f59e0b' :
                              '#ef4444'
                            }
                            fill={
                              sensor.status === 'normal' ? '#10b98133' :
                              sensor.status === 'warning' ? '#f59e0b33' :
                              '#ef444433'
                            }
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <button className="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                    Configure
                  </button>
                  <button className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SensorsPage;