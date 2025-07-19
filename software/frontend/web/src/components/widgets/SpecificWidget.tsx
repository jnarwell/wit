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
  onNavigate?: () => void;
  style?: React.CSSProperties;
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
      case 'project': return <FaProjectDiagram className="w-6 h-6" />;
      case 'machine': return <FaCog className="w-6 h-6" />;
      case 'sensor': return <FaMicrochip className="w-6 h-6" />;
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
    <div className="h-full relative group" style={style}>
      <div 
        className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all cursor-pointer select-none"
        onClick={onNavigate ? (e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button')) {
            onNavigate();
          }
        } : undefined}
      >
        {/* Widget header */}
        <div className={`bg-gradient-to-r ${getTypeColor()} p-3`}>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="text-white opacity-90">
                {getIcon()}
              </div>
              <h3 className="text-white font-medium truncate">
                {widgetData.name}
              </h3>
            </div>
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          </div>
        </div>
        
        {/* Widget body */}
        <div className="p-4">
          {widgetData.metrics && widgetData.metrics.length > 0 && (
            <div className="space-y-2">
              {widgetData.metrics.map((metric, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{metric.label}:</span>
                  <span className="text-white text-sm font-medium">{metric.value}</span>
                </div>
              ))}
            </div>
          )}
          
          {(!widgetData.metrics || widgetData.metrics.length === 0) && (
            <div className="text-center text-gray-500">
              No data available
            </div>
          )}
          
          {/* Widget ID */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-center text-gray-500 text-xs">
              ID: {widgetData.id}
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete button - absolute positioned at top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white rounded p-1.5 z-10"
        aria-label="Delete widget"
      >
        <FaTimes className="w-3 h-3" />
      </button>
    </div>
  );
};

export default SpecificWidget;