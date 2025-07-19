// src/components/widgets/SpecificWidget.tsx
import React from 'react';
import { FaTimes, FaCog, FaProjectDiagram, FaMicrochip } from 'react-icons/fa';

interface SpecificWidgetProps {
  type: 'project' | 'machine' | 'sensor';
  data?: any;
  onRemove: () => void;
  onNavigate?: () => void;
  style?: React.CSSProperties;
}

const SpecificWidget: React.FC<SpecificWidgetProps> = ({ type, data, onRemove, onNavigate, style }) => {
  // Default data if none provided
  const widgetData = data || {
    id: '001',
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Alpha`,
    type: type === 'project' ? 'software' : type === 'machine' ? '3d-printer' : 'temperature',
    status: 'green' as const,
    metrics: [
      { label: 'Uptime', value: '99.9%' },
      { label: 'Efficiency', value: '87%' }
    ]
  };

  const getIcon = () => {
    switch (type) {
      case 'project': return <FaProjectDiagram className="w-5 h-5" />;
      case 'machine': return <FaCog className="w-5 h-5" />;
      case 'sensor': return <FaMicrochip className="w-5 h-5" />;
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

  // Format type display name
  const formatTypeName = (rawType: string) => {
    if (!rawType) return 'Unknown';
    
    // Handle hyphenated types (e.g., '3d-printer' -> '3D Printer')
    return rawType
      .split('-')
      .map(word => {
        if (word === '3d') return '3D';
        if (word === 'cnc') return 'CNC';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  // Get relevant details based on type
  const getRelevantDetails = () => {
    const details: { label: string; value: string }[] = [];
    
    if (type === 'machine' && widgetData) {
      if (widgetData.manufacturer) {
        details.push({ label: 'Manufacturer', value: widgetData.manufacturer });
      }
      if (widgetData.model) {
        details.push({ label: 'Model', value: widgetData.model });
      }
      if (widgetData.connectionType) {
        details.push({ label: 'Connection', value: widgetData.connectionType.toUpperCase() });
      }
    } else if (type === 'sensor' && widgetData) {
      if (widgetData.manufacturer) {
        details.push({ label: 'Manufacturer', value: widgetData.manufacturer });
      }
      if (widgetData.connectionType) {
        const connectionLabels: Record<string, string> = {
          'i2c': 'I²C',
          'spi': 'SPI',
          'analog': 'Analog',
          'digital': 'Digital',
          'uart': 'UART',
          'wireless': 'Wireless'
        };
        details.push({ 
          label: 'Connection', 
          value: connectionLabels[widgetData.connectionType] || widgetData.connectionType?.toUpperCase() 
        });
      }
      if (widgetData.connectionDetails) {
        details.push({ label: 'Address', value: widgetData.connectionDetails });
      }
    } else if (type === 'project' && widgetData) {
      if (widgetData.team) {
        details.push({ label: 'Team', value: widgetData.team });
      }
      if (widgetData.priority) {
        details.push({ 
          label: 'Priority', 
          value: widgetData.priority.charAt(0).toUpperCase() + widgetData.priority.slice(1) 
        });
      }
      if (widgetData.deadline) {
        const deadline = new Date(widgetData.deadline);
        const today = new Date();
        const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        details.push({ 
          label: 'Deadline', 
          value: daysUntil > 0 ? `${daysUntil} days` : 'Overdue' 
        });
      }
    }
    
    return details;
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Check if clicking on interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    
    if (!isInteractive && onNavigate) {
      onNavigate();
    }
  };

  const relevantDetails = getRelevantDetails();
  const allMetrics = [...(widgetData.metrics || []), ...relevantDetails];

  return (
    <div className="h-full relative group" style={{ position: 'relative', ...style }}>
      {/* Main content */}
      <div 
        className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all cursor-pointer select-none"
        onClick={handleContentClick}
      >
        {/* Widget header */}
        <div className={`bg-gradient-to-r ${getTypeColor()} p-3`}>
          <div className="flex items-center justify-between">
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
        
        {/* Type Badge */}
        <div className="px-4 pt-3 pb-1">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
            {formatTypeName(widgetData.type)}
          </div>
        </div>
        
        {/* Widget body */}
        <div className="px-4 pb-4">
          {allMetrics.length > 0 && (
            <div className="space-y-1.5 mt-3">
              {allMetrics.slice(0, 4).map((metric, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">{metric.label}:</span>
                  <span className="text-white text-xs font-medium truncate ml-2" style={{ maxWidth: '60%' }}>
                    {metric.value}
                  </span>
                </div>
              ))}
              {allMetrics.length > 4 && (
                <div className="text-center text-gray-500 text-xs mt-1">
                  +{allMetrics.length - 4} more...
                </div>
              )}
            </div>
          )}
          
          {allMetrics.length === 0 && (
            <div className="text-center text-gray-500 text-sm mt-3">
              No data available
            </div>
          )}
        </div>
      </div>
      
      {/* Delete button - absolute positioned overlay */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
        onMouseDown={(e) => {
          // Prevent drag from starting on button
          e.stopPropagation();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-600 hover:bg-red-700 text-white rounded p-1.5 shadow-lg"
        style={{
          zIndex: 50,
        }}
        aria-label="Delete widget"
      >
        <FaTimes className="w-3 h-3" />
      </button>
    </div>
  );
};

export default SpecificWidget;