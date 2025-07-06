// src/components/widgets/SpecificWidget.tsx
import React from 'react';
import { FaTimes, FaCog, FaProjectDiagram, FaMicrochip } from 'react-icons/fa';

interface SpecificWidgetProps {
  type: 'project' | 'machine' | 'sensor';
  data?: {
    id: string;
    name: string;
    status: 'green' | 'yellow' | 'red';
    metrics?: { label: string; value: string }[];
    image?: string;
  };
  onRemove: () => void;
  onNavigate: () => void;
  style: React.CSSProperties;
}

const SpecificWidget: React.FC<SpecificWidgetProps> = ({ type, data, onRemove, onNavigate, style }) => {
  // Default data if none provided
  const widgetData = data || {
    id: '001',
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Alpha`,
    status: 'green' as const,
    metrics: [
      { label: 'Uptime', value: '99.9%' },
      { label: 'Efficiency', value: '87%' }
    ]
  };

  const getIcon = () => {
    switch (type) {
      case 'project': return <FaProjectDiagram size={24} />;
      case 'machine': return <FaCog size={24} />;
      case 'sensor': return <FaMicrochip size={24} />;
    }
  };

  const getStatusColor = () => {
    switch (widgetData.status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'project': return 'from-blue-600 to-blue-700';
      case 'machine': return 'from-purple-600 to-purple-700';
      case 'sensor': return 'from-teal-600 to-teal-700';
    }
  };

  return (
    <div style={style} className="widget-container group">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all cursor-pointer" onClick={onNavigate}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${getTypeColor()} p-3 relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              {getIcon()}
              <span className="font-semibold text-sm capitalize">{type}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Name and Status */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-lg truncate flex-1">{widgetData.name}</h3>
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
          </div>

          {/* Image or Icon */}
          <div className="flex justify-center mb-3">
            {widgetData.image ? (
              <img src={widgetData.image} alt={widgetData.name} className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                {getIcon()}
              </div>
            )}
          </div>

          {/* Metrics */}
          {widgetData.metrics && widgetData.metrics.length > 0 && (
            <div className="space-y-1">
              {widgetData.metrics.slice(0, 2).map((metric, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-400">{metric.label}:</span>
                  <span className="text-white font-medium">{metric.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpecificWidget;