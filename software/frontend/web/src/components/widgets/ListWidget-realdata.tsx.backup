// src/components/widgets/ListWidget.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiArrowRight, FiX } from 'react-icons/fi';

interface ListWidgetProps {
  type: 'projects' | 'machines' | 'sensors';
  height: number; // Grid units
  pixelHeight?: number; // Actual pixel height
  onRemove?: () => void;
}

const ListWidget: React.FC<ListWidgetProps> = ({ type, height, pixelHeight, onRemove }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  // Start with a reasonable estimate based on grid height
  const [itemsPerPage, setItemsPerPage] = useState(Math.max(2, height * 3));
  const [isCalculating, setIsCalculating] = useState(true);
  
  // Sample data configurations
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
        { id: 'P007', name: 'Beta Testing', status: 'In Progress' },
        { id: 'P008', name: 'Documentation', status: 'Planning' },
        { id: 'P009', name: 'Integration Tests', status: 'Active' },
        { id: 'P010', name: 'Deployment Phase', status: 'On Hold' }
      ],
      page: 'projects'
    },
    machines: {
      title: 'Machines',
      items: [
        { id: 'M001', name: '3D Printer #1', status: 'Online' },
        { id: 'M002', name: 'CNC Mill', status: 'Busy' },
        { id: 'M003', name: 'Laser Cutter', status: 'Offline' },
        { id: 'M004', name: '3D Printer #2', status: 'Maintenance' },
        { id: 'M005', name: 'Vinyl Cutter', status: 'Online' },
        { id: 'M006', name: 'Soldering Station', status: 'Available' },
        { id: 'M007', name: 'Reflow Oven', status: 'Busy' },
        { id: 'M008', name: 'Oscilloscope', status: 'Online' },
        { id: 'M009', name: 'PCB Mill', status: 'Offline' },
        { id: 'M010', name: 'Injection Molder', status: 'Maintenance' },
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
  
  // Calculate items per page based on actual available height
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (!containerRef.current || !itemsContainerRef.current) return;
      
      // Get the actual height of the container
      const containerHeight = pixelHeight || containerRef.current.offsetHeight;
      
      // Calculate used space based on widget size
      const isCompact = height <= 1;
      const padding = isCompact ? 24 : 32; // 12px * 2 or 16px * 2
      const headerHeight = isCompact ? 32 : 40; // Smaller header for compact
      const footerHeight = isCompact ? 32 : 40; // Smaller footer for compact
      const itemSpacing = 4; // Space between items (from space-y-1)
      
      // Calculate available height for items
      const availableHeight = containerHeight - padding - headerHeight - footerHeight;
      
      // Calculate item height based on actual item sizing
      // Item has p-2 (8px * 2 = 16px) + text (~20px) + margin-bottom (4px from space-y-1) = ~40px per item
      const itemHeight = 40; // Height including margin
      
      // Calculate how many items can fit
      // We need to account for the spacing between items
      let calculatedItems = 1; // At least one item
      if (availableHeight > itemHeight) {
        // First item takes itemHeight, each additional item takes itemHeight + spacing
        calculatedItems = 1 + Math.floor((availableHeight - itemHeight) / (itemHeight + itemSpacing));
      }
      
      // For very small widgets (1x1), ensure we show at least 2 items if possible
      // This prevents awkward single-item displays
      if (height === 1 && calculatedItems < 2 && config.items.length >= 2) {
        calculatedItems = 2;
      }
      
      // Set items per page (minimum 1, maximum all items)
      const newItemsPerPage = Math.max(1, Math.min(calculatedItems, config.items.length));
      
      // Only update if changed to avoid infinite loops
      if (newItemsPerPage !== itemsPerPage) {
        setItemsPerPage(newItemsPerPage);
        // Reset to first page if current page is now out of bounds
        const newTotalPages = Math.ceil(config.items.length / newItemsPerPage);
        if (currentPage >= newTotalPages) {
          setCurrentPage(0);
        }
      }
      setIsCalculating(false);
    };
    
    // Calculate on mount and when dependencies change
    // Small delay to ensure container is rendered
    const timeoutId = setTimeout(calculateItemsPerPage, 50);
    calculateItemsPerPage();
    
    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateItemsPerPage);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [config.items.length, currentPage, itemsPerPage, height, pixelHeight]);
  
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
    <div ref={containerRef} className={`h-full flex flex-col ${height <= 1 ? 'p-3' : 'p-4'} bg-gray-800 text-gray-100 relative group`}>
      {/* Header */}
      <div 
        className={`flex justify-between items-center ${height <= 1 ? 'mb-2' : 'mb-3'} flex-shrink-0`}
      >
        <div 
          className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors flex-1"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          <h3 className={`${height <= 1 ? 'text-base' : 'text-lg'} font-bold`}>
            {config.title} 
            {!showPagination && config.items.length > currentItems.length && 
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({currentItems.length}/{config.items.length})
              </span>
            }
          </h3>
          <FiArrowRight className="text-blue-400" />
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 ml-2"
          >
            <FiX size={height <= 1 ? 16 : 18} />
          </button>
        )}
      </div>
      
      {/* Items List - flex-1 to take all available space */}
      <div ref={itemsContainerRef} className="flex-1 space-y-1 overflow-hidden min-h-0">
        {isCalculating ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          currentItems.map(item => (
            <div key={item.id} className="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
              <span className="text-sm font-medium truncate flex-1 mr-2">{item.name}</span>
              <span className={`text-xs ${getStatusColor(item.status)} whitespace-nowrap`}>{item.status}</span>
            </div>
          ))
        )}
      </div>
      
      {/* Footer */}
      <div className={`${height <= 1 ? 'mt-2' : 'mt-3'} flex items-center justify-between flex-shrink-0`}>
        {showPagination ? (
          <>
            <button
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage(Math.max(0, currentPage - 1));
              }}
              onMouseDown={(e) => e.stopPropagation()}
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
              onMouseDown={(e) => e.stopPropagation()}
              disabled={currentPage === totalPages - 1}
            >
              <FiChevronRight />
            </button>
          </>
        ) : (
          <span 
            className="text-xs text-blue-400 hover:underline cursor-pointer mx-auto"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            View all {config.items.length} {config.title.toLowerCase()} →
          </span>
        )}
      </div>
    </div>
  );
};

export default ListWidget;