// src/pages/MachinesPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  connectionType: 'usb' | 'network' | 'serial' | 'bluetooth';
  connectionDetails: string;
  manufacturer: string;
  model?: string;
  notes?: string;
  dateAdded: string;
  // Layout properties
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface MachineTypeConfig {
  defaultName: string;
  connectionTypes: Array<'usb' | 'network' | 'serial' | 'bluetooth'>;
  defaultConnection: 'usb' | 'network' | 'serial' | 'bluetooth';
  manufacturers: string[];
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MACHINE_TYPES: Record<string, MachineTypeConfig> = {
  '3d-printer': {
    defaultName: '3D Printer',
    connectionTypes: ['usb', 'network', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Prusa', 'Ultimaker', 'MakerBot', 'Creality', 'Anycubic', 'Other']
  },
  'laser-cutter': {
    defaultName: 'Laser Cutter',
    connectionTypes: ['usb', 'network'],
    defaultConnection: 'network',
    manufacturers: ['Epilog', 'Trotec', 'Universal Laser', 'Glowforge', 'Other']
  },
  'cnc-mill': {
    defaultName: 'CNC Mill',
    connectionTypes: ['usb', 'serial', 'network'],
    defaultConnection: 'serial',
    manufacturers: ['Haas', 'Tormach', 'ShopBot', 'Carbide 3D', 'Other']
  },
  'vinyl-cutter': {
    defaultName: 'Vinyl Cutter',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Cricut', 'Silhouette', 'Roland', 'Other']
  },
  'soldering': {
    defaultName: 'Soldering Station',
    connectionTypes: ['usb'],
    defaultConnection: 'usb',
    manufacturers: ['Hakko', 'Weller', 'Metcal', 'Other']
  },
  'custom': {
    defaultName: 'Custom Equipment',
    connectionTypes: ['usb', 'network', 'serial', 'bluetooth'],
    defaultConnection: 'network',
    manufacturers: ['Custom', 'Other']
  }
};

const MachinesPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('date');
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);
  const [newMachine, setNewMachine] = useState({
    type: '3d-printer',
    name: '',
    connectionType: 'usb' as 'usb' | 'network' | 'serial' | 'bluetooth',
    connectionDetails: '',
    manufacturer: '',
    model: '',
    notes: ''
  });

  // Drag state
  const isDraggingRef = useRef(false);
  const draggedMachineRef = useRef<Machine | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize state
  const isResizingRef = useRef(false);
  const resizedMachineRef = useRef<Machine | null>(null);
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
    y?: number 
  } | null>(null);

  // Track if an interaction happened
  const interactionStartPosRef = useRef({ x: 0, y: 0 });
  const [canNavigate, setCanNavigate] = useState(true);

  // Load saved machines on mount
  useEffect(() => {
    const saved = localStorage.getItem('wit-machines');
    if (saved) {
      try {
        const parsedMachines = JSON.parse(saved);
        setMachines(parsedMachines);
      } catch (error) {
        console.error('Failed to parse saved machines:', error);
        localStorage.removeItem('wit-machines');
      }
    }
  }, []);

  // Save machines to localStorage whenever they change
  useEffect(() => {
    // Always save the current state, even if empty
    localStorage.setItem('wit-machines', JSON.stringify(machines));
  }, [machines]);

  // Update machine details when type changes
  useEffect(() => {
    const typeConfig = MACHINE_TYPES[newMachine.type];
    if (typeConfig) {
      setNewMachine(prev => ({
        ...prev,
        name: typeConfig.defaultName,
        connectionType: typeConfig.defaultConnection,
        manufacturer: prev.manufacturer || typeConfig.manufacturers[0]
      }));
    }
  }, [newMachine.type]);

  // Calculate grid dimensions
  useEffect(() => {
    const calculateGrid = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const leftPadding = 32;
      const rightPadding = 24;
      const topPadding = 24;
      const bottomPadding = 24;
      const gap = 16;
      
      const availableWidth = container.clientWidth - leftPadding - rightPadding;
      const availableHeight = container.clientHeight - topPadding - bottomPadding;

      const cellWidth = (availableWidth - (gap * (gridCols - 1))) / gridCols;
      const cellHeight = (availableHeight - (gap * (gridRows - 1))) / gridRows;

      setGridSize({ cellWidth, cellHeight });
    };

    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [gridCols, gridRows]);

  // Filter and sort machines
  const filteredAndSortedMachines = React.useMemo(() => {
    let filtered = machines;
    
    if (filterStatus !== 'all') {
      filtered = machines.filter(m => m.status === filterStatus);
    }
    
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const statusOrder = { 'red': 0, 'yellow': 1, 'green': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      } else {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    });
  }, [machines, filterStatus, sortBy]);

  // Pagination
  const itemsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(filteredAndSortedMachines.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMachines = filteredAndSortedMachines.slice(startIndex, endIndex);

  // Check if cursor is near edge of widget
  const getResizeDirection = (e: React.MouseEvent, element: HTMLElement): ResizeDirection | null => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeSize = 10;
    
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

  const handleMouseMove = useCallback((e: React.MouseEvent, machine: Machine) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, machine: Machine) => {
    // Check if clicking on interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    
    if (isInteractive) {
      return;
    }
    
    e.preventDefault();
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    // Store initial position to detect movement
    interactionStartPosRef.current = { x: e.clientX, y: e.clientY };
    setCanNavigate(true);
    
    if (direction) {
      // Start resizing
      isResizingRef.current = true;
      resizedMachineRef.current = machine;
      resizeDirectionRef.current = direction;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: machine.size?.width || 1,
        height: machine.size?.height || 1,
        posX: machine.position?.x || 0,
        posY: machine.position?.y || 0
      };
      element.style.cursor = getCursorStyle(direction);
    } else {
      // Start dragging
      handleDragStart(e, machine);
    }
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, machine: Machine) => {
    if (!containerRef.current) return;
    
    isDraggingRef.current = true;
    draggedMachineRef.current = machine;
    
    const widgetElement = e.currentTarget as HTMLElement;
    const widgetRect = widgetElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 32;
    
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
    if (!isDraggingRef.current || !draggedMachineRef.current || !containerRef.current) return;
    
    // Check if we've moved enough to disable navigation
    const deltaX = Math.abs(e.clientX - interactionStartPosRef.current.x);
    const deltaY = Math.abs(e.clientY - interactionStartPosRef.current.y);
    if (deltaX > 5 || deltaY > 5) {
      setCanNavigate(false);
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerPadding = 32;
    
    setDragPosition({
      x: e.clientX - containerRect.left - dragOffsetRef.current.x - containerPadding,
      y: e.clientY - containerRect.top - dragOffsetRef.current.y - containerPadding
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current || !draggedMachineRef.current || !containerRef.current || !dragPosition) return;
    
    const draggedMachine = draggedMachineRef.current;
    const gap = 16;
    
    // Calculate grid position
    const gridX = Math.max(0, Math.round(dragPosition.x / (gridSize.cellWidth + gap)));
    const gridY = Math.max(0, Math.round(dragPosition.y / (gridSize.cellHeight + gap)));
    
    const newX = Math.min(gridX, Math.max(0, gridCols - (draggedMachine.size?.width || 1)));
    const newY = Math.min(gridY, Math.max(0, gridRows - (draggedMachine.size?.height || 1)));
    
    // Update position
    setMachines(prevMachines => 
      prevMachines.map(m => 
        m.id === draggedMachine.id 
          ? { ...m, position: { x: newX, y: newY } }
          : m
      )
    );
    
    isDraggingRef.current = false;
    draggedMachineRef.current = null;
    setDragPosition(null);
    
    // Delay to prevent navigation on mouse up
    setTimeout(() => {
      setCanNavigate(true);
    }, 100);
  }, [dragPosition, gridSize, gridCols, gridRows]);

  // Resize handlers
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizedMachineRef.current || !containerRef.current) return;
    
    // Check if we've moved enough to disable navigation
    const deltaX = Math.abs(e.clientX - interactionStartPosRef.current.x);
    const deltaY = Math.abs(e.clientY - interactionStartPosRef.current.y);
    if (deltaX > 5 || deltaY > 5) {
      setCanNavigate(false);
    }
    
    const gap = 16;
    const cellWithGap = gridSize.cellWidth + gap;
    const cellHeightWithGap = gridSize.cellHeight + gap;
    
    const deltaX2 = e.clientX - resizeStartRef.current.x;
    const deltaY2 = e.clientY - resizeStartRef.current.y;
    
    const deltaGridX = Math.round(deltaX2 / cellWithGap);
    const deltaGridY = Math.round(deltaY2 / cellHeightWithGap);
    
    const machine = resizedMachineRef.current;
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
    
    // Ensure resize doesn't go out of bounds
    if (newX + newWidth > gridCols) {
      newWidth = gridCols - newX;
    }
    if (newY + newHeight > gridRows) {
      newHeight = gridRows - newY;
    }
    
    // Check for collisions
    const wouldCollide = isPositionOccupied(newX, newY, newWidth, newHeight, machine.id);
    
    if (!wouldCollide) {
      setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
    }
  }, [gridSize, gridCols, gridRows]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current || !resizedMachineRef.current || !resizePreview) return;
    
    const resizedMachine = resizedMachineRef.current;
    
    // Update widget size and position
    setMachines(prevMachines =>
      prevMachines.map(m =>
        m.id === resizedMachine.id
          ? { 
              ...m, 
              size: { width: resizePreview.width, height: resizePreview.height },
              position: { 
                x: resizePreview.x !== undefined ? resizePreview.x : m.position!.x,
                y: resizePreview.y !== undefined ? resizePreview.y : m.position!.y
              }
            }
          : m
      )
    );
    
    isResizingRef.current = false;
    resizedMachineRef.current = null;
    setResizePreview(null);
    
    // Delay to prevent navigation
    setTimeout(() => {
      setCanNavigate(true);
    }, 100);
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

  const isPositionOccupied = (x: number, y: number, width: number, height: number, excludeId?: string): boolean => {
    return currentMachines.some(machine => {
      if (machine.id === excludeId) return false;
      
      const mPos = machine.position || { x: 0, y: 0 };
      const mSize = machine.size || { width: 1, height: 1 };
      
      const collision = !(
        x + width <= mPos.x ||
        x >= mPos.x + mSize.width ||
        y + height <= mPos.y ||
        y >= mPos.y + mSize.height
      );
      
      return collision;
    });
  };

  const findAvailablePosition = (width: number, height: number): { x: number, y: number } | null => {
    for (let y = 0; y <= gridRows - height; y++) {
      for (let x = 0; x <= gridCols - width; x++) {
        if (!isPositionOccupied(x, y, width, height)) {
          return { x, y };
        }
      }
    }
    return null;
  };

  const handleAddMachine = () => {
    const machineId = `M${Date.now()}`;
    const typeConfig = MACHINE_TYPES[newMachine.type];
    
    const position = findAvailablePosition(1, 1);
    if (!position) {
      alert('No space available! Please remove machines or increase grid size.');
      return;
    }
    
    const newMachineData: Machine = {
      id: machineId,
      name: newMachine.name || typeConfig.defaultName,
      type: newMachine.type,
      status: 'yellow',
      metrics: [
        { label: 'Status', value: 'Configuring' },
        { label: 'Connection', value: 'Pending' }
      ],
      connectionType: newMachine.connectionType,
      connectionDetails: newMachine.connectionDetails,
      manufacturer: newMachine.manufacturer,
      model: newMachine.model,
      notes: newMachine.notes,
      dateAdded: new Date().toISOString(),
      position: position,
      size: { width: 1, height: 1 }
    };

    setMachines([...machines, newMachineData]);
    
    // Reset form
    setNewMachine({
      type: '3d-printer',
      name: '',
      connectionType: 'usb',
      connectionDetails: '',
      manufacturer: '',
      model: '',
      notes: ''
    });
    
    setShowAddModal(false);
  };

  const handleDeleteMachine = (machineId: string) => {
    setMachines(prevMachines => {
      const newMachines = prevMachines.filter(m => m.id !== machineId);
      // Force immediate localStorage update
      localStorage.setItem('wit-machines', JSON.stringify(newMachines));
      return newMachines;
    });
  };

  const navigateToMachine = (machineId: string) => {
    console.log(`Navigate to machine ${machineId}`);
    // Implement navigation logic
  };

  const getConnectionPlaceholder = () => {
    switch (newMachine.connectionType) {
      case 'usb': return '/dev/ttyUSB0 or COM3';
      case 'network': return '192.168.1.100 or printer.local';
      case 'serial': return '/dev/ttyS0 or COM1';
      case 'bluetooth': return 'HC-05 or 00:11:22:33:44:55';
    }
  };

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Sidebar */}
      <div className="bg-gray-800 w-64 p-4 flex flex-col gap-4 border-r border-gray-700">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <FaPlus />
          Add Machine
        </button>

        {/* Filter & Sort */}
        <div className="bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-300">
            <FaFilter className="w-4 h-4" />
            <span className="font-medium">Filter & Sort</span>
          </div>
          
          {/* Status Filter */}
          <div>
            <label className="text-sm text-gray-400">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="green">Online</option>
              <option value="yellow">Warning</option>
              <option value="red">Offline</option>
            </select>
          </div>
          
          {/* Sort */}
          <div>
            <label className="text-sm text-gray-400">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value="date">Date Added</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {/* Grid Controls */}
        <div className="bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="text-gray-300 font-medium">Grid Layout</div>
          <div className="space-y-2">
            <div>
              <label className="text-sm text-gray-400">Columns</label>
              <input
                type="number"
                min="1"
                max="6"
                value={gridCols}
                onChange={(e) => setGridCols(Number(e.target.value))}
                className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Rows</label>
              <input
                type="number"
                min="1"
                max="6"
                value={gridRows}
                onChange={(e) => setGridRows(Number(e.target.value))}
                className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-300 font-medium mb-2">Statistics</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total:</span>
              <span className="text-white">{machines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Online:</span>
              <span className="text-green-400">{machines.filter(m => m.status === 'green').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Warning:</span>
              <span className="text-yellow-400">{machines.filter(m => m.status === 'yellow').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Offline:</span>
              <span className="text-red-400">{machines.filter(m => m.status === 'red').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto relative">
        <div
          ref={containerRef}
          className="relative h-full"
          style={{ minHeight: '400px' }}
        >
          {/* Machine Grid */}
          {currentMachines.map((machine, index) => {
            const position = machine.position || { x: index % gridCols, y: Math.floor(index / gridCols) };
            const size = machine.size || { width: 1, height: 1 };
            const gap = 16;
            
            const isDragging = isDraggingRef.current && draggedMachineRef.current?.id === machine.id;
            const isResizing = isResizingRef.current && resizedMachineRef.current?.id === machine.id;
            
            const displayPosition = (isDragging && dragPosition) 
              ? dragPosition 
              : (isResizing && resizePreview && (resizePreview.x !== undefined || resizePreview.y !== undefined))
              ? { x: (resizePreview.x !== undefined ? resizePreview.x : position.x) * (gridSize.cellWidth + gap), 
                  y: (resizePreview.y !== undefined ? resizePreview.y : position.y) * (gridSize.cellHeight + gap) }
              : { x: position.x * (gridSize.cellWidth + gap), y: position.y * (gridSize.cellHeight + gap) };
            
            const displaySize = (isResizing && resizePreview) 
              ? { width: resizePreview.width, height: resizePreview.height }
              : size;
            
            const style = {
              position: 'absolute' as const,
              left: `${displayPosition.x}px`,
              top: `${displayPosition.y}px`,
              width: `${displaySize.width * gridSize.cellWidth + (displaySize.width - 1) * gap}px`,
              height: `${displaySize.height * gridSize.cellHeight + (displaySize.height - 1) * gap}px`,
              transition: isDragging || isResizing ? 'none' : 'all 0.2s ease-in-out',
              zIndex: isDragging || isResizing ? 1000 : 1,
              opacity: isDragging ? 0.8 : 1,
            };

            return (
              <div
                key={machine.id}
                style={style}
                className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
                onMouseDown={(e) => handleMouseDown(e, machine)}
                onMouseMove={(e) => handleMouseMove(e, machine)}
                onMouseLeave={(e) => {
                  if (!isDraggingRef.current && !isResizingRef.current) {
                    (e.currentTarget as HTMLElement).style.cursor = 'default';
                  }
                }}
              >
                <SpecificWidget
                  type="machine"
                  data={machine}
                  onRemove={() => handleDeleteMachine(machine.id)}
                  onNavigate={() => {
                    if (canNavigate && !isDraggingRef.current && !isResizingRef.current) {
                      navigateToMachine(machine.id);
                    }
                  }}
                />
              </div>
            );
          })}
          
          {/* Grid overlay */}
          {(isDraggingRef.current || isResizingRef.current) && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: gridRows * gridCols }, (_, index) => {
                const row = Math.floor(index / gridCols);
                const col = index % gridCols;
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-2 shadow-lg">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="text-white disabled:text-gray-500 hover:text-blue-400 transition-colors"
            >
              <FaChevronLeft />
            </button>
            <span className="text-white text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="text-white disabled:text-gray-500 hover:text-blue-400 transition-colors"
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Add New Machine</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              {/* Machine Type */}
              <div>
                <label className="block text-gray-300 mb-1">Machine Type</label>
                <select
                  value={newMachine.type}
                  onChange={(e) => setNewMachine({ ...newMachine, type: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="3d-printer">3D Printer</option>
                  <option value="laser-cutter">Laser Cutter</option>
                  <option value="cnc-mill">CNC Mill</option>
                  <option value="vinyl-cutter">Vinyl Cutter</option>
                  <option value="soldering">Soldering Station</option>
                  <option value="custom">Custom Equipment</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newMachine.name}
                  onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                  placeholder={MACHINE_TYPES[newMachine.type].defaultName}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-gray-300 mb-1">Connection Type</label>
                <select
                  value={newMachine.connectionType}
                  onChange={(e) => setNewMachine({ ...newMachine, connectionType: e.target.value as any })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {MACHINE_TYPES[newMachine.type].connectionTypes.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Connection Details */}
              <div>
                <label className="block text-gray-300 mb-1">
                  {newMachine.connectionType === 'network' ? 'IP Address/Hostname' : 'Port/Address'}
                </label>
                <input
                  type="text"
                  value={newMachine.connectionDetails}
                  onChange={(e) => setNewMachine({ ...newMachine, connectionDetails: e.target.value })}
                  placeholder={getConnectionPlaceholder()}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-gray-300 mb-1">Manufacturer</label>
                <select
                  value={newMachine.manufacturer}
                  onChange={(e) => setNewMachine({ ...newMachine, manufacturer: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {MACHINE_TYPES[newMachine.type].manufacturers.map(mfg => (
                    <option key={mfg} value={mfg}>{mfg}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-gray-300 mb-1">Model (Optional)</label>
                <input
                  type="text"
                  value={newMachine.model}
                  onChange={(e) => setNewMachine({ ...newMachine, model: e.target.value })}
                  placeholder="e.g., MK3S+, Pro XL"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={newMachine.notes}
                  onChange={(e) => setNewMachine({ ...newMachine, notes: e.target.value })}
                  placeholder="Additional details or configuration notes"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddMachine}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Add Machine
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachinesPage;