import React, { useState, useEffect } from 'react';
import { FaTimes, FaCog, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

interface MachineStatusWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    machineId?: string;
    machineName?: string;
  };
}

const MachineStatusWidget: React.FC<MachineStatusWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [selectedMachine, setSelectedMachine] = useState(data?.machineId || '');
  const [status, setStatus] = useState<'running' | 'idle' | 'maintenance' | 'error'>('idle');
  const [efficiency, setEfficiency] = useState(0);
  const [runtime, setRuntime] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate real-time updates
  useEffect(() => {
    const updateStatus = () => {
      // Simulate different statuses
      const statuses: Array<'running' | 'idle' | 'maintenance' | 'error'> = ['running', 'idle', 'maintenance', 'error'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length * 0.7)]; // Bias towards running
      setStatus(randomStatus);
      
      // Update efficiency based on status
      if (randomStatus === 'running') {
        setEfficiency(85 + Math.random() * 10);
      } else if (randomStatus === 'idle') {
        setEfficiency(0);
      } else if (randomStatus === 'maintenance') {
        setEfficiency(0);
      } else {
        setEfficiency(Math.random() * 50);
      }
      
      // Update runtime
      setRuntime(prev => prev + (randomStatus === 'running' ? 5 : 0));
      setLastUpdate(new Date());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  const getStatusConfig = () => {
    switch (status) {
      case 'running':
        return { icon: FaCheckCircle, color: 'text-green-400', bgColor: 'bg-green-600', label: 'Running' };
      case 'idle':
        return { icon: FaCog, color: 'text-gray-400', bgColor: 'bg-gray-600', label: 'Idle' };
      case 'maintenance':
        return { icon: FaExclamationTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-600', label: 'Maintenance' };
      case 'error':
        return { icon: FaTimesCircle, color: 'text-red-400', bgColor: 'bg-red-600', label: 'Error' };
    }
  };

  const statusConfig = getStatusConfig();
  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-blue-600 to-blue-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <FaCog size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Machine Status</span>}
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
          {/* Machine Selector */}
          {!data?.machineId && (
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full mb-3 bg-gray-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="">Select Machine</option>
              <option value="machine-1">CNC Mill #1</option>
              <option value="machine-2">3D Printer #2</option>
              <option value="machine-3">Laser Cutter #3</option>
            </select>
          )}

          {/* Machine Name */}
          {(selectedMachine || data?.machineId) && (
            <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-white mb-2`}>
              {data?.machineName || 'CNC Mill #1'}
            </h3>
          )}

          {/* Status Display */}
          <div className="flex items-center gap-2 mb-3">
            <statusConfig.icon className={`${statusConfig.color} ${isCompact ? 'text-lg' : 'text-xl'}`} />
            <span className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-white`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Efficiency */}
          {status === 'running' && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Efficiency</span>
                <span>{efficiency.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full ${statusConfig.bgColor} transition-all duration-500`}
                  style={{ width: `${efficiency}%` }}
                />
              </div>
            </div>
          )}

          {/* Runtime */}
          {!isCompact && (
            <div className="text-xs text-gray-400">
              <div className="flex justify-between mb-1">
                <span>Runtime:</span>
                <span>{formatRuntime(runtime)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Update:</span>
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          {/* Additional details for larger widgets */}
          {isLarge && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Today's Output:</span>
                  <span className="text-gray-300 ml-1">245 units</span>
                </div>
                <div>
                  <span className="text-gray-500">Error Rate:</span>
                  <span className="text-gray-300 ml-1">0.3%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MachineStatusWidget;