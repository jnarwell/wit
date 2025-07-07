// src/components/widgets/UtilityWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaMicrochip, FaMemory, FaHdd, FaNetworkWired, FaThermometerHalf } from 'react-icons/fa';

interface UtilityWidgetProps {
  subType: 'cpu' | 'ram' | 'disk' | 'network' | 'temp';
  onRemove: () => void;
  style: React.CSSProperties;
}

const UtilityWidget: React.FC<UtilityWidgetProps> = ({ subType, onRemove, style }) => {
  const [value, setValue] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  // Simulate real-time updates
  useEffect(() => {
    const updateValue = () => {
      const baseValues: Record<string, number> = {
        cpu: 45,
        ram: 60,
        disk: 75,
        network: 30,
        temp: 65
      };

      const variance = 15;
      const baseValue = baseValues[subType] || 45; // Default to CPU value if invalid
      const newValue = baseValue + (Math.random() * variance - variance / 2);
      const clampedValue = Math.max(0, Math.min(100, newValue));
      
      setValue(prev => {
        const diff = clampedValue - prev;
        if (diff > 5) setTrend('up');
        else if (diff < -5) setTrend('down');
        else setTrend('stable');
        return clampedValue;
      });
    };

    updateValue();
    const interval = setInterval(updateValue, 3000);
    return () => clearInterval(interval);
  }, [subType]);

  const getConfig = () => {
    switch (subType) {
      case 'cpu':
        return {
          icon: <FaMicrochip size={24} />,
          label: 'CPU Usage',
          unit: '%',
          color: 'from-cyan-600 to-cyan-700',
          bgColor: 'bg-cyan-600'
        };
      case 'ram':
        return {
          icon: <FaMemory size={24} />,
          label: 'RAM Usage',
          unit: '%',
          color: 'from-pink-600 to-pink-700',
          bgColor: 'bg-pink-600'
        };
      case 'disk':
        return {
          icon: <FaHdd size={24} />,
          label: 'Disk Space',
          unit: '%',
          color: 'from-amber-600 to-amber-700',
          bgColor: 'bg-amber-600'
        };
      case 'network':
        return {
          icon: <FaNetworkWired size={24} />,
          label: 'Network',
          unit: 'Mbps',
          color: 'from-green-600 to-green-700',
          bgColor: 'bg-green-600'
        };
      case 'temp':
        return {
          icon: <FaThermometerHalf size={24} />,
          label: 'Temperature',
          unit: '°C',
          color: 'from-red-600 to-red-700',
          bgColor: 'bg-red-600'
        };
      default:
        // Default to CPU if invalid subType
        return {
          icon: <FaMicrochip size={24} />,
          label: 'CPU Usage',
          unit: '%',
          color: 'from-cyan-600 to-cyan-700',
          bgColor: 'bg-cyan-600'
        };
    }
  };

  const config = getConfig();
  const displayValue = subType === 'network' ? value.toFixed(0) : subType === 'temp' ? (value * 0.8 + 20).toFixed(1) : value.toFixed(0);

  const getStatusColor = () => {
    if (subType === 'temp') {
      const temp = parseFloat(displayValue);
      if (temp > 80) return 'text-red-400';
      if (temp > 70) return 'text-yellow-400';
      return 'text-green-400';
    }
    
    if (value > 80) return 'text-red-400';
    if (value > 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  return (
    <div style={style} className="widget-container group">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.color} p-3 relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              {config.icon}
            </div>
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Label */}
          <h3 className="text-gray-400 text-sm mb-2">{config.label}</h3>

          {/* Value Display */}
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${getStatusColor()}`}>
                {displayValue}
              </span>
              <span className="text-gray-400 text-sm">{config.unit}</span>
            </div>
            <span className={`text-lg ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-gray-400'}`}>
              {getTrendIcon()}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full ${config.bgColor} transition-all duration-500 ease-out`}
              style={{ width: `${subType === 'network' ? Math.min(value, 100) : value}%` }}
            />
          </div>

          {/* Additional Info */}
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>Min: 0</span>
            <span>Max: {subType === 'network' ? '100' : subType === 'temp' ? '100°C' : '100%'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UtilityWidget;