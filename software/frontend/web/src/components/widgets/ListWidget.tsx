// src/components/widgets/ListWidget.tsx
import React, { useState, useMemo } from 'react';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ListWidgetProps {
  type: 'projects' | 'machines' | 'sensors';
  onRemove?: () => void;
  onNavigate?: (page: string) => void;
  height?: number; // Height in grid units
}

const ListWidget: React.FC<ListWidgetProps> = ({ type, onRemove, onNavigate, height = 1 }) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const configs = {
    projects: {
      title: 'Projects',
      items: [
        { id: 'P001', name: 'Widget Production', status: 'Active' },
        { id: 'P002', name: 'Client Dashboard', status: 'In Progress' },
        { id: 'P003', name: 'Prototype Alpha', status: 'Planning' },
        { id: 'P004', name: 'Research Phase 2', status: 'On Hold' },
        { id: 'P005', name: 'Manufacturing Line', status: 'Active' },
        { id: 'P006', name: 'Quality Control', status: 'Review' },
        { id: 'P007', name: 'Customer Portal', status: 'Active' },
        { id: 'P008', name: 'Data Migration', status: 'Planning' }
      ],
      page: 'projects'
    },
    machines: {
      title: 'Machines',
      items: [
        { id: 'M001', name: '3D Printer #1', status: 'Online' },
        { id: 'M002', name: 'CNC Mill', status: 'Busy' },
        { id: 'M003', name: 'Laser Cutter', status: 'Offline' },
        { id: 'M004', name: '3D Printer #2', status: 'Online' },
        { id: 'M005', name: 'CNC Router', status: 'Maintenance' },
        { id: 'M006', name: 'Plasma Cutter', status: 'Online' },
        { id: 'M007', name: 'Welding Station', status: 'Online' },
        { id: 'M008', name: 'Drill Press', status: 'Busy' },
        { id: 'M009', name: 'Band Saw', status: 'Online' },
        { id: 'M010', name: 'Lathe', status: 'Offline' },
        { id: 'M011', name: 'Grinding Machine', status: 'Online' },
        { id: 'M012', name: 'Heat Press', status: 'Online' }
      ],
      page: 'machines'
    },
    sensors: {
      title: 'Sensors',
      items: [
        { id: 'S001', name: 'Temperature', status: '72°F' },
        { id: 'S002', name: 'Humidity', status: '45%' },
        { id: 'S003', name: 'Air Quality', status: 'Good' },
        { id: 'S004', name: 'Pressure', status: '14.7 PSI' },
        { id: 'S005', name: 'CO2 Level', status: '400 ppm' },
        { id: 'S006', name: 'Noise Level', status: '65 dB' },
        { id: 'S007', name: 'Light Level', status: '500 lux' },
        { id: 'S008', name: 'Motion', status: 'No Activity' },
        { id: 'S009', name: 'Vibration', status: 'Normal' },
        { id: 'S010', name: 'Power Usage', status: '2.3 kW' }
      ],
      page: 'sensors'
    }
  };

  const config = configs[type];
  
  // Calculate items per page based on widget height
  const itemsPerPage = useMemo(() => {
    // Each grid unit shows exactly 3 items
    return height * 3;
  }, [height]);
  
  const totalPages = Math.ceil(config.items.length / itemsPerPage);
  const showPagination = totalPages > 1;
  
  // Get current page items
  const currentItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    return config.items.slice(start, end);
  }, [config.items, currentPage, itemsPerPage]);

  const handleClick = () => {
    const appNavigate = (window as any).__witNavigate;
    if (appNavigate) {
      appNavigate(config.page);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('online') || statusLower.includes('active') || statusLower.includes('good')) {
      return 'text-green-400';
    } else if (statusLower.includes('busy') || statusLower.includes('progress') || statusLower.includes('review')) {
      return 'text-yellow-400';
    } else if (statusLower.includes('offline') || statusLower.includes('hold') || statusLower.includes('maintenance')) {
      return 'text-red-400';
    }
    return 'text-gray-400';
  };

  return (
    <div className="h-full flex flex-col p-4 bg-gray-800 text-gray-100">
      {/* Header */}
      <div 
        className="flex justify-between items-center mb-3 cursor-pointer hover:text-blue-400 transition-colors"
        onClick={handleClick}
      >
        <h3 className="text-lg font-bold">{config.title}</h3>
        <FiArrowRight className="text-blue-400" />
      </div>
      
      {/* Items List */}
      <div className="flex-1 space-y-1 overflow-hidden">
        {currentItems.map(item => (
          <div key={item.id} className="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
            <span className="text-sm font-medium truncate">{item.name}</span>
            <span className={`text-xs ${getStatusColor(item.status)}`}>{item.status}</span>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {showPagination ? (
          <>
            <button
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage(Math.max(0, currentPage - 1));
              }}
              disabled={currentPage === 0}
            >
              <FiChevronLeft />
            </button>
            <span className="text-xs text-gray-400">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
              }}
              disabled={currentPage === totalPages - 1}
            >
              <FiChevronRight />
            </button>
          </>
        ) : (
          <span 
            className="text-xs text-blue-400 hover:underline cursor-pointer mx-auto"
            onClick={handleClick}
          >
            View all {config.items.length} {config.title.toLowerCase()} →
          </span>
        )}
      </div>
    </div>
  );
};

export default ListWidget;