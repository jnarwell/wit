// src/components/widgets/UtilityWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaMicrochip, FaMemory, FaHdd, FaNetworkWired, FaThermometerHalf } from 'react-icons/fa';

interface UtilityWidgetProps {
  type: 'cpu' | 'ram' | 'disk' | 'network' | 'temp' | 'machine-status' | 'sensor-data' | 'project-progress' | 'script-results';
  onRemove: () => void;
  width?: number; // Grid units
  height?: number; // Grid units
  data?: any; // Additional data for specific widgets
}

const UtilityWidget: React.FC<UtilityWidgetProps> = ({ type, onRemove, width = 1, height = 1, data }) => {
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
      const baseValue = baseValues[type] || 45;
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
  }, [type]);

  const getConfig = () => {
    switch (type) {
      case 'cpu':
        return {
          icon: FaMicrochip,
          label: 'CPU Usage',
          unit: '%',
          color: 'from-cyan-600 to-cyan-700',
          bgColor: 'bg-cyan-600'
        };
      case 'ram':
        return {
          icon: FaMemory,
          label: 'RAM Usage',
          unit: '%',
          color: 'from-pink-600 to-pink-700',
          bgColor: 'bg-pink-600'
        };
      case 'disk':
        return {
          icon: FaHdd,
          label: 'Disk Space',
          unit: '%',
          color: 'from-amber-600 to-amber-700',
          bgColor: 'bg-amber-600'
        };
      case 'network':
        return {
          icon: FaNetworkWired,
          label: 'Network',
          unit: 'Mbps',
          color: 'from-green-600 to-green-700',
          bgColor: 'bg-green-600'
        };
      case 'temp':
        return {
          icon: FaThermometerHalf,
          label: 'Temperature',
          unit: '°C',
          color: 'from-red-600 to-red-700',
          bgColor: 'bg-red-600'
        };
      default:
        return {
          icon: FaMicrochip,
          label: 'Unknown',
          unit: '%',
          color: 'from-gray-600 to-gray-700',
          bgColor: 'bg-gray-600'
        };
    }
  };

  const config = getConfig();
  const displayValue = type === 'network' ? value.toFixed(0) : type === 'temp' ? (value * 0.8 + 20).toFixed(1) : value.toFixed(0);
  
  // Determine if widget is compact
  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const getStatusColor = () => {
    if (type === 'temp') {
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

  // Dynamic sizing based on widget dimensions
  const iconSize = isCompact ? 20 : isMedium ? 24 : 32;
  const headerPadding = isCompact ? 'p-2' : 'p-3';
  const contentPadding = isCompact ? 'p-3' : isMedium ? 'p-4' : 'p-5';
  const labelSize = isCompact ? 'text-xs' : 'text-sm';
  const valueSize = isCompact ? 'text-2xl' : isMedium ? 'text-3xl' : 'text-4xl';
  const unitSize = isCompact ? 'text-xs' : 'text-sm';
  const progressHeight = isCompact ? 'h-1.5' : 'h-2';
  const additionalInfoSize = 'text-xs';
  const Icon = config.icon;

  return (
    <div className="widget-container group h-full">{/* Removed style prop */}
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.color} ${headerPadding} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Icon size={iconSize} />
              {!isCompact && <span className={`font-medium ${labelSize}`}>{config.label}</span>}
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
        <div className={`${contentPadding} flex-1 flex flex-col justify-between`}>
          {/* Label (for compact mode since it's not in header) */}
          {isCompact && <h3 className={`text-gray-400 ${labelSize} mb-2`}>{config.label}</h3>}
          
          {/* Value Display */}
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-baseline gap-1">
              <span className={`${valueSize} font-bold ${getStatusColor()}`}>
                {displayValue}
              </span>
              <span className={`text-gray-400 ${unitSize}`}>{config.unit}</span>
            </div>
            {!isCompact && (
              <span className={`text-lg ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-gray-400'}`}>
                {getTrendIcon()}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className={`w-full bg-gray-700 rounded-full ${progressHeight} overflow-hidden`}>
            <div 
              className={`h-full ${config.bgColor} transition-all duration-500 ease-out`}
              style={{ width: `${type === 'network' ? Math.min(value, 100) : value}%` }}
            />
          </div>

          {/* Additional Info */}
          {!isCompact && (
            <div className={`mt-2 flex justify-between ${additionalInfoSize} text-gray-500`}>
              <span>Min: 0</span>
              <span>Max: {type === 'network' ? '100' : type === 'temp' ? '100°C' : '100%'}</span>
            </div>
          )}

          {/* Extra stats for large widgets */}
          {isLarge && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Average:</span>
                  <span className="text-gray-300 ml-1">{(baseValues[type] || 50).toFixed(0)}{config.unit}</span>
                </div>
                <div>
                  <span className="text-gray-500">Peak:</span>
                  <span className="text-gray-300 ml-1">{Math.min(100, (baseValues[type] || 50) + 15).toFixed(0)}{config.unit}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to get base values - moved inside component to avoid reference error
const baseValues: Record<string, number> = {
  cpu: 45,
  ram: 60,
  disk: 75,
  network: 30,
  temp: 65
};

export default UtilityWidget;