import React, { useState, useEffect } from 'react';
import { FaTimes, FaThermometerHalf, FaWater, FaTachometerAlt, FaBolt } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SensorDataWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    sensorId?: string;
    sensorName?: string;
    sensorType?: 'temperature' | 'pressure' | 'flow' | 'voltage';
  };
}

const SensorDataWidget: React.FC<SensorDataWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [selectedSensor, setSelectedSensor] = useState(data?.sensorId || '');
  const [sensorType, setSensorType] = useState<'temperature' | 'pressure' | 'flow' | 'voltage'>(data?.sensorType || 'temperature');
  const [currentValue, setCurrentValue] = useState(0);
  const [dataHistory, setDataHistory] = useState<number[]>([]);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);

  // Simulate real-time sensor data
  useEffect(() => {
    const updateSensorData = () => {
      const baseValues = {
        temperature: 25,
        pressure: 101.3,
        flow: 50,
        voltage: 12
      };
      
      const variances = {
        temperature: 5,
        pressure: 10,
        flow: 20,
        voltage: 2
      };

      const base = baseValues[sensorType];
      const variance = variances[sensorType];
      const newValue = base + (Math.random() * variance - variance / 2);
      
      setCurrentValue(newValue);
      setDataHistory(prev => [...prev.slice(-19), newValue]);
      setTimeLabels(prev => [...prev.slice(-19), new Date().toLocaleTimeString()]);
    };

    // Initialize with some data
    for (let i = 0; i < 20; i++) {
      updateSensorData();
    }

    const interval = setInterval(updateSensorData, 2000);
    return () => clearInterval(interval);
  }, [sensorType, selectedSensor]);

  const getSensorConfig = () => {
    switch (sensorType) {
      case 'temperature':
        return {
          icon: FaThermometerHalf,
          label: 'Temperature',
          unit: '°C',
          color: 'from-orange-600 to-orange-700',
          chartColor: 'rgb(251, 146, 60)',
          min: 0,
          max: 50
        };
      case 'pressure':
        return {
          icon: FaTachometerAlt,
          label: 'Pressure',
          unit: 'kPa',
          color: 'from-purple-600 to-purple-700',
          chartColor: 'rgb(147, 51, 234)',
          min: 80,
          max: 120
        };
      case 'flow':
        return {
          icon: FaWater,
          label: 'Flow Rate',
          unit: 'L/min',
          color: 'from-blue-600 to-blue-700',
          chartColor: 'rgb(59, 130, 246)',
          min: 0,
          max: 100
        };
      case 'voltage':
        return {
          icon: FaBolt,
          label: 'Voltage',
          unit: 'V',
          color: 'from-yellow-600 to-yellow-700',
          chartColor: 'rgb(251, 191, 36)',
          min: 0,
          max: 24
        };
    }
  };

  const config = getSensorConfig();
  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const chartData = {
    labels: timeLabels,
    datasets: [
      {
        label: config.label,
        data: dataHistory,
        borderColor: config.chartColor,
        backgroundColor: config.chartColor + '20',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: !isCompact
      }
    },
    scales: {
      x: {
        display: !isCompact,
        grid: {
          display: false
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 10
          },
          maxTicksLimit: 5
        }
      },
      y: {
        display: !isCompact,
        min: config.min,
        max: config.max,
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 10
          }
        }
      }
    }
  };

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.color} ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <config.icon size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Sensor Data</span>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={isCompact ? 14 : 16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex-1 flex flex-col`}>
          {/* Sensor Selector */}
          {!data?.sensorId && (
            <div className="mb-3 space-y-2">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
              >
                <option value="">Select Sensor</option>
                <option value="sensor-1">Temperature Sensor #1</option>
                <option value="sensor-2">Pressure Sensor #2</option>
                <option value="sensor-3">Flow Sensor #3</option>
              </select>
              {!isCompact && (
                <select
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value as any)}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="temperature">Temperature</option>
                  <option value="pressure">Pressure</option>
                  <option value="flow">Flow Rate</option>
                  <option value="voltage">Voltage</option>
                </select>
              )}
            </div>
          )}

          {/* Sensor Name */}
          {(selectedSensor || data?.sensorId) && (
            <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-white mb-2`}>
              {data?.sensorName || 'Temperature Sensor #1'}
            </h3>
          )}

          {/* Current Value */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-white`}>
                {currentValue.toFixed(1)}
              </span>
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-400 ml-1`}>
                {config.unit}
              </span>
            </div>
            {!isCompact && (
              <span className="text-xs text-gray-500">
                {config.label}
              </span>
            )}
          </div>

          {/* Chart */}
          {!isCompact && (
            <div className="flex-1 min-h-0">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}

          {/* Min/Max for compact view */}
          {isCompact && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Min: {config.min}</span>
              <span>Max: {config.max}</span>
            </div>
          )}

          {/* Additional stats for large widgets */}
          {isLarge && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Average:</span>
                  <span className="text-gray-300 ml-1">
                    {(dataHistory.reduce((a, b) => a + b, 0) / dataHistory.length).toFixed(1)} {config.unit}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Trend:</span>
                  <span className="text-gray-300 ml-1">
                    {dataHistory[dataHistory.length - 1] > dataHistory[dataHistory.length - 2] ? '↑' : '↓'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorDataWidget;