// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaTimes, FaGripVertical } from 'react-icons/fa';
import SpecificWidget from './widgets/SpecificWidget';
import ListWidget from './widgets/ListWidget';
import WITsWidget from './widgets/WITsWidget';
import UtilityWidget from './widgets/UtilityWidget';

interface Widget {
  id: string;
  type: 'project' | 'machine' | 'sensor' | 'projects-list' | 'machines-list' | 'sensors-list' | 'wits' | 'utility';
  subType?: string;
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

interface DragState {
  isDragging: boolean;
  draggedWidget: Widget | null;
  dragOffset: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>({ cellWidth: 0, cellHeight: 0, cols: 5, rows: 2 });
  const [widgetsPerPage, setWidgetsPerPage] = useState(10);
  const [isGridReady, setIsGridReady] = useState(false);
  const [hasLoadedLayout, setHasLoadedLayout] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedWidget: null,
    dragOffset: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });

  // Calculate grid dimensions based on container size
  useEffect(() => {
    const calculateGrid = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const padding = 32;
      const gap = 16;
      
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;

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
    if (!isGridReady || hasLoadedLayout) return;
    
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        const validatedWidgets = parsed.map((widget: Widget) => {
          // Migrate old 'memory' subType to 'ram'
          if (widget.type === 'utility' && widget.subType === 'memory') {
            widget.subType = 'ram';
          }
          
          return {
            ...widget,
            position: widget.position || { x: 0, y: 0 },
            size: widget.size || { width: 1, height: 1 }
          };
        });
        setWidgets(validatedWidgets);
        setHasLoadedLayout(true);
        // Save the migrated layout
        localStorage.setItem('dashboardLayout', JSON.stringify(validatedWidgets));
      } catch (e) {
        console.error('Failed to load saved layout:', e);
        setDefaultLayout();
        setHasLoadedLayout(true);
      }
    } else {
      setDefaultLayout();
      setHasLoadedLayout(true);
    }
  }, [isGridReady, hasLoadedLayout]); // Only run once when grid is ready

  const setDefaultLayout = () => {
    const centerX = Math.floor(gridSize.cols / 2) - 1;
    const centerY = Math.floor(gridSize.rows / 2) - 1;
    
    const defaultWidgets = [
      {
        id: 'wits-main',
        type: 'wits' as const,
        position: { x: Math.max(0, centerX), y: Math.max(0, centerY) },
        size: { width: 2, height: 2 }
      },
      {
        id: 'machines-list',
        type: 'machines-list' as const,
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 }
      },
      {
        id: 'projects-list',
        type: 'projects-list' as const,
        position: { x: Math.max(0, gridSize.cols - 1), y: 0 },
        size: { width: 1, height: 1 }
      }
    ];
    
    setWidgets(defaultWidgets);
    saveLayout(defaultWidgets);
  };

  const saveLayout = (newWidgets: Widget[]) => {
    // Remove any duplicates before saving
    const uniqueWidgets = newWidgets.filter((widget, index, self) =>
      index === self.findIndex((w) => w.id === widget.id)
    );
    
    console.log('Saving layout:', {
      original: newWidgets.length,
      unique: uniqueWidgets.length,
      widgets: uniqueWidgets.map(w => ({ id: w.id, pos: w.position }))
    });
    
    localStorage.setItem('dashboardLayout', JSON.stringify(uniqueWidgets));
  };

  const isPositionOccupied = (x: number, y: number, width: number, height: number, excludeId?: string): boolean => {
    return widgets.some(widget => {
      if (widget.id === excludeId) return false;
      
      const collision = !(
        x + width <= widget.position.x ||
        x >= widget.position.x + widget.size.width ||
        y + height <= widget.position.y ||
        y >= widget.position.y + widget.size.height
      );
      
      return collision;
    });
  };

  const findAvailablePosition = (width: number, height: number): { x: number, y: number } | null => {
    for (let y = 0; y <= gridSize.rows - height; y++) {
      for (let x = 0; x <= gridSize.cols - width; x++) {
        if (!isPositionOccupied(x, y, width, height)) {
          return { x, y };
        }
      }
    }
    return null;
  };

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
      size
    };

    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    saveLayout(newWidgets);
    setShowAddMenu(false);
  };

  const removeWidget = (id: string) => {
    const newWidgets = widgets.filter(w => w.id !== id);
    setWidgets(newWidgets);
    saveLayout(newWidgets);
  };

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, widget: Widget) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 16; // p-4 = 16px padding
    const widgetElement = (e.target as HTMLElement).closest('.widget-container');
    if (!widgetElement) return;
    
    const widgetRect = widgetElement.getBoundingClientRect();
    
    console.log('Drag start:', {
      widget,
      containerRect: { left: containerRect.left, top: containerRect.top },
      widgetRect: { left: widgetRect.left, top: widgetRect.top },
      mousePos: { x: e.clientX, y: e.clientY }
    });
    
    setDragState({
      isDragging: true,
      draggedWidget: widget,
      dragOffset: {
        x: e.clientX - widgetRect.left,
        y: e.clientY - widgetRect.top
      },
      currentPosition: {
        x: widgetRect.left - containerRect.left - containerPadding,
        y: widgetRect.top - containerRect.top - containerPadding
      }
    });
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedWidget || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 16; // p-4 = 16px padding
    
    const newPosition = {
      x: e.clientX - containerRect.left - dragState.dragOffset.x - containerPadding,
      y: e.clientY - containerRect.top - dragState.dragOffset.y - containerPadding
    };
    
    setDragState(prev => ({
      ...prev,
      currentPosition: newPosition
    }));
  };

  const handleDragEnd = () => {
    if (!dragState.isDragging || !dragState.draggedWidget || !containerRef.current) return;
    
    const { draggedWidget, currentPosition } = dragState;
    const gap = 16;
    
    // Calculate grid position from pixel position
    // Make sure we're using positive values
    const gridX = Math.max(0, Math.round(currentPosition.x / (gridSize.cellWidth + gap)));
    const gridY = Math.max(0, Math.round(currentPosition.y / (gridSize.cellHeight + gap)));
    
    // Clamp to grid bounds
    const newX = Math.max(0, Math.min(gridX, gridSize.cols - draggedWidget.size.width));
    const newY = Math.max(0, Math.min(gridY, gridSize.rows - draggedWidget.size.height));
    
    console.log('Drag end:', {
      currentPosition,
      gridX,
      gridY,
      newX,
      newY,
      cellWidth: gridSize.cellWidth,
      cellHeight: gridSize.cellHeight,
      cols: gridSize.cols,
      rows: gridSize.rows,
      widgetId: draggedWidget.id,
      oldPosition: draggedWidget.position
    });
    
    // Find and update the specific widget
    const widgetIndex = widgets.findIndex(w => w.id === draggedWidget.id);
    if (widgetIndex === -1) {
      console.error('Widget not found!', draggedWidget.id);
      return;
    }
    
    // Create new widgets array with updated position
    const updatedWidgets = [...widgets];
    updatedWidgets[widgetIndex] = {
      ...updatedWidgets[widgetIndex],
      position: { x: newX, y: newY }
    };
    
    console.log('Widget update:', {
      before: widgets[widgetIndex].position,
      after: { x: newX, y: newY }
    });
    
    setWidgets(updatedWidgets);
    saveLayout(updatedWidgets);
    
    setDragState({
      isDragging: false,
      draggedWidget: null,
      dragOffset: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [dragState.isDragging, dragState.draggedWidget, dragState.dragOffset]);

  return (
    <div className="h-full flex bg-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 p-4 border-r border-gray-700">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <FaPlus /> Add Widget
        </button>
        
        {showAddMenu && (
          <div className="mt-4 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Select Widget Type</h3>
            <div className="space-y-2">
              <h4 className="text-gray-400 text-sm font-medium">Lists</h4>
              <button onClick={() => addWidget('projects-list')} className="widget-menu-item">Projects List</button>
              <button onClick={() => addWidget('machines-list')} className="widget-menu-item">Machines List</button>
              <button onClick={() => addWidget('sensors-list')} className="widget-menu-item">Sensors List</button>
              
              <h4 className="text-gray-400 text-sm font-medium mt-4">Utilities</h4>
              <button onClick={() => addWidget('utility', 'cpu')} className="widget-menu-item">CPU Usage</button>
              <button onClick={() => addWidget('utility', 'ram')} className="widget-menu-item">Memory</button>
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
      <div ref={containerRef} className="flex-1 relative p-4 bg-gray-700 overflow-hidden">
        {/* Debug Info */}
        <div className="absolute top-0 left-0 bg-black bg-opacity-75 text-white p-2 text-xs z-50">
          Grid: {gridSize.cols}x{gridSize.rows} | 
          Cell: {gridSize.cellWidth.toFixed(0)}x{gridSize.cellHeight.toFixed(0)} | 
          Widgets: {widgets.length}
          {dragState.isDragging && ' | Dragging...'}
        </div>
        
        {isGridReady && widgets
          .filter(widget => widget && widget.id)
          .map((widget) => {
            const position = widget.position || { x: 0, y: 0 };
            const size = widget.size || { width: 1, height: 1 };
            
            if (gridSize.cellWidth === 0 || gridSize.cellHeight === 0) {
              return null;
            }

            const isDragging = dragState.isDragging && dragState.draggedWidget?.id === widget.id;
            const gap = 16;
            
            const style = {
              position: 'absolute' as const,
              left: isDragging 
                ? `${dragState.currentPosition.x}px`
                : `${position.x * (gridSize.cellWidth + gap)}px`,
              top: isDragging 
                ? `${dragState.currentPosition.y}px`
                : `${position.y * (gridSize.cellHeight + gap)}px`,
              width: `${size.width * gridSize.cellWidth + (size.width - 1) * gap}px`,
              height: `${size.height * gridSize.cellHeight + (size.height - 1) * gap}px`,
              transition: isDragging ? 'none' : 'all 0.2s ease-in-out',
              zIndex: isDragging ? 1000 : 1,
              opacity: isDragging ? 0.8 : 1,
            };

            const commonProps = {
              onRemove: () => removeWidget(widget.id),
            };

            return (
              <div
                key={widget.id}
                style={style}
                className="widget-container"
              >
                {/* Drag Handle */}
                <div
                  className="absolute top-0 left-0 right-0 h-8 bg-gray-700 rounded-t-lg cursor-grab hover:bg-gray-600 flex items-center px-2 z-10"
                  onMouseDown={(e) => handleDragStart(e, widget)}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <FaGripVertical className="text-gray-400 text-sm mr-2" />
                  <span className="text-xs text-gray-300 select-none">
                    {widget.type === 'wits' ? 'WITs Assistant' : 
                     widget.type.charAt(0).toUpperCase() + widget.type.slice(1).replace('-', ' ')}
                  </span>
                </div>
                
                {/* Widget Content */}
                <div className="pt-8 h-full">
                  {widget.type === 'project' && (
                    <SpecificWidget 
                      type="project" 
                      data={widget.data} 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'machine' && (
                    <SpecificWidget 
                      type="machine" 
                      data={widget.data} 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'sensor' && (
                    <SpecificWidget 
                      type="sensor" 
                      data={widget.data} 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'projects-list' && (
                    <ListWidget 
                      type="projects" 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'machines-list' && (
                    <ListWidget 
                      type="machines" 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'sensors-list' && (
                    <ListWidget 
                      type="sensors" 
                      {...commonProps}
                    />
                  )}
                  {widget.type === 'wits' && (
                    <WITsWidget {...commonProps} />
                  )}
                  {widget.type === 'utility' && widget.subType && (
                    <UtilityWidget 
                      type={widget.subType as any} 
                      {...commonProps}
                    />
                  )}
                </div>
              </div>
            );
          })}
        
        {/* Grid overlay (optional - helps visualize grid) */}
        {dragState.isDragging && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: gridSize.rows * gridSize.cols }, (_, index) => {
              const row = Math.floor(index / gridSize.cols);
              const col = index % gridSize.cols;
              const gap = 16;
              
              return (
                <div
                  key={`grid-cell-${index}`}
                  className="absolute border border-dashed border-gray-500 opacity-30"
                  style={{
                    left: `${col * (gridSize.cellWidth + gap)}px`,
                    top: `${row * (gridSize.cellHeight + gap)}px`,
                    width: `${gridSize.cellWidth}px`,
                    height: `${gridSize.cellHeight}px`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;