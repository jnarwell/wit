// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
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

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const Dashboard: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>({ cellWidth: 0, cellHeight: 0, cols: 5, rows: 2 });
  const [widgetsPerPage, setWidgetsPerPage] = useState(10);
  const [isGridReady, setIsGridReady] = useState(false);
  const [hasLoadedLayout, setHasLoadedLayout] = useState(false);
  
  // Drag state using refs to avoid stale closures
  const isDraggingRef = useRef(false);
  const draggedWidgetRef = useRef<Widget | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize state
  const isResizingRef = useRef(false);
  const resizedWidgetRef = useRef<Widget | null>(null);
  const resizeDirectionRef = useRef<ResizeDirection>('se');
  const resizeStartRef = useRef({ 
    x: 0, 
    y: 0, 
    width: 0, 
    height: 0,
    posX: 0,
    posY: 0
  });
  const [resizePreview, setResizePreview] = useState<{ 
    width: number; 
    height: number;
    x?: number;
    y?: number;
  } | null>(null);

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

  const setDefaultLayout = () => {
    const defaultWidgets = [
      {
        id: 'machines-list',
        type: 'machines-list' as const,
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 }
      },
      {
        id: 'wits-main',
        type: 'wits' as const,
        position: { x: 1, y: 0 },
        size: { width: 1, height: 1 }
      },
      {
        id: 'projects-list',
        type: 'projects-list' as const,
        position: { x: 2, y: 0 },
        size: { width: 1, height: 1 }
      }
    ];
    
    setWidgets(defaultWidgets);
    saveLayout(defaultWidgets);
  };

  const saveLayout = (newWidgets: Widget[]) => {
    const uniqueWidgets = newWidgets.filter((widget, index, self) =>
      index === self.findIndex((w) => w.id === widget.id)
    );
    const layoutData = {
      version: 4, // Increment to force migration
      widgets: uniqueWidgets
    };
    localStorage.setItem('dashboardLayout', JSON.stringify(layoutData));
  };

  // Load saved layout
  useEffect(() => {
    if (!isGridReady || hasLoadedLayout) return;
    
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        
        // Handle both old format (array) and new format (object with version)
        let widgets: Widget[] = [];
        let layoutVersion = 1;
        
        if (Array.isArray(parsed)) {
          // Old format
          widgets = parsed;
        } else if (parsed.version && parsed.widgets) {
          // New format
          layoutVersion = parsed.version;
          widgets = parsed.widgets;
        }
        
        const validatedWidgets = widgets.map((widget: Widget) => {
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
      } catch (e) {
        console.error('Failed to load saved layout:', e);
        setDefaultLayout();
        setHasLoadedLayout(true);
      }
    } else {
      setDefaultLayout();
      setHasLoadedLayout(true);
    }
  }, [isGridReady, hasLoadedLayout]);

  // Save layout when widgets change
  useEffect(() => {
    if (hasLoadedLayout && widgets.length > 0) {
      saveLayout(widgets);
    }
  }, [widgets, hasLoadedLayout]);

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
    const size = { width: 1, height: 1 }; // All widgets start at 1x1
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

    setWidgets([...widgets, newWidget]);
    setShowAddMenu(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  // Check if cursor is near edge of widget
  const getResizeDirection = (e: React.MouseEvent, element: HTMLElement): ResizeDirection | null => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeSize = 10; // pixels from edge to be considered resize zone
    
    const nearTop = y < edgeSize;
    const nearBottom = y > rect.height - edgeSize;
    const nearLeft = x < edgeSize;
    const nearRight = x > rect.width - edgeSize;
    
    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    
    return null;
  };

  // Get cursor style based on resize direction
  const getCursorStyle = (direction: ResizeDirection | null): string => {
    if (!direction) return 'move';
    const cursorMap: Record<ResizeDirection, string> = {
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize',
      'ne': 'nesw-resize',
      'nw': 'nwse-resize',
      'se': 'nwse-resize',
      'sw': 'nesw-resize'
    };
    return cursorMap[direction];
  };

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, widget: Widget) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    if (direction) {
      // Start resize
      isResizingRef.current = true;
      resizedWidgetRef.current = widget;
      resizeDirectionRef.current = direction;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: widget.size.width,
        height: widget.size.height,
        posX: widget.position.x,
        posY: widget.position.y
      };
      setResizePreview({ 
        width: widget.size.width, 
        height: widget.size.height,
        x: widget.position.x,
        y: widget.position.y
      });
    } else {
      // Start drag
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerPadding = 16;
      const widgetElement = element.closest('.widget-container') as HTMLElement;
      if (!widgetElement) return;
      
      const widgetRect = widgetElement.getBoundingClientRect();
      
      isDraggingRef.current = true;
      draggedWidgetRef.current = widget;
      dragOffsetRef.current = {
        x: e.clientX - widgetRect.left,
        y: e.clientY - widgetRect.top
      };
      
      setDragPosition({
        x: widgetRect.left - containerRect.left - containerPadding,
        y: widgetRect.top - containerRect.top - containerPadding
      });
    }
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !draggedWidgetRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 16;
    
    setDragPosition({
      x: e.clientX - containerRect.left - dragOffsetRef.current.x - containerPadding,
      y: e.clientY - containerRect.top - dragOffsetRef.current.y - containerPadding
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current || !draggedWidgetRef.current || !containerRef.current || !dragPosition) return;
    
    const draggedWidget = draggedWidgetRef.current;
    const gap = 16;
    
    // Calculate grid position from pixel position
    const gridX = Math.max(0, Math.round(dragPosition.x / (gridSize.cellWidth + gap)));
    const gridY = Math.max(0, Math.round(dragPosition.y / (gridSize.cellHeight + gap)));
    
    // Clamp to grid bounds
    const newX = Math.min(gridX, Math.max(0, gridSize.cols - draggedWidget.size.width));
    const newY = Math.min(gridY, Math.max(0, gridSize.rows - draggedWidget.size.height));
    
    // Update the widget position
    setWidgets(prevWidgets => 
      prevWidgets.map(w => 
        w.id === draggedWidget.id 
          ? { ...w, position: { x: newX, y: newY } }
          : w
      )
    );
    
    // Reset drag state
    isDraggingRef.current = false;
    draggedWidgetRef.current = null;
    setDragPosition(null);
  }, [dragPosition, gridSize]);

  // Resize handlers
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizedWidgetRef.current || !containerRef.current) return;
    
    const gap = 16;
    const cellWithGap = gridSize.cellWidth + gap;
    const cellHeightWithGap = gridSize.cellHeight + gap;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    const deltaGridX = Math.round(deltaX / cellWithGap);
    const deltaGridY = Math.round(deltaY / cellHeightWithGap);
    
    const widget = resizedWidgetRef.current;
    const direction = resizeDirectionRef.current;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = resizeStartRef.current.posX;
    let newY = resizeStartRef.current.posY;
    
    // Calculate new size and position based on resize direction
    switch (direction) {
      case 'e':
        newWidth = Math.max(1, resizeStartRef.current.width + deltaGridX);
        break;
      case 'w':
        newWidth = Math.max(1, resizeStartRef.current.width - deltaGridX);
        newX = Math.max(0, resizeStartRef.current.posX + deltaGridX);
        break;
      case 's':
        newHeight = Math.max(1, resizeStartRef.current.height + deltaGridY);
        break;
      case 'n':
        newHeight = Math.max(1, resizeStartRef.current.height - deltaGridY);
        newY = Math.max(0, resizeStartRef.current.posY + deltaGridY);
        break;
      case 'se':
        newWidth = Math.max(1, resizeStartRef.current.width + deltaGridX);
        newHeight = Math.max(1, resizeStartRef.current.height + deltaGridY);
        break;
      case 'sw':
        newWidth = Math.max(1, resizeStartRef.current.width - deltaGridX);
        newHeight = Math.max(1, resizeStartRef.current.height + deltaGridY);
        newX = Math.max(0, resizeStartRef.current.posX + deltaGridX);
        break;
      case 'ne':
        newWidth = Math.max(1, resizeStartRef.current.width + deltaGridX);
        newHeight = Math.max(1, resizeStartRef.current.height - deltaGridY);
        newY = Math.max(0, resizeStartRef.current.posY + deltaGridY);
        break;
      case 'nw':
        newWidth = Math.max(1, resizeStartRef.current.width - deltaGridX);
        newHeight = Math.max(1, resizeStartRef.current.height - deltaGridY);
        newX = Math.max(0, resizeStartRef.current.posX + deltaGridX);
        newY = Math.max(0, resizeStartRef.current.posY + deltaGridY);
        break;
    }
    
    // Ensure the resize doesn't go out of bounds
    if (newX + newWidth > gridSize.cols) {
      newWidth = gridSize.cols - newX;
    }
    if (newY + newHeight > gridSize.rows) {
      newHeight = gridSize.rows - newY;
    }
    
    // Check for collisions with other widgets
    const wouldCollide = isPositionOccupied(newX, newY, newWidth, newHeight, widget.id);
    
    if (!wouldCollide) {
      setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
    }
  }, [gridSize, isPositionOccupied]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current || !resizedWidgetRef.current || !resizePreview) return;
    
    const resizedWidget = resizedWidgetRef.current;
    
    // Update widget size and position
    setWidgets(prevWidgets =>
      prevWidgets.map(w =>
        w.id === resizedWidget.id
          ? { 
              ...w, 
              size: { width: resizePreview.width, height: resizePreview.height },
              position: { 
                x: resizePreview.x !== undefined ? resizePreview.x : w.position.x,
                y: resizePreview.y !== undefined ? resizePreview.y : w.position.y
              }
            }
          : w
      )
    );
    
    // Reset resize state
    isResizingRef.current = false;
    resizedWidgetRef.current = null;
    setResizePreview(null);
  }, [resizePreview]);

  // Add global mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleDragMove(e);
      } else if (isResizingRef.current) {
        handleResizeMove(e);
      }
    };
    
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        handleDragEnd();
      } else if (isResizingRef.current) {
        handleResizeEnd();
      }
    };
    
    if (isDraggingRef.current || isResizingRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd, dragPosition, resizePreview]);

  // Handle cursor style on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent, widget: Widget) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  }, []);

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
              <button onClick={() => addWidget('wits')} className="widget-menu-item">WITs Assistant</button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-xs mb-2">
                Click & hold to move. Drag edges to resize.
              </p>
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
        {isGridReady && widgets.map((widget) => {
          const isResizing = isResizingRef.current && resizedWidgetRef.current?.id === widget.id;
          const position = (isResizing && resizePreview?.x !== undefined && resizePreview?.y !== undefined)
            ? { x: resizePreview.x, y: resizePreview.y }
            : (widget.position || { x: 0, y: 0 });
          const size = (isResizing && resizePreview) 
            ? { width: resizePreview.width, height: resizePreview.height }
            : (widget.size || { width: 1, height: 1 });
          
          if (gridSize.cellWidth === 0 || gridSize.cellHeight === 0) {
            return null;
          }

          const isDragging = isDraggingRef.current && draggedWidgetRef.current?.id === widget.id;
          const gap = 16;
          
          const style = {
            position: 'absolute' as const,
            left: isDragging && dragPosition
              ? `${dragPosition.x}px`
              : `${position.x * (gridSize.cellWidth + gap)}px`,
            top: isDragging && dragPosition
              ? `${dragPosition.y}px`
              : `${position.y * (gridSize.cellHeight + gap)}px`,
            width: `${size.width * gridSize.cellWidth + (size.width - 1) * gap}px`,
            height: `${size.height * gridSize.cellHeight + (size.height - 1) * gap}px`,
            transition: isDragging || isResizing ? 'none' : 'all 0.2s ease-in-out',
            zIndex: isDragging || isResizing ? 1000 : 1,
            opacity: isDragging ? 0.8 : 1,
          };

          const commonProps = {
            onRemove: () => removeWidget(widget.id),
          };

          return (
            <div
              key={widget.id}
              style={style}
              className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
              onMouseDown={(e) => handleMouseDown(e, widget)}
              onMouseMove={(e) => handleMouseMove(e, widget)}
            >
              {/* Title Bar */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-gray-900 bg-opacity-50 rounded-t-lg">
                <span className="text-xs text-gray-400 select-none truncate flex-1">
                  {widget.type === 'wits' ? 'WITs Assistant' : 
                   widget.type.charAt(0).toUpperCase() + widget.type.slice(1).replace('-', ' ')}
                  {size.width > 1 || size.height > 1 ? ` (${size.width}x${size.height})` : ''}
                </span>
                <button
                  className="text-gray-400 hover:text-red-400 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWidget(widget.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              
              {/* Widget Content */}
              <div className="pt-6 h-full">
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
                    height={size.height}
                    {...commonProps}
                  />
                )}
                {widget.type === 'machines-list' && (
                  <ListWidget 
                    type="machines" 
                    height={size.height}
                    {...commonProps}
                  />
                )}
                {widget.type === 'sensors-list' && (
                  <ListWidget 
                    type="sensors" 
                    height={size.height}
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
        {(isDraggingRef.current || isResizingRef.current) && (
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