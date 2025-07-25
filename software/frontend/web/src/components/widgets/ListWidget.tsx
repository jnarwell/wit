// src/components/widgets/ListWidget.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiArrowRight, FiX } from 'react-icons/fi';

interface ListWidgetProps {
  type: 'projects' | 'machines' | 'sensors';
  height: number; // Grid units
  pixelHeight?: number; // Actual pixel height
  onRemove?: () => void;
  onNavigate?: (page: string) => void;
  onNavigateToDetail?: (page: string, id: string) => void;
}

const ListWidget: React.FC<ListWidgetProps> = ({ type, height, pixelHeight, onRemove, onNavigate, onNavigateToDetail }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  // Start with a reasonable estimate based on grid height
  const [itemsPerPage, setItemsPerPage] = useState(Math.max(2, height * 3));
  const [isCalculating, setIsCalculating] = useState(true);
  
  // Track mouse position for drag detection
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const [canNavigate, setCanNavigate] = useState(true);
  
  // State for real data
  const [realData, setRealData] = useState<any[]>([]);
  
  // Load real data from localStorage
  useEffect(() => {
    const loadData = () => {
      const storageKeys = {
        projects: 'wit-projects',
        machines: 'wit-machines',
        sensors: 'wit-sensors'
      };
      
      const data = localStorage.getItem(storageKeys[type]);
      if (data) {
        try {
          setRealData(JSON.parse(data));
        } catch (e) {
          console.error('Failed to parse data:', e);
          setRealData([]);
        }
      }
    };
    
    loadData();
    
    // Listen for changes
    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(`${type}-updated`, handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(`${type}-updated`, handleStorageChange);
    };
  }, [type]);
  
  
  const configs = {
    projects: {
      title: 'Projects',
      items: realData.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status === 'green' ? 'Active' : p.status === 'yellow' ? 'In Progress' : 'On Hold'
      })),
      page: 'projects',
      detailPage: 'project'
    },
    machines: {
      title: 'Machines',
      items: realData.map(m => ({
        id: m.id,
        name: m.name,
        status: m.status === 'green' ? 'Online' : m.status === 'yellow' ? 'Maintenance' : 'Offline'
      })),
      page: 'machines',
      detailPage: 'machine'
    },
    sensors: {
      title: 'Sensors',
      items: realData.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status === 'green' ? 'Normal' : s.status === 'yellow' ? 'Warning' : 'Critical'
      })),
      page: 'sensors',
      detailPage: 'sensor'
    }
  };

  const config = configs[type];

  // Calculate actual items per page based on available height
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (!containerRef.current || !itemsContainerRef.current) return;
      
      const container = containerRef.current;
      const header = container.querySelector('.widget-header');
      const footer = container.querySelector('.widget-footer');
      
      if (!header || !footer) return;
      
      const headerHeight = header.getBoundingClientRect().height;
      const footerHeight = footer.getBoundingClientRect().height;
      const containerPadding = 24; // 12px top + 12px bottom
      const itemsGap = 6; // gap between items
      const singleItemHeight = 32; // approximate height of one item
      
      // Use pixel height if provided, otherwise use container height
      const totalHeight = pixelHeight || container.clientHeight;
      const availableHeight = totalHeight - headerHeight - footerHeight - containerPadding;
      
      // Calculate how many items can fit
      const calculatedItems = Math.floor((availableHeight + itemsGap) / (singleItemHeight + itemsGap));
      const finalItemsPerPage = Math.max(1, calculatedItems);
      
      setItemsPerPage(finalItemsPerPage);
      setIsCalculating(false);
    };

    // Initial calculation
    calculateItemsPerPage();
    
    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateItemsPerPage);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [height, pixelHeight]);

  const totalPages = Math.ceil(config.items.length / itemsPerPage);
  const currentItems = config.items.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'Active': 'text-green-400',
      'Online': 'text-green-400',
      'Normal': 'text-green-400',
      'In Progress': 'text-yellow-400',
      'Busy': 'text-yellow-400',
      'Warning': 'text-yellow-400',
      'Available': 'text-blue-400',
      'Review': 'text-blue-400',
      'Planning': 'text-purple-400',
      'On Hold': 'text-orange-400',
      'Maintenance': 'text-orange-400',
      'Offline': 'text-red-400',
      'Critical': 'text-red-400'
    };
    return statusColors[status] || 'text-gray-400';
  };

  const handleContainerClick = () => {
    // Only navigate if we didn't drag
    if (canNavigate) {
      if (onNavigate) {
        onNavigate(config.page);
      } else if ((window as any).__witNavigate) {
        (window as any).__witNavigate(config.page);
      }
    }
  };

  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation(); // Prevent container click
    
    // Navigate to detail page
    if (onNavigateToDetail) {
      onNavigateToDetail(config.detailPage, itemId);
    } else if ((window as any).__witNavigate) {
      (window as any).__witNavigate(config.detailPage, itemId);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    setCanNavigate(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
    
    // If mouse moved more than 5px, consider it a drag
    if (dx > 5 || dy > 5) {
      setCanNavigate(false);
    } else {
      handleContainerClick();
    }
  };

  const showPagination = totalPages > 1 && !isCalculating;

  // Reset current page if it's out of bounds
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  return (
    <div 
      ref={containerRef}
      className="bg-gray-800 rounded-lg p-3 h-full flex flex-col relative cursor-pointer hover:bg-gray-750 transition-colors"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Header with remove button */}
      <div className="widget-header flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-medium text-white">{config.title}</h3>
        <div className="flex items-center gap-2">
          {onRemove && (
            <button 
              className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Items container */}
      <div 
        ref={itemsContainerRef}
        className="flex-1 overflow-hidden min-h-0"
      >
        {isCalculating ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-xs">Loading...</div>
          </div>
        ) : config.items.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center h-full text-center px-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-gray-500 text-xs mb-2">No {type} yet</div>
            <div className="text-gray-600 text-xs">
              Click here to add your first {type.slice(0, -1)}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between px-2 py-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={(e) => handleItemClick(e, item.id)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center">
                  <span className="text-xs text-gray-100">{item.name}</span>
                </div>
                <span className={`text-xs ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with pagination or view all */}
      <div className={`widget-footer ${showPagination ? 'mt-2' : 'mt-3'} flex items-center justify-between flex-shrink-0`}>
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
              if (canNavigate) {
                handleContainerClick();
              }
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