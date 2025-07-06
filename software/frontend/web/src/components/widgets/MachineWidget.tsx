// src/components/widgets/MachineWidget.tsx
import React, { useState } from 'react';
import { FaTimes, FaCog, FaCircle } from 'react-icons/fa';

interface MachineWidgetProps {
  onRemove?: () => void;
}

interface Machine {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  currentJob?: {
    name: string;
    progress: number;
    timeRemaining: string;
  };
  type: string;
}

const MachineWidget: React.FC<MachineWidgetProps> = ({ onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Mock data - replace with real data from WebSocket/API
  const machines: Machine[] = [
    {
      id: '1',
      name: 'Prusa MK3S+',
      type: '3D Printer',
      status: 'busy',
      currentJob: {
        name: 'Widget Assembly v2',
        progress: 67,
        timeRemaining: '1h 23m'
      }
    },
    {
      id: '2',
      name: 'Ender 3 Pro',
      type: '3D Printer',
      status: 'online'
    },
    {
      id: '3',
      name: 'Shapeoko 4',
      type: 'CNC Mill',
      status: 'offline'
    },
    {
      id: '4',
      name: 'Glowforge Pro',
      type: 'Laser Cutter',
      status: 'maintenance'
    },
    {
      id: '5',
      name: 'Form 3',
      type: 'SLA Printer',
      status: 'online'
    }
  ];

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-gray-400';
      case 'busy': return 'text-yellow-500';
      case 'maintenance': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: Machine['status']) => {
    switch (status) {
      case 'online': return 'Ready';
      case 'offline': return 'Offline';
      case 'busy': return 'Working';
      case 'maintenance': return 'Maintenance';
      default: return 'Unknown';
    }
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
          <FaCog className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Machines</h3>
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

      {/* Machine List - Scrollable */}
      <div className="widget-content flex-grow">
        <div className="space-y-3">
          {machines.map((machine) => (
            <div 
              key={machine.id} 
              className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow animate-fadeIn"
            >
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <FaCircle className={`text-xs ${getStatusColor(machine.status)}`} />
                    <h4 className="font-medium text-gray-800">{machine.name}</h4>
                  </div>
                  <p className="text-sm text-gray-500">{machine.type}</p>
                  
                  {machine.status === 'busy' && machine.currentJob && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 truncate">
                        {machine.currentJob.name}
                      </p>
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{machine.currentJob.progress}%</span>
                          <span>{machine.currentJob.timeRemaining}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${machine.currentJob.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {getStatusText(machine.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Machines:</span>
          <span className="font-medium text-gray-800">{machines.length}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-600">Active:</span>
          <span className="font-medium text-green-600">
            {machines.filter(m => m.status === 'online' || m.status === 'busy').length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MachineWidget;