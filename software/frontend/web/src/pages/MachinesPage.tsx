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
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('name');
  
  // Grid configuration
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [gridColsInput, setGridColsInput] = useState('4');
  const [gridRowsInput, setGridRowsInput] = useState('3');

  // Drag state
  const isDraggingRef = useRef(false);
  const draggedMachineRef = useRef<Machine | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const preventNavigationRef = useRef(false);
  
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
    y?: number;
  } | null>(null);

  // Add machine form state
  const [newMachine, setNewMachine] = useState({
    type: '3d-printer',
    name: '',
    connectionType: 'usb' as 'usb' | 'network' | 'serial' | 'bluetooth',
    connectionDetails: '',
    manufacturer: '',
    model: '',
    notes: ''
  });

  // Load machines from localStorage on mount
  useEffect(() => {
    const savedMachines = localStorage.getItem('wit-machines');
    if (savedMachines) {
      try {
        const parsed = JSON.parse(savedMachines);
        // Ensure all machines have position and size
        const machinesWithLayout = parsed.map((m: Machine) => ({
          ...m,
          position: m.position || { x: 0, y: 0 },
          size: m.size || { width: 1, height: 1 }
        }));
        setMachines(machinesWithLayout);
      } catch (e) {
        console.error('Failed to load machines:', e);
      }
    }
  }, []);

  // Save machines to localStorage whenever they change
  useEffect(() => {
    if (machines.length > 0 || localStorage.getItem('wit-machines')) {
      localStorage.setItem('wit-machines', JSON.stringify(machines));
    }
  }, [machines]);

  // Update form defaults when machine type changes
  useEffect(() => {
    const typeConfig = MACHINE_TYPES[newMachine.type];
    if (typeConfig) {
      setNewMachine(prev => ({
        ...prev,
        name: typeConfig.defaultName, // Always use default name
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

  // Filter and sort machines (ignore position for display order)
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
      } else { // date
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

  // Position and collision detection
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

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent, machine: Machine) => {
    // Check if the click is on an interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    
    // Reset flags
    hasDraggedRef.current = false;
    preventNavigationRef.current = false;
    
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
      resizedMachineRef.current = machine;
      resizeDirectionRef.current = direction;
      
      const mPos = machine.position || { x: 0, y: 0 };
      const mSize = machine.size || { width: 1, height: 1 };
      
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: mSize.width,
        height: mSize.height,
        posX: mPos.x,
        posY: mPos.y
      };
      
      element.style.cursor = getCursorStyle(direction);
      setResizePreview({ width: mSize.width, height: mSize.height });
    } else {
      // Start dragging
      e.preventDefault();
      
      isDraggingRef.current = true;
      draggedMachineRef.current = machine;
      
      const rect = element.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      setDragPosition({
        x: rect.left - containerRect.left - 32,
        y: rect.top - containerRect.top - 24
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent, machine: Machine) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !draggedMachineRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffsetRef.current.x - 32;
    const newY = e.clientY - containerRect.top - dragOffsetRef.current.y - 24;
    
    // Mark that actual dragging has occurred
    hasDraggedRef.current = true;
    
    setDragPosition({ x: newX, y: newY });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current || !draggedMachineRef.current || !dragPosition || !containerRef.current) return;
    
    const gap = 16;
    const gridX = Math.round(dragPosition.x / (gridSize.cellWidth + gap));
    const gridY = Math.round(dragPosition.y / (gridSize.cellHeight + gap));
    
    const mSize = draggedMachineRef.current.size || { width: 1, height: 1 };
    const clampedX = Math.max(0, Math.min(gridCols - mSize.width, gridX));
    const clampedY = Math.max(0, Math.min(gridRows - mSize.height, gridY));
    
    if (!isPositionOccupied(clampedX, clampedY, mSize.width, mSize.height, draggedMachineRef.current.id)) {
      setMachines(prev =>
        prev.map(m =>
          m.id === draggedMachineRef.current!.id
            ? { ...m, position: { x: clampedX, y: clampedY } }
            : m
        )
      );
    }
    
    isDraggingRef.current = false;
    draggedMachineRef.current = null;
    
    // Prevent navigation after drag
    if (hasDraggedRef.current) {
      preventNavigationRef.current = true;
      setTimeout(() => {
        preventNavigationRef.current = false;
      }, 100);
    }
    
    hasDraggedRef.current = false;
    setDragPosition(null);
  }, [dragPosition, gridSize, gridCols, gridRows]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizedMachineRef.current) return;
    
    // Mark that interaction has occurred
    hasDraggedRef.current = true;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    const gap = 16;
    
    const cellsX = Math.round(deltaX / (gridSize.cellWidth + gap));
    const cellsY = Math.round(deltaY / (gridSize.cellHeight + gap));
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = resizeStartRef.current.posX;
    let newY = resizeStartRef.current.posY;
    
    const dir = resizeDirectionRef.current;
    
    // Handle width changes
    if (dir.includes('e')) {
      newWidth = Math.max(1, Math.min(gridCols - newX, resizeStartRef.current.width + cellsX));
    } else if (dir.includes('w')) {
      const potentialWidth = resizeStartRef.current.width - cellsX;
      const potentialX = resizeStartRef.current.posX + cellsX;
      if (potentialWidth >= 1 && potentialX >= 0) {
        newWidth = potentialWidth;
        newX = potentialX;
      }
    }
    
    // Handle height changes
    if (dir.includes('s')) {
      newHeight = Math.max(1, Math.min(gridRows - newY, resizeStartRef.current.height + cellsY));
    } else if (dir.includes('n')) {
      const potentialHeight = resizeStartRef.current.height - cellsY;
      const potentialY = resizeStartRef.current.posY + cellsY;
      if (potentialHeight >= 1 && potentialY >= 0) {
        newHeight = potentialHeight;
        newY = potentialY;
      }
    }
    
    // Check if new size/position is valid
    const isValid = !isPositionOccupied(newX, newY, newWidth, newHeight, resizedMachineRef.current.id);
    
    if (isValid) {
      setResizePreview({ 
        width: newWidth, 
        height: newHeight,
        x: newX,
        y: newY
      });
    }
  }, [gridSize, gridCols, gridRows]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current || !resizedMachineRef.current || !resizePreview) return;
    
    setMachines(prev =>
      prev.map(m =>
        m.id === resizedMachineRef.current!.id
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
    
    // Prevent navigation after resize
    if (hasDraggedRef.current) {
      preventNavigationRef.current = true;
      setTimeout(() => {
        preventNavigationRef.current = false;
      }, 100);
    }
    
    hasDraggedRef.current = false;
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

  const handleAddMachine = () => {
    const machineId = `M${Date.now()}`;
    const typeConfig = MACHINE_TYPES[newMachine.type];
    
    // Find available position
    const position = findAvailablePosition(1, 1);
    if (!position) {
      alert('No space available! Please remove machines or increase grid size.');
      return;
    }
    
    // Determine initial status based on connection
    let status: 'green' | 'yellow' | 'red' = 'yellow';
    let statusText = 'Configuring';
    
    const newMachineData: Machine = {
      id: machineId,
      name: newMachine.name || typeConfig.defaultName,
      type: newMachine.type,
      status: status,
      metrics: [
        { label: 'Status', value: statusText },
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
    setMachines(machines.filter(m => m.id !== machineId));
  };

  const navigateToMachine = (machineId: string) => {
    console.log(`Navigate to machine ${machineId}`);
    // Implement navigation logic
  };

  const getPosition = (machine: Machine, index: number) => {
    // Use stored position if available, otherwise calculate based on index
    if (machine.position) {
      return machine.position;
    }
    const row = Math.floor(index / gridCols);
    const col = index % gridCols;
    return { x: col, y: row };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'text-green-400';
      case 'yellow': return 'text-yellow-400';
      case 'red': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConnectionPlaceholder = () => {
    switch (newMachine.connectionType) {
      case 'usb': return '/dev/ttyUSB0 or COM3';
      case 'network': return '192.168.1.100 or printer.local';
      case 'serial': return '/dev/ttyS0 or COM1';
      case 'bluetooth': return 'AA:BB:CC:DD:EE:FF';
      default: return 'Enter connection details';
    }
  };

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar */}
      <div className="bg-gray-800 w-64 flex flex-col h-full border-r border-gray-700">
        <div className="p-4 flex-1 flex flex-col overflow-hidden gap-4">
          <h1 className="text-2xl font-bold text-white mb-2">Machines</h1>
          
          {/* Add Machine Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <FaPlus />
            Add Machine
          </button>

          {/* Status Filter */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FaFilter className="text-gray-400" />
              <span className="text-gray-300 font-medium">Filter by Status</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="all"
                  checked={filterStatus === 'all'}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-gray-300">All Machines</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="green"
                  checked={filterStatus === 'green'}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-green-400"
                />
                <span className={getStatusColor('green')}>Online</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="yellow"
                  checked={filterStatus === 'yellow'}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-yellow-400"
                />
                <span className={getStatusColor('yellow')}>Warning</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="red"
                  checked={filterStatus === 'red'}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-red-400"
                />
                <span className={getStatusColor('red')}>Offline</span>
              </label>
            </div>
          </div>

          {/* Sort Options */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FaSortAmountDown className="text-gray-400" />
              <span className="text-gray-300 font-medium">Sort By</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'date')}
              className="w-full bg-gray-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="date">Date Added</option>
            </select>
          </div>

          {/* Machine Stats */}
          <div className="bg-gray-700 rounded-lg p-4 mt-auto">
            <h3 className="text-gray-300 font-medium mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-white">{filteredAndSortedMachines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('green')}>Online:</span>
                <span className="text-white">{machines.filter(m => m.status === 'green').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('yellow')}>Warning:</span>
                <span className="text-white">{machines.filter(m => m.status === 'yellow').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('red')}>Offline:</span>
                <span className="text-white">{machines.filter(m => m.status === 'red').length}</span>
              </div>
            </div>
          </div>

          {/* Grid Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Columns</label>
              <input
                type="number"
                min="1"
                max="10"
                value={gridColsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setGridColsInput(value);
                  
                  if (value !== '') {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
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
                max="10"
                value={gridRowsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setGridRowsInput(value);
                  
                  if (value !== '') {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
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
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Grid Container */}
        <div ref={containerRef} className="flex-1 relative pl-8 pr-6 py-6 bg-gray-700 overflow-hidden">
          {machines.length === 0 && !showAddModal && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 mb-4">No machines configured yet</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2 mx-auto transition-colors"
                >
                  <FaPlus />
                  Add Your First Machine
                </button>
              </div>
            </div>
          )}
          
          {currentMachines.map((machine, index) => {
            const isResizing = isResizingRef.current && resizedMachineRef.current?.id === machine.id;
            const position = (isResizing && resizePreview?.x !== undefined && resizePreview?.y !== undefined)
              ? { x: resizePreview.x, y: resizePreview.y }
              : getPosition(machine, index);
            const size = (isResizing && resizePreview) 
              ? { width: resizePreview.width, height: resizePreview.height }
              : (machine.size || { width: 1, height: 1 });
            
            if (gridSize.cellWidth === 0 || gridSize.cellHeight === 0) {
              return null;
            }

            const isDragging = isDraggingRef.current && draggedMachineRef.current?.id === machine.id;
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

            return (
              <div
                key={machine.id}
                style={style}
                className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
                onMouseDown={(e) => handleMouseDown(e, machine)}
                onMouseMove={(e) => handleMouseMove(e, machine)}
                onMouseLeave={(e) => {
                  // Reset cursor when leaving widget
                  if (!isDraggingRef.current && !isResizingRef.current) {
                    (e.currentTarget as HTMLElement).style.cursor = 'default';
                  }
                }}
              >
                {/* Widget content - let it handle its own delete button and navigation */}
                <SpecificWidget
                  type="machine"
                  data={machine}
                  onRemove={() => handleDeleteMachine(machine.id)}
                  onNavigate={() => {
                    // Only navigate if navigation is not prevented
                    if (!preventNavigationRef.current && !isDraggingRef.current && !isResizingRef.current) {
                      navigateToMachine(machine.id);
                    }
                  }}
                />
              </div>
            );
          })}
          
          {/* Grid overlay (optional - helps visualize grid) */}
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

              {/* Machine Name */}
              <div>
                <label className="block text-gray-300 mb-1">Machine Name</label>
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
                      {type.toUpperCase()}
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