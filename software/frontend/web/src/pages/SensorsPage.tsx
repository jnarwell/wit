// src/pages/SensorsPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Sensor {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  connectionType: 'i2c' | 'spi' | 'analog' | 'digital' | 'uart' | 'wireless';
  connectionDetails: string;
  manufacturer: string;
  model?: string;
  notes?: string;
  dateAdded: string;
  // Layout properties
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface SensorTypeConfig {
  defaultName: string;
  connectionTypes: Array<'i2c' | 'spi' | 'analog' | 'digital' | 'uart' | 'wireless'>;
  defaultConnection: 'i2c' | 'spi' | 'analog' | 'digital' | 'uart' | 'wireless';
  manufacturers: string[];
  defaultMetrics: { label: string; value: string }[];
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const SENSOR_TYPES: Record<string, SensorTypeConfig> = {
  'temperature': {
    defaultName: 'Temperature Sensor',
    connectionTypes: ['i2c', 'spi', 'analog', 'digital'],
    defaultConnection: 'i2c',
    manufacturers: ['DHT', 'Dallas', 'Bosch', 'Sensirion', 'Other'],
    defaultMetrics: [
      { label: 'Temperature', value: '-- °C' },
      { label: 'Status', value: 'Initializing' }
    ]
  },
  'humidity': {
    defaultName: 'Humidity Sensor',
    connectionTypes: ['i2c', 'spi', 'analog'],
    defaultConnection: 'i2c',
    manufacturers: ['DHT', 'Sensirion', 'Bosch', 'Other'],
    defaultMetrics: [
      { label: 'Humidity', value: '-- %' },
      { label: 'Status', value: 'Initializing' }
    ]
  },
  'pressure': {
    defaultName: 'Pressure Sensor',
    connectionTypes: ['i2c', 'spi', 'analog'],
    defaultConnection: 'i2c',
    manufacturers: ['Bosch', 'STMicroelectronics', 'NXP', 'Other'],
    defaultMetrics: [
      { label: 'Pressure', value: '-- hPa' },
      { label: 'Status', value: 'Initializing' }
    ]
  },
  'motion': {
    defaultName: 'Motion Sensor',
    connectionTypes: ['digital', 'analog', 'i2c'],
    defaultConnection: 'digital',
    manufacturers: ['PIR', 'Microwave', 'Ultrasonic', 'Other'],
    defaultMetrics: [
      { label: 'Motion', value: 'No Motion' },
      { label: 'Sensitivity', value: 'Normal' }
    ]
  },
  'light': {
    defaultName: 'Light Sensor',
    connectionTypes: ['i2c', 'analog', 'digital'],
    defaultConnection: 'analog',
    manufacturers: ['TSL', 'BH1750', 'VEML', 'Other'],
    defaultMetrics: [
      { label: 'Light Level', value: '-- lux' },
      { label: 'Status', value: 'Calibrating' }
    ]
  },
  'air-quality': {
    defaultName: 'Air Quality Sensor',
    connectionTypes: ['i2c', 'uart', 'analog'],
    defaultConnection: 'i2c',
    manufacturers: ['Sensirion', 'Plantower', 'Winsen', 'Other'],
    defaultMetrics: [
      { label: 'AQI', value: '--' },
      { label: 'PM2.5', value: '-- µg/m³' }
    ]
  },
  'custom': {
    defaultName: 'Custom Sensor',
    connectionTypes: ['i2c', 'spi', 'analog', 'digital', 'uart', 'wireless'],
    defaultConnection: 'i2c',
    manufacturers: ['Custom', 'Other'],
    defaultMetrics: [
      { label: 'Value', value: '--' },
      { label: 'Status', value: 'Configuring' }
    ]
  }
};

const SensorsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('date');
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [newSensor, setNewSensor] = useState({
    type: 'temperature',
    name: '',
    connectionType: 'i2c' as 'i2c' | 'spi' | 'analog' | 'digital' | 'uart' | 'wireless',
    connectionDetails: '',
    manufacturer: '',
    model: '',
    notes: ''
  });

  // Drag state
  const isDraggingRef = useRef(false);
  const draggedSensorRef = useRef<Sensor | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize state
  const isResizingRef = useRef(false);
  const resizedSensorRef = useRef<Sensor | null>(null);
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

  // Load saved sensors on mount
  useEffect(() => {
    const saved = localStorage.getItem('wit-sensors');
    if (saved) {
      try {
        const parsedSensors = JSON.parse(saved);
        setSensors(parsedSensors);
      } catch (error) {
        console.error('Failed to parse saved sensors:', error);
        localStorage.removeItem('wit-sensors');
      }
    }
  }, []);

  // Save sensors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('wit-sensors', JSON.stringify(sensors));
  }, [sensors]);

  // Update sensor details when type changes
  useEffect(() => {
    const typeConfig = SENSOR_TYPES[newSensor.type];
    if (typeConfig) {
      setNewSensor(prev => ({
        ...prev,
        name: typeConfig.defaultName,
        connectionType: typeConfig.defaultConnection,
        manufacturer: prev.manufacturer || typeConfig.manufacturers[0]
      }));
    }
  }, [newSensor.type]);

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

  // Filter and sort sensors
  const filteredAndSortedSensors = React.useMemo(() => {
    let filtered = sensors;
    
    if (filterStatus !== 'all') {
      filtered = sensors.filter(s => s.status === filterStatus);
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
  }, [sensors, filterStatus, sortBy]);

  // Pagination
  const itemsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(filteredAndSortedSensors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSensors = filteredAndSortedSensors.slice(startIndex, endIndex);

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

  const handleMouseMove = useCallback((e: React.MouseEvent, sensor: Sensor) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, sensor: Sensor) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    
    if (isInteractive) {
      return;
    }
    
    e.preventDefault();
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    interactionStartPosRef.current = { x: e.clientX, y: e.clientY };
    setCanNavigate(true);
    
    if (direction) {
      isResizingRef.current = true;
      resizedSensorRef.current = sensor;
      resizeDirectionRef.current = direction;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: sensor.size?.width || 1,
        height: sensor.size?.height || 1,
        posX: sensor.position?.x || 0,
        posY: sensor.position?.y || 0
      };
      element.style.cursor = getCursorStyle(direction);
    } else {
      handleDragStart(e, sensor);
    }
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, sensor: Sensor) => {
    if (!containerRef.current) return;
    
    isDraggingRef.current = true;
    draggedSensorRef.current = sensor;
    
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
    if (!isDraggingRef.current || !draggedSensorRef.current || !containerRef.current) return;
    
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
    if (!isDraggingRef.current || !draggedSensorRef.current || !containerRef.current || !dragPosition) return;
    
    const draggedSensor = draggedSensorRef.current;
    const gap = 16;
    
    const gridX = Math.max(0, Math.round(dragPosition.x / (gridSize.cellWidth + gap)));
    const gridY = Math.max(0, Math.round(dragPosition.y / (gridSize.cellHeight + gap)));
    
    const newX = Math.min(gridX, Math.max(0, gridCols - (draggedSensor.size?.width || 1)));
    const newY = Math.min(gridY, Math.max(0, gridRows - (draggedSensor.size?.height || 1)));
    
    setSensors(prevSensors => 
      prevSensors.map(s => 
        s.id === draggedSensor.id 
          ? { ...s, position: { x: newX, y: newY } }
          : s
      )
    );
    
    isDraggingRef.current = false;
    draggedSensorRef.current = null;
    setDragPosition(null);
    
    setTimeout(() => {
      setCanNavigate(true);
    }, 100);
  }, [dragPosition, gridSize, gridCols, gridRows]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizedSensorRef.current || !containerRef.current) return;
    
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
    
    const sensor = resizedSensorRef.current;
    const direction = resizeDirectionRef.current;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = resizeStartRef.current.posX;
    let newY = resizeStartRef.current.posY;
    
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
    
    if (newX + newWidth > gridCols) {
      newWidth = gridCols - newX;
    }
    if (newY + newHeight > gridRows) {
      newHeight = gridRows - newY;
    }
    
    const wouldCollide = isPositionOccupied(newX, newY, newWidth, newHeight, sensor.id);
    
    if (!wouldCollide) {
      setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
    }
  }, [gridSize, gridCols, gridRows]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current || !resizedSensorRef.current || !resizePreview) return;
    
    const resizedSensor = resizedSensorRef.current;
    
    setSensors(prevSensors =>
      prevSensors.map(s =>
        s.id === resizedSensor.id
          ? { 
              ...s, 
              size: { width: resizePreview.width, height: resizePreview.height },
              position: { 
                x: resizePreview.x !== undefined ? resizePreview.x : s.position!.x,
                y: resizePreview.y !== undefined ? resizePreview.y : s.position!.y
              }
            }
          : s
      )
    );
    
    isResizingRef.current = false;
    resizedSensorRef.current = null;
    setResizePreview(null);
    
    setTimeout(() => {
      setCanNavigate(true);
    }, 100);
  }, [resizePreview]);

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
    return currentSensors.some(sensor => {
      if (sensor.id === excludeId) return false;
      
      const sPos = sensor.position || { x: 0, y: 0 };
      const sSize = sensor.size || { width: 1, height: 1 };
      
      const collision = !(
        x + width <= sPos.x ||
        x >= sPos.x + sSize.width ||
        y + height <= sPos.y ||
        y >= sPos.y + sSize.height
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

  const handleAddSensor = () => {
    const sensorId = `S${Date.now()}`;
    const typeConfig = SENSOR_TYPES[newSensor.type];
    
    const position = findAvailablePosition(1, 1);
    if (!position) {
      alert('No space available! Please remove sensors or increase grid size.');
      return;
    }
    
    const newSensorData: Sensor = {
      id: sensorId,
      name: newSensor.name || typeConfig.defaultName,
      type: newSensor.type,
      status: 'yellow',
      metrics: typeConfig.defaultMetrics,
      connectionType: newSensor.connectionType,
      connectionDetails: newSensor.connectionDetails,
      manufacturer: newSensor.manufacturer,
      model: newSensor.model,
      notes: newSensor.notes,
      dateAdded: new Date().toISOString(),
      position: position,
      size: { width: 1, height: 1 }
    };

    setSensors([...sensors, newSensorData]);
    
    setNewSensor({
      type: 'temperature',
      name: '',
      connectionType: 'i2c',
      connectionDetails: '',
      manufacturer: '',
      model: '',
      notes: ''
    });
    
    setShowAddModal(false);
  };

  const handleDeleteSensor = (sensorId: string) => {
    setSensors(prevSensors => {
      const newSensors = prevSensors.filter(s => s.id !== sensorId);
      localStorage.setItem('wit-sensors', JSON.stringify(newSensors));
      return newSensors;
    });
  };

  const navigateToSensor = (sensorId: string) => {
    console.log(`Navigate to sensor ${sensorId}`);
    // Implement navigation logic
  };

  const getConnectionPlaceholder = () => {
    switch (newSensor.connectionType) {
      case 'i2c': return '0x48 or 0x77';
      case 'spi': return 'SPI0 CS0';
      case 'analog': return 'A0-A5';
      case 'digital': return 'D2-D8';
      case 'uart': return '/dev/ttyAMA0';
      case 'wireless': return '192.168.1.100 or sensor.local';
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
          Add Sensor
        </button>

        {/* Filter & Sort */}
        <div className="bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-300">
            <FaFilter className="w-4 h-4" />
            <span className="font-medium">Filter & Sort</span>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="green">Active</option>
              <option value="yellow">Warning</option>
              <option value="red">Error</option>
            </select>
          </div>
          
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
                max="8"
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
              <span className="text-white">{sensors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active:</span>
              <span className="text-green-400">{sensors.filter(s => s.status === 'green').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Warning:</span>
              <span className="text-yellow-400">{sensors.filter(s => s.status === 'yellow').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Error:</span>
              <span className="text-red-400">{sensors.filter(s => s.status === 'red').length}</span>
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
          {/* Sensor Grid */}
          {currentSensors.map((sensor, index) => {
            const position = sensor.position || { x: index % gridCols, y: Math.floor(index / gridCols) };
            const size = sensor.size || { width: 1, height: 1 };
            const gap = 16;
            
            const isDragging = isDraggingRef.current && draggedSensorRef.current?.id === sensor.id;
            const isResizing = isResizingRef.current && resizedSensorRef.current?.id === sensor.id;
            
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
                key={sensor.id}
                style={style}
                className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
                onMouseDown={(e) => handleMouseDown(e, sensor)}
                onMouseMove={(e) => handleMouseMove(e, sensor)}
                onMouseLeave={(e) => {
                  if (!isDraggingRef.current && !isResizingRef.current) {
                    (e.currentTarget as HTMLElement).style.cursor = 'default';
                  }
                }}
              >
                <SpecificWidget
                  type="sensor"
                  data={sensor}
                  onRemove={() => handleDeleteSensor(sensor.id)}
                  onNavigate={() => {
                    if (canNavigate && !isDraggingRef.current && !isResizingRef.current) {
                      navigateToSensor(sensor.id);
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

      {/* Add Sensor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Add New Sensor</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sensor Type */}
              <div>
                <label className="block text-gray-300 mb-1">Sensor Type</label>
                <select
                  value={newSensor.type}
                  onChange={(e) => setNewSensor({ ...newSensor, type: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="pressure">Pressure</option>
                  <option value="motion">Motion</option>
                  <option value="light">Light</option>
                  <option value="air-quality">Air Quality</option>
                  <option value="custom">Custom Sensor</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newSensor.name}
                  onChange={(e) => setNewSensor({ ...newSensor, name: e.target.value })}
                  placeholder={SENSOR_TYPES[newSensor.type].defaultName}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-gray-300 mb-1">Connection Type</label>
                <select
                  value={newSensor.connectionType}
                  onChange={(e) => setNewSensor({ ...newSensor, connectionType: e.target.value as any })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {SENSOR_TYPES[newSensor.type].connectionTypes.map(type => (
                    <option key={type} value={type}>
                      {type.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Connection Details */}
              <div>
                <label className="block text-gray-300 mb-1">
                  {newSensor.connectionType === 'i2c' ? 'I2C Address' : 
                   newSensor.connectionType === 'spi' ? 'SPI Bus/CS' :
                   newSensor.connectionType === 'analog' ? 'Analog Pin' :
                   newSensor.connectionType === 'digital' ? 'Digital Pin' :
                   newSensor.connectionType === 'uart' ? 'UART Port' :
                   'Address/Port'}
                </label>
                <input
                  type="text"
                  value={newSensor.connectionDetails}
                  onChange={(e) => setNewSensor({ ...newSensor, connectionDetails: e.target.value })}
                  placeholder={getConnectionPlaceholder()}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-gray-300 mb-1">Manufacturer</label>
                <select
                  value={newSensor.manufacturer}
                  onChange={(e) => setNewSensor({ ...newSensor, manufacturer: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {SENSOR_TYPES[newSensor.type].manufacturers.map(mfg => (
                    <option key={mfg} value={mfg}>{mfg}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-gray-300 mb-1">Model (Optional)</label>
                <input
                  type="text"
                  value={newSensor.model}
                  onChange={(e) => setNewSensor({ ...newSensor, model: e.target.value })}
                  placeholder="e.g., DHT22, BMP280"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={newSensor.notes}
                  onChange={(e) => setNewSensor({ ...newSensor, notes: e.target.value })}
                  placeholder="Additional details or calibration notes"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddSensor}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Add Sensor
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

export default SensorsPage;