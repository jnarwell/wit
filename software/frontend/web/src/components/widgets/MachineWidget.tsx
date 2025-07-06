import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface Machine {
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  job?: string;
}

interface MachineWidgetProps {
  onRemove?: () => void;
}

const MachineWidget: React.FC<MachineWidgetProps> = ({ onRemove }) => {
  const machines: Machine[] = [
    { name: 'PRUSA_MK3S', status: 'ONLINE' },
    { name: 'CNC_ROUTER', status: 'OFFLINE' },
    { name: 'LASER_CUTTER', status: 'BUSY', job: 'PANEL_CUT_42' },
    { name: 'RESIN_PRINTER', status: 'ONLINE' },
    { name: 'VINYL_CUTTER', status: 'ONLINE' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'text-green-600 bg-green-50';
      case 'OFFLINE': return 'text-gray-600 bg-gray-50';
      case 'BUSY': return 'text-amber-600 bg-amber-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-800">Machines</h3>
        {onRemove && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 hover:bg-red-600 text-white p-2 rounded-md"
            style={{ touchAction: 'none' }}
          >
            <FaTimes className="text-sm" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {machines.map((machine) => (
            <div key={machine.name} className="p-3 bg-gray-50 rounded-md">
              <div className="font-medium text-gray-900 text-sm">{machine.name.replace(/_/g, ' ')}</div>
              <div className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getStatusColor(machine.status)}`}>
                {machine.status}
              </div>
              {machine.job && (
                <div className="text-xs text-gray-600 mt-1">Job: {machine.job.replace(/_/g, ' ')}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MachineWidget;