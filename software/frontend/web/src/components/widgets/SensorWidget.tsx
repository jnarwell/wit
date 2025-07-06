// src/components/widgets/SensorWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaChartLine, FaThermometerHalf, FaTint, FaWind, FaBolt } from 'react-icons/fa';

interface SensorWidgetProps {
  onRemove?: () => void;
}

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'power' | 'vibration' | 'air-quality';
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  location: string;
  lastUpdate: Date;
  trend?: 'up' | 'down' | 'stable';
  min?: number;
  max?: number;
}

const SensorWidget: React.FC<SensorWidgetProps> = ({ onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
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
      max: 26
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
      max: 60
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
      trend: 'down'
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
      trend: 'up'
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
      max: 0.5
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
      trend: 'stable'
    }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prevSensors => 
        prevSensors.map(sensor => ({
          ...sensor,
          value: sensor.value + (Math.random() - 0.5) * 0.5,
          lastUpdate: new Date(),
          trend: Math.random() > 0.7 ? 
            (Math.random() > 0.5 ? 'up' : 'down') : 
            sensor.trend
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getSensorIcon = (type: Sensor['type']) => {
    switch (type) {
      case 'temperature': return <FaThermometerHalf className="text-orange-500" />;
      case 'humidity': return <FaTint className="text-blue-500" />;
      case 'pressure': return <FaWind className="text-gray-500" />;
      case 'power': return <FaBolt className="text-yellow-500" />;
      case 'vibration': return <FaChartLine className="text-purple-500" />;
      case 'air-quality': return <FaWind className="text-green-500" />;
      default: return <FaChartLine className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: Sensor['status']) => {
    switch (status) {
      case 'normal': return 'text-green-500 bg-green-50';
      case 'warning': return 'text-yellow-500 bg-yellow-50';
      case 'critical': return 'text-red-500 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getTrendIcon = (trend?: Sensor['trend']) => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'stable': return '→';
      default: return '';
    }
  };

  const formatTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FaChartLine className="text-green-600" />
          <h3 className="text-lg font-semibold text-gray-800">Sensors</h3>
        </div>
        {onRemove && isHovered && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove widget"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Sensor List - Scrollable */}
      <div className="widget-content flex-grow">
        <div className="space-y-3">
          {sensors.map((sensor) => (
            <div 
              key={sensor.id} 
              className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow animate-fadeIn"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-grow">
                  <div className="mt-1">{getSensorIcon(sensor.type)}</div>
                  <div className="flex-grow">
                    <h4 className="font-medium text-gray-800 text-sm">{sensor.name}</h4>
                    <p className="text-xs text-gray-500">{sensor.location}</p>
                    
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-gray-900">
                        {sensor.value.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-600">{sensor.unit}</span>
                      {sensor.trend && (
                        <span className={`text-sm font-bold ${
                          sensor.trend === 'up' ? 'text-red-500' : 
                          sensor.trend === 'down' ? 'text-blue-500' : 
                          'text-gray-500'
                        }`}>
                          {getTrendIcon(sensor.trend)}
                        </span>
                      )}
                    </div>

                    {/* Min/Max indicator */}
                    {(sensor.min !== undefined || sensor.max !== undefined) && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1 relative">
                          <div 
                            className={`absolute h-1 rounded-full ${
                              sensor.status === 'normal' ? 'bg-green-500' :
                              sensor.status === 'warning' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{
                              left: sensor.min ? `${((sensor.value - sensor.min) / ((sensor.max || 100) - sensor.min)) * 100}%` : '0%',
                              width: '2px',
                              height: '100%'
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                          <span>{sensor.min}</span>
                          <span>{sensor.max}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(sensor.status)}`}>
                    {sensor.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTime(sensor.lastUpdate)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Alerts:</span>
          <div className="flex gap-3">
            <span className="text-yellow-600 font-medium">
              {sensors.filter(s => s.status === 'warning').length} Warning
            </span>
            <span className="text-red-600 font-medium">
              {sensors.filter(s => s.status === 'critical').length} Critical
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensorWidget;