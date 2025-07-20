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

interface MachinesPageProps {
  onNavigateToDetail?: (id: string) => void;
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

const MachinesPage: React.FC<MachinesPageProps> = ({ onNavigateToDetail }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [machines, setMachines] = useState<Machine[]>(() => {
  // Initialize from localStorage to prevent race condition
  const saved = localStorage.getItem('wit-machines');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      console.log('[MachinesPage] Initial state from localStorage:', parsed.length, 'machines');
      return parsed;
    } catch (e) {
      console.error('[MachinesPage] Failed to parse initial state:', e);
      return [];
    }
  }
  console.log('[MachinesPage] No saved machines, starting with empty array');
  return [];
});

  useEffect(() => {
  // Check what's in localStorage on every render
  const stored = localStorage.getItem('wit-machines');
  console.log('[MachinesPage] Current localStorage:', stored ? 'has data' : 'empty');
}, []); // Run once to check initial state

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
  console.log('[MachinesPage] Component mounted, checking localStorage...');
  const saved = localStorage.getItem('wit-machines');
  
  if (saved) {
    try {
      const parsedMachines = JSON.parse(saved);
      console.log('[MachinesPage] Found', parsedMachines.length, 'saved machines');
      setMachines(parsedMachines);
    } catch (error) {
      console.error('[MachinesPage] Failed to parse saved machines:', error);
      localStorage.removeItem('wit-machines');
    }
  } else {
    console.log('[MachinesPage] No saved machines found');
  }
}, []);

