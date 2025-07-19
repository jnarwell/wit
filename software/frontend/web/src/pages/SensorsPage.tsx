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

interface SensorsPageProps {
  onNavigateToDetail?: (id: string) => void;
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

const SensorsPage: React.FC<SensorsPageProps> = ({ onNavigateToDetail }) => {
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
  const filteredSensors = sensors.filter(sensor => {
    if (filterStatus === 'all') return true;
    return sensor.status === filterStatus;
  });

  const sortedSensors = [...filteredSensors].sort((a, b) => {
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
  const sensorsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(sortedSensors.length / sensorsPerPage);
  const startIndex = (currentPage - 1) * sensorsPerPage;
  const currentSensors = sortedSensors.slice(startIndex, startIndex + sensorsPerPage);

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

  const handleMouseDown = (e: React.MouseEvent, sensor: Sensor) => {
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
      resizedSensorRef.current = sensor;
      resizeDirectionRef.current = direction;
      const size = sensor.size || { width: 1, height: 1 };
      const position = sensor.position || { x: 0, y: 0 };
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
      draggedSensorRef.current = sensor;
      const rect = element.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent, sensor: Sensor) => {
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
      
      if (isDraggingRef.current && draggedSensorRef.current) {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const gap = 16;
        
        // Calculate new position relative to the container
        const newX = e.clientX - rect.left - dragOffsetRef.current.x;
        const newY = e.clientY - rect.top - dragOffsetRef.current.y;

        setDragPosition({ x: newX, y: newY });
      } else if (isResizingRef.current && resizedSensorRef.current) {
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
      if (isDraggingRef.current && draggedSensorRef.current && dragPosition) {
        const gap = 16;
        const cellWidth = gridSize.cellWidth + gap;
        const cellHeight = gridSize.cellHeight + gap;

        const gridX = Math.round(dragPosition.x / cellWidth);
        const gridY = Math.round(dragPosition.y / cellHeight);

        const sensor = draggedSensorRef.current;
        const size = sensor.size || { width: 1, height: 1 };

        const finalX = Math.max(0, Math.min(gridCols - size.width, gridX));
        const finalY = Math.max(0, Math.min(gridRows - size.height, gridY));

        if (!isPositionOccupied(finalX, finalY, size.width, size.height, sensor.id)) {
          setSensors(prevSensors =>
            prevSensors.map(s =>
              s.id === sensor.id
                ? { ...s, position: { x: finalX, y: finalY } }
                : s
            )
          );
        }
      } else if (isResizingRef.current && resizedSensorRef.current && resizePreview) {
        const sensor = resizedSensorRef.current;
        const newX = resizePreview.x !== undefined ? resizePreview.x : (sensor.position?.x || 0);
        const newY = resizePreview.y !== undefined ? resizePreview.y : (sensor.position?.y || 0);

        if (!isPositionOccupied(newX, newY, resizePreview.width, resizePreview.height, sensor.id)) {
          setSensors(prevSensors =>
            prevSensors.map(s =>
              s.id === sensor.id
                ? { 
                    ...s, 
                    size: { width: resizePreview.width, height: resizePreview.height },
                    position: { x: newX, y: newY }
                  }
                : s
            )
          );
        }
      }

      // Reset states
      isDraggingRef.current = false;
      draggedSensorRef.current = null;
      setDragPosition(null);
      isResizingRef.current = false;
      resizedSensorRef.current = null;
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
  }, [dragPosition, gridSize, gridCols, gridRows, resizePreview, sensors]);

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
    if (onNavigateToDetail) {
      onNavigateToDetail(sensorId);
    } else {
      console.log(`Navigate to sensor ${sensorId}`);
    }
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
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-4">Sensors</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <FaPlus />
            Add Sensor
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
              <option value="all">All Sensors</option>
              <option value="green">Active</option>
              <option value="yellow">Warning</option>
              <option value="red">Error</option>
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

      {/* Add Sensor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add New Sensor</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-5 h-5" />
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
                  {Object.entries(SENSOR_TYPES).map(([value, config]) => (
                    <option key={value} value={value}>{config.defaultName}</option>
                  ))}
                </select>
              </div>

              {/* Sensor Name */}
              <div>
                <label className="block text-gray-300 mb-1">Sensor Name</label>
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
                      {type === 'i2c' ? 'I²C' :
                       type === 'spi' ? 'SPI' :
                       type === 'analog' ? 'Analog' :
                       type === 'digital' ? 'Digital' :
                       type === 'uart' ? 'UART' :
                       'Wireless'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Connection Details */}
              <div>
                <label className="block text-gray-300 mb-1">
                  {newSensor.connectionType === 'i2c' ? 'I²C Address' : 
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