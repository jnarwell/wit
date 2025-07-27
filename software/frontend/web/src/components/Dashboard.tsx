// src/components/Dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlus, FaTimes, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import SpecificWidget from './widgets/SpecificWidget';
import ListWidget from './widgets/ListWidget';
import WITsWidget from './widgets/WITsWidget';
import UtilityWidget from './widgets/UtilityWidget';
import FileExplorerWidget from './widgets/FileExplorerWidget';
import FileViewerWidget from './widgets/FileViewerWidget';
import { TasksListWidget } from './widgets/TasksListWidget';

interface Widget {
  id: string;
  type: 'project' | 'machine' | 'sensor' | 'projects-list' | 'machines-list' | 'sensors-list' | 'tasks-list' | 'wits' | 'utility' | 'file-explorer' | 'file-viewer';
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
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);
  const [gridColsInput, setGridColsInput] = useState('3');
  const [gridRowsInput, setGridRowsInput] = useState('3');
  const [isGridReady, setIsGridReady] = useState(false);
  const [hasLoadedLayout, setHasLoadedLayout] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    lists: true,
    utilities: false,
    special: false
  });
  
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
      const paddingHorizontal = 56; // pl-8 (32px) + pr-6 (24px) = 56px
      const paddingVertical = 48; // py-6 = 24px * 2 = 48px
      const gap = 16;
      
      const availableWidth = container.clientWidth - paddingHorizontal;
      const availableHeight = container.clientHeight - paddingVertical;

      const cellWidth = (availableWidth - (gap * (gridCols - 1))) / gridCols;
      const cellHeight = (availableHeight - (gap * (gridRows - 1))) / gridRows;

      setGridSize({ cellWidth, cellHeight, cols: gridCols, rows: gridRows });
      setIsGridReady(true);
    };

    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [gridCols, gridRows]);

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
      version: 4,
      widgets: uniqueWidgets,
      gridConfig: {
        cols: gridCols,
        rows: gridRows
      }
    };
    localStorage.setItem('dashboardLayout', JSON.stringify(layoutData));
  };

  // Load saved layout
  useEffect(() => {
    if (!isGridReady || hasLoadedLayout) return;
    
    // Check for clear dashboard flag
    const shouldClear = localStorage.getItem('clearDashboard');
    if (shouldClear === 'true') {
      localStorage.removeItem('clearDashboard');
      localStorage.removeItem('dashboardLayout');
      setWidgets([]);
      setHasLoadedLayout(true);
      return;
    }
    
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
          
          // Load grid configuration if available
          if (parsed.gridConfig) {
            const newCols = parsed.gridConfig.cols || 3;
            const newRows = parsed.gridConfig.rows || 3;
            setGridCols(newCols);
            setGridRows(newRows);
            setGridColsInput(String(newCols));
            setGridRowsInput(String(newRows));
          }
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

  // Save layout when widgets or grid changes
  useEffect(() => {
    if (hasLoadedLayout && widgets.length > 0) {
      const uniqueWidgets = widgets.filter((widget, index, self) =>
        index === self.findIndex((w) => w.id === widget.id)
      );
      const layoutData = {
        version: 4,
        widgets: uniqueWidgets,
        gridConfig: {
          cols: gridCols,
          rows: gridRows
        }
      };
      localStorage.setItem('dashboardLayout', JSON.stringify(layoutData));
    }
  }, [widgets, hasLoadedLayout, gridCols, gridRows]);

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
      position,
      size,
      data: {} // Initialize with empty data
    };

    // Ensure subType is set for utility widgets
    if (type === 'utility' && subType) {
      newWidget.subType = subType;
    }

    setWidgets([...widgets, newWidget]);
    setShowAddMenu(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
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
      'se': 'nwse-resize',
      'nw': 'nwse-resize',
      'sw': 'nesw-resize'
    };
    return cursorMap[direction];
  };

  const handleMouseMove = useCallback((e: React.MouseEvent, widget: Widget) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, widget: Widget) => {
    // Check if the click is on an interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    
    // If clicking on an interactive element, don't start drag/resize
    if (isInteractive) {
      return;
    }
    
    e.preventDefault();
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    if (direction) {
      // Start resizing
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
      element.style.cursor = getCursorStyle(direction);
    } else {
      // Start dragging
      handleDragStart(e, widget);
    }
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, widget: Widget) => {
    if (!containerRef.current) return;
    
    isDraggingRef.current = true;
    draggedWidgetRef.current = widget;
    
    // Calculate offset from cursor to widget top-left
    const widgetElement = e.currentTarget as HTMLElement;
    const widgetRect = widgetElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 32; // pl-8 = 32px (left padding)
    
    dragOffsetRef.current = {
      x: e.clientX - widgetRect.left,
      y: e.clientY - widgetRect.top
    };
    
    setDragPosition({
      x: widgetRect.left - containerRect.left - containerPadding,
      y: widgetRect.top - containerRect.top - containerPadding
    });
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !draggedWidgetRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 32; // pl-8 = 32px (left padding)
    
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

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleDragMove(e);
      handleResizeMove(e);
    };
    
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        handleDragEnd();
      }
      if (isResizingRef.current) {
        handleResizeEnd();
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="bg-gray-800 w-64 flex flex-col h-full border-r border-gray-700">
        <div className="p-4 flex-1 flex flex-col overflow-hidden gap-4">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors mb-4 flex-shrink-0"
          >
            <FaPlus />
            Add Widget
          </button>

          {showAddMenu && (
            <div className="flex-1 bg-gray-700 rounded-lg p-4 overflow-y-auto mb-4">
              <div className="space-y-2">
                {/* Lists Category */}
                <div>
                  <button
                    onClick={() => toggleCategory('lists')}
                    className="w-full flex items-center justify-between text-gray-300 hover:text-white transition-colors p-2 rounded hover:bg-gray-600"
                  >
                    <span className="font-medium">Lists</span>
                    {expandedCategories.lists ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  </button>
                  {expandedCategories.lists && (
                    <div className="ml-4 mt-1 space-y-1">
                      <button onClick={() => addWidget('projects-list')} className="widget-menu-item">Projects List</button>
                      <button onClick={() => addWidget('machines-list')} className="widget-menu-item">Machines List</button>
                      <button onClick={() => addWidget('sensors-list')} className="widget-menu-item">Sensors List</button>
                      <button onClick={() => addWidget('tasks-list')} className="widget-menu-item">Tasks List</button>
                    </div>
                  )}
                </div>
                
                {/* Utilities Category */}
                <div>
                  <button
                    onClick={() => toggleCategory('utilities')}
                    className="w-full flex items-center justify-between text-gray-300 hover:text-white transition-colors p-2 rounded hover:bg-gray-600"
                  >
                    <span className="font-medium">Utilities</span>
                    {expandedCategories.utilities ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  </button>
                  {expandedCategories.utilities && (
                    <div className="ml-4 mt-1 space-y-1">
                      <button onClick={() => addWidget('utility', 'cpu')} className="widget-menu-item">CPU Usage</button>
                      <button onClick={() => addWidget('utility', 'ram')} className="widget-menu-item">Memory</button>
                      <button onClick={() => addWidget('utility', 'disk')} className="widget-menu-item">Disk Space</button>
                      <button onClick={() => addWidget('utility', 'network')} className="widget-menu-item">Network</button>
                      <button onClick={() => addWidget('utility', 'temp')} className="widget-menu-item">Temperature</button>
                    </div>
                  )}
                </div>
                
                {/* Special Category */}
                <div>
                  <button
                    onClick={() => toggleCategory('special')}
                    className="w-full flex items-center justify-between text-gray-300 hover:text-white transition-colors p-2 rounded hover:bg-gray-600"
                  >
                    <span className="font-medium">Special</span>
                    {expandedCategories.special ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  </button>
                  {expandedCategories.special && (
                    <div className="ml-4 mt-1 space-y-1">
                      <button onClick={() => addWidget('wits')} className="w-full text-left text-gray-400 hover:text-white text-sm py-1 px-2 rounded hover:bg-gray-600 transition-colors">WITs Assistant</button>
                      <button onClick={() => addWidget('file-explorer')} className="w-full text-left text-gray-400 hover:text-white text-sm py-1 px-2 rounded hover:bg-gray-600 transition-colors">File Explorer</button>
                      <button onClick={() => addWidget('file-viewer')} className="w-full text-left text-gray-400 hover:text-white text-sm py-1 px-2 rounded hover:bg-gray-600 transition-colors">File Viewer</button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-xs">
                  Click & hold to move. Drag edges to resize.
                </p>
              </div>
            </div>
          )}

          {/* Grid Control - Always visible at bottom */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Columns</label>
              <input
                type="number"
                min="1"
                max="20"
                value={gridColsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setGridColsInput(value);
                  
                  if (value !== '') {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
                      setGridCols(numValue);
                    }
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || parseInt(e.target.value) < 1) {
                    setGridColsInput('1');
                    setGridCols(1);
                  }
                }}
                className="w-full bg-gray-600 text-white rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Rows</label>
              <input
                type="number"
                min="1"
                max="20"
                value={gridRowsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setGridRowsInput(value);
                  
                  if (value !== '') {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
                      setGridRows(numValue);
                    }
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || parseInt(e.target.value) < 1) {
                    setGridRowsInput('1');
                    setGridRows(1);
                  }
                }}
                className="w-full bg-gray-600 text-white rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Clear All Button */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to remove all widgets from the dashboard?')) {
                setWidgets([]);
                localStorage.removeItem('dashboardLayout');
              }
            }}
            className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors"
          >
            Clear All Widgets
          </button>
        </div>
      </div>

      {/* Widget Grid Container */}
      <div ref={containerRef} className="flex-1 relative pl-8 pr-6 py-6 bg-gray-700 overflow-hidden">
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
              className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
              onMouseDown={(e) => handleMouseDown(e, widget)}
              onMouseMove={(e) => handleMouseMove(e, widget)}
            >
              {/* Direct widget content - no wrapper, no title bar */}
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
                  pixelHeight={size.height * gridSize.cellHeight + (size.height - 1) * 16}
                  onNavigate={(page) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page);
                    }
                  }}
                  onNavigateToDetail={(page, id) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page, id);
                    }
                  }}
                  {...commonProps}
                />
              )}
              {widget.type === 'machines-list' && (
                <ListWidget 
                  type="machines" 
                  height={size.height}
                  pixelHeight={size.height * gridSize.cellHeight + (size.height - 1) * 16}
                  onNavigate={(page) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page);
                    }
                  }}
                  onNavigateToDetail={(page, id) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page, id);
                    }
                  }}
                  {...commonProps}
                />
              )}
              {widget.type === 'sensors-list' && (
                <ListWidget 
                  type="sensors" 
                  height={size.height}
                  pixelHeight={size.height * gridSize.cellHeight + (size.height - 1) * 16}
                  onNavigate={(page) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page);
                    }
                  }}
                  onNavigateToDetail={(page, id) => {
                    if ((window as any).__witNavigate) {
                      (window as any).__witNavigate(page, id);
                    }
                  }}
                  {...commonProps}
                />
              )}
              {widget.type === 'tasks-list' && (
                <TasksListWidget />
              )}
              {widget.type === 'wits' && (
                <WITsWidget {...commonProps} />
              )}
              {widget.type === 'utility' && widget.subType && (
                <UtilityWidget 
                  type={widget.subType as 'cpu' | 'ram' | 'disk' | 'network' | 'temp'} 
                  width={size.width}
                  height={size.height}
                  {...commonProps}
                />
              )}
              {widget.type === 'file-explorer' && (
                <FileExplorerWidget {...commonProps} />
              )}
              {widget.type === 'file-viewer' && (
                <FileViewerWidget {...commonProps} />
              )}
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