useEffect(() => {
  console.log('[MachinesPage] Saving', machines.length, 'machines to localStorage');
  localStorage.setItem('wit-machines', JSON.stringify(machines));
  
  // Verify it saved
  const saved = localStorage.getItem('wit-machines');
  console.log('[MachinesPage] Verified save:', saved ? JSON.parse(saved).length + ' machines' : 'null');
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
  const filteredMachines = machines.filter(machine => {
    if (filterStatus === 'all') return true;
    return machine.status === filterStatus;
  });

  const sortedMachines = [...filteredMachines].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        const statusOrder = { red: 0, yellow: 1, green: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      case 'date':
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      default:
        return 0;
    }
  });

  // Pagination
  const machinesPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(sortedMachines.length / machinesPerPage);
  const startIndex = (currentPage - 1) * machinesPerPage;
  const currentMachines = sortedMachines.slice(startIndex, startIndex + machinesPerPage);

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

  const handleMouseDown = (e: React.MouseEvent, machine: Machine) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    // Store initial position for navigation detection
    interactionStartPosRef.current = { x: e.clientX, y: e.clientY };
    setCanNavigate(true);
    
    if (direction) {
      // Start resizing
      isResizingRef.current = true;
      resizedMachineRef.current = machine;
      resizeDirectionRef.current = direction;
      const size = machine.size || { width: 1, height: 1 };
      const position = machine.position || { x: 0, y: 0 };
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
        posX: position.x,
        posY: position.y
      };
      e.preventDefault();
    } else {
      // Start dragging
      isDraggingRef.current = true;
      draggedMachineRef.current = machine;
      const rect = element.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent, machine: Machine) => {
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Check if we've moved enough to cancel navigation
      const deltaX = Math.abs(e.clientX - interactionStartPosRef.current.x);
      const deltaY = Math.abs(e.clientY - interactionStartPosRef.current.y);
      if (deltaX > 5 || deltaY > 5) {
        setCanNavigate(false);
      }
      
      if (isDraggingRef.current && draggedMachineRef.current) {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const gap = 16;
        
        // Calculate new position relative to the container
        const newX = e.clientX - rect.left - dragOffsetRef.current.x;
        const newY = e.clientY - rect.top - dragOffsetRef.current.y;

        setDragPosition({ x: newX, y: newY });
      } else if (isResizingRef.current && resizedMachineRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const gap = 16;
        const dir = resizeDirectionRef.current;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = resizeStartRef.current.posX;
        let newY = resizeStartRef.current.posY;
        
        const cellsX = Math.round(deltaX / (gridSize.cellWidth + gap));
        const cellsY = Math.round(deltaY / (gridSize.cellHeight + gap));
        
        // Handle resize based on direction
        if (dir.includes('e')) {
          newWidth = Math.max(1, resizeStartRef.current.width + cellsX);
        }
        if (dir.includes('w')) {
          const widthChange = Math.min(resizeStartRef.current.width - 1, cellsX);
          newWidth = resizeStartRef.current.width - widthChange;
          newX = resizeStartRef.current.posX + widthChange;
        }
        if (dir.includes('s')) {
          newHeight = Math.max(1, resizeStartRef.current.height + cellsY);
        }
        if (dir.includes('n')) {
          const heightChange = Math.min(resizeStartRef.current.height - 1, cellsY);
          newHeight = resizeStartRef.current.height - heightChange;
          newY = resizeStartRef.current.posY + heightChange;
        }
        
        // Ensure within bounds
        newWidth = Math.min(newWidth, gridCols - (dir.includes('w') ? newX : resizeStartRef.current.posX));
        newHeight = Math.min(newHeight, gridRows - (dir.includes('n') ? newY : resizeStartRef.current.posY));
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && draggedMachineRef.current && dragPosition) {
        const gap = 16;
        const cellWidth = gridSize.cellWidth + gap;
        const cellHeight = gridSize.cellHeight + gap;

        const gridX = Math.round(dragPosition.x / cellWidth);
        const gridY = Math.round(dragPosition.y / cellHeight);

        const machine = draggedMachineRef.current;
        const size = machine.size || { width: 1, height: 1 };

        const finalX = Math.max(0, Math.min(gridCols - size.width, gridX));
        const finalY = Math.max(0, Math.min(gridRows - size.height, gridY));

        if (!isPositionOccupied(finalX, finalY, size.width, size.height, machine.id)) {
          setMachines(prevMachines =>
            prevMachines.map(m =>
              m.id === machine.id
                ? { ...m, position: { x: finalX, y: finalY } }
                : m
            )
          );
        }
      } else if (isResizingRef.current && resizedMachineRef.current && resizePreview) {
        const machine = resizedMachineRef.current;
        const newX = resizePreview.x !== undefined ? resizePreview.x : (machine.position?.x || 0);
        const newY = resizePreview.y !== undefined ? resizePreview.y : (machine.position?.y || 0);

        if (!isPositionOccupied(newX, newY, resizePreview.width, resizePreview.height, machine.id)) {
          setMachines(prevMachines =>
            prevMachines.map(m =>
              m.id === machine.id
                ? { 
                    ...m, 
                    size: { width: resizePreview.width, height: resizePreview.height },
                    position: { x: newX, y: newY }
                  }
                : m
            )
          );
        }
      }

      // Reset states
      isDraggingRef.current = false;
      draggedMachineRef.current = null;
      setDragPosition(null);
      isResizingRef.current = false;
      resizedMachineRef.current = null;
      setResizePreview(null);
      
      // Small delay to ensure click event doesn't fire on drag end
      setTimeout(() => {
        setCanNavigate(true);
      }, 100);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragPosition, gridSize, gridCols, gridRows, resizePreview, machines]);

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

    setMachines(prevMachines => {
    const newMachines = [...prevMachines, newMachineData];
    console.log('[MachinesPage] Adding machine, new total:', newMachines.length);
    return newMachines;
  });
    
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
  console.log('[MachinesPage] Deleting machine:', machineId);
  setMachines(prevMachines => prevMachines.filter(m => m.id !== machineId));
  // The useEffect will handle saving automatically
};

  const navigateToMachine = (machineId: string) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(machineId);
    } else {
      console.log(`Navigate to machine ${machineId}`);
    }
  };

  const getConnectionPlaceholder = () => {
    switch (newMachine.connectionType) {
      case 'usb': return '/dev/ttyUSB0 or COM3';
      case 'network': return '192.168.1.100 or printer.local';
      case 'serial': return '/dev/ttyS0 or COM1';
      case 'bluetooth': return 'Device MAC address';
    }
  };

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-4">Machines</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <FaPlus />
            Add Machine
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Filter */}
          <div>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <FaFilter className="w-4 h-4" />
              <span className="font-medium">Filter by Status</span>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="all">All Machines</option>
              <option value="green">Online</option>
              <option value="yellow">Warning</option>
              <option value="red">Offline</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <FaSortAmountDown className="w-4 h-4" />
              <span className="font-medium">Sort by</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="date">Date Added</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Grid Size */}
          <div>
            <label className="block text-gray-300 mb-3 font-medium">Grid Size</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Columns</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={gridCols}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setGridCols(Math.max(1, Math.min(8, val)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-1"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Rows</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={gridRows}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setGridRows(Math.max(1, Math.min(8, val)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-1"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-700 rounded p-4">
            <h3 className="text-white font-medium mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
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
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gray-800 px-3 py-2 rounded shadow-lg">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronLeft className="text-white" />
            </button>
            <span className="text-white px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronRight className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add New Machine</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-5 h-5" />
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
                  {Object.entries(MACHINE_TYPES).map(([value, config]) => (
                    <option key={value} value={value}>{config.defaultName}</option>
                  ))}
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
                    <option key={type} value={type}>{type.toUpperCase()}</option>
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