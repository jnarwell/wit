// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import SpecificWidget from './widgets/SpecificWidget';
import ListWidget from './widgets/ListWidget';
import WITsWidget from './widgets/WITsWidget';
import UtilityWidget from './widgets/UtilityWidget';

interface Widget {
  id: string;
  type: 'project' | 'machine' | 'sensor' | 'projects-list' | 'machines-list' | 'sensors-list' | 'wits' | 'utility';
  subType?: string; // For utility widgets
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
}

interface GridSize {
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;
}

const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>({ cellWidth: 0, cellHeight: 0, cols: 5, rows: 2 });
  const [widgetsPerPage, setWidgetsPerPage] = useState(10);
  const [isGridReady, setIsGridReady] = useState(false);

  // Calculate grid dimensions based on container size
  useEffect(() => {
    const calculateGrid = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const padding = 32; // 16px on each side
      const gap = 16; // Gap between widgets
      
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;

      // Calculate grid based on widgets per page
      let cols, rows;
      if (widgetsPerPage <= 4) {
        cols = 2;
        rows = 2;
      } else if (widgetsPerPage <= 6) {
        cols = 3;
        rows = 2;
      } else if (widgetsPerPage <= 9) {
        cols = 3;
        rows = 3;
      } else if (widgetsPerPage <= 12) {
        cols = 4;
        rows = 3;
      } else {
        cols = 5;
        rows = Math.ceil(widgetsPerPage / 5);
      }

      const cellWidth = (availableWidth - (gap * (cols - 1))) / cols;
      const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;

      setGridSize({ cellWidth, cellHeight, cols, rows });
      setIsGridReady(true);
    };

    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [widgetsPerPage]);

  // Load saved layout
  useEffect(() => {
    if (!isGridReady) return;
    
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        // Validate and fix widget positions
        const validatedWidgets = parsed.map((widget: Widget) => ({
          ...widget,
          position: widget.position || { x: 0, y: 0 },
          size: widget.size || { width: 1, height: 1 }
        }));
        setWidgets(validatedWidgets);
      } catch (e) {
        console.error('Failed to load saved layout:', e);
        setDefaultLayout();
      }
    } else {
      setDefaultLayout();
    }
  }, [isGridReady, gridSize]);

  const setDefaultLayout = () => {
    // Default layout with WITs widget in center
    const centerX = Math.floor(gridSize.cols / 2) - 1;
    const centerY = Math.floor(gridSize.rows / 2) - 1;
    
    setWidgets([
      {
        id: 'wits-main',
        type: 'wits',
        position: { x: Math.max(0, centerX), y: Math.max(0, centerY) },
        size: { width: 2, height: 2 }
      },
      {
        id: 'machines-list',
        type: 'machines-list',
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 }
      },
      {
        id: 'projects-list',
        type: 'projects-list',
        position: { x: Math.max(0, gridSize.cols - 1), y: 0 },
        size: { width: 1, height: 1 }
      }
    ]);
  };

  // Save layout
  const saveLayout = (newWidgets: Widget[]) => {
    localStorage.setItem('dashboardLayout', JSON.stringify(newWidgets));
  };

  // Check if position is occupied
  const isPositionOccupied = (x: number, y: number, excludeId?: string): boolean => {
    return widgets.some(widget => {
      if (widget.id === excludeId) return false;
      
      const widgetOccupiesPosition = 
        x >= widget.position.x && 
        x < widget.position.x + widget.size.width &&
        y >= widget.position.y && 
        y < widget.position.y + widget.size.height;
      
      return widgetOccupiesPosition;
    });
  };

  // Find available position for new widget
  const findAvailablePosition = (width: number, height: number): { x: number, y: number } | null => {
    for (let y = 0; y <= gridSize.rows - height; y++) {
      for (let x = 0; x <= gridSize.cols - width; x++) {
        let canPlace = true;
        
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            if (isPositionOccupied(x + dx, y + dy)) {
              canPlace = false;
              break;
            }
          }
          if (!canPlace) break;
        }
        
        if (canPlace) return { x, y };
      }
    }
    return null;
  };

  // Add widget
  const addWidget = (type: Widget['type'], subType?: string) => {
    const size = type === 'wits' ? { width: 2, height: 2 } : { width: 1, height: 1 };
    const position = findAvailablePosition(size.width, size.height);
    
    if (!position) {
      alert('No space available! Please remove widgets or increase widgets per page.');
      return;
    }

    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      subType,
      position,
      size,
      data: type === 'utility' ? { subType } : undefined
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    saveLayout(newWidgets);
    setShowAddMenu(false);
  };

  // Remove widget
  const removeWidget = (id: string) => {
    const newWidgets = widgets.filter(w => w.id !== id);
    setWidgets(newWidgets);
    saveLayout(newWidgets);
  };

  // Navigate to specific page
  const navigateToPage = (page: string) => {
    // This would be handled by your routing logic
    console.log(`Navigate to ${page}`);
  };

  // Navigate to specific item
  const navigateToItem = (type: string, id: string) => {
    // This would navigate to the specific item's page
    console.log(`Navigate to ${type} ${id}`);
  };

  // Render widget based on type
  const renderWidget = (widget: Widget) => {
    // Ensure widget has valid position and size
    const position = widget.position || { x: 0, y: 0 };
    const size = widget.size || { width: 1, height: 1 };
    
    // Don't render if grid isn't ready
    if (gridSize.cellWidth === 0 || gridSize.cellHeight === 0) {
      return null;
    }

    const style = {
      position: 'absolute' as const,
      left: `${position.x * (gridSize.cellWidth + 16)}px`,
      top: `${position.y * (gridSize.cellHeight + 16)}px`,
      width: `${size.width * gridSize.cellWidth + (size.width - 1) * 16}px`,
      height: `${size.height * gridSize.cellHeight + (size.height - 1) * 16}px`,
      // Fallback styles if Tailwind isn't working
      backgroundColor: '#1f2937',
      borderRadius: '8px',
      border: '1px solid #374151',
      overflow: 'hidden',
    };

    const commonProps = {
      onRemove: () => removeWidget(widget.id),
      style
    };

    switch (widget.type) {
      case 'wits':
        return <WITsWidget key={widget.id} {...commonProps} />;
      
      case 'projects-list':
        return <ListWidget key={widget.id} {...commonProps} type="projects" onNavigate={() => navigateToPage('projects')} />;
      
      case 'machines-list':
        return <ListWidget key={widget.id} {...commonProps} type="machines" onNavigate={() => navigateToPage('machines')} />;
      
      case 'sensors-list':
        return <ListWidget key={widget.id} {...commonProps} type="sensors" onNavigate={() => navigateToPage('sensors')} />;
      
      case 'project':
      case 'machine':
      case 'sensor':
        return <SpecificWidget key={widget.id} {...commonProps} type={widget.type} data={widget.data} onNavigate={() => navigateToItem(widget.type, widget.data?.id || '')} />;
      
      case 'utility':
        return <UtilityWidget key={widget.id} {...commonProps} subType={widget.subType || 'cpu'} />;
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Add Widget Button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <FaPlus size={20} />
        </button>
        
        {showAddMenu && (
          <div className="absolute right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 min-w-[250px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Add Widget</h3>
              <button onClick={() => setShowAddMenu(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-gray-400 text-sm font-medium">Lists</h4>
              <button onClick={() => addWidget('projects-list')} className="widget-menu-item">Projects List</button>
              <button onClick={() => addWidget('machines-list')} className="widget-menu-item">Machines List</button>
              <button onClick={() => addWidget('sensors-list')} className="widget-menu-item">Sensors List</button>
              
              <h4 className="text-gray-400 text-sm font-medium mt-4">Specific Items</h4>
              <button onClick={() => addWidget('project')} className="widget-menu-item">Project</button>
              <button onClick={() => addWidget('machine')} className="widget-menu-item">Machine</button>
              <button onClick={() => addWidget('sensor')} className="widget-menu-item">Sensor</button>
              
              <h4 className="text-gray-400 text-sm font-medium mt-4">Utilities</h4>
              <button onClick={() => addWidget('utility', 'cpu')} className="widget-menu-item">CPU Monitor</button>
              <button onClick={() => addWidget('utility', 'ram')} className="widget-menu-item">RAM Monitor</button>
              <button onClick={() => addWidget('utility', 'disk')} className="widget-menu-item">Disk Space</button>
              <button onClick={() => addWidget('utility', 'network')} className="widget-menu-item">Network</button>
              <button onClick={() => addWidget('utility', 'temp')} className="widget-menu-item">Temperature</button>
              
              <h4 className="text-gray-400 text-sm font-medium mt-4">Special</h4>
              <button onClick={() => addWidget('wits')} className="widget-menu-item">WITs Assistant (2x2)</button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
              <label className="text-gray-400 text-sm">Widgets per page</label>
              <input
                type="number"
                min="4"
                max="20"
                value={widgetsPerPage}
                onChange={(e) => setWidgetsPerPage(parseInt(e.target.value) || 10)}
                className="w-full mt-1 bg-gray-700 text-white rounded px-3 py-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Widget Grid Container */}
      <div ref={containerRef} className="flex-1 relative p-4 bg-gray-700">
        {/* Debug Info */}
        <div className="absolute top-0 left-0 bg-black bg-opacity-75 text-white p-2 text-xs z-50">
          Grid: {gridSize.cols}x{gridSize.rows} | 
          Cell: {gridSize.cellWidth.toFixed(0)}x{gridSize.cellHeight.toFixed(0)} | 
          Widgets: {widgets.length}
        </div>
        
        {isGridReady && widgets.map(widget => renderWidget(widget))}
      </div>
    </div>
  );
};

export default Dashboard;