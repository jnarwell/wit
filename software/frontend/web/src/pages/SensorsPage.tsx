// src/pages/SensorsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Sensor {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  type?: string; // sensor type for filtering
}

const SensorsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sensors] = useState<Sensor[]>([
    { id: 'S001', name: 'Temperature Main', status: 'green', metrics: [{ label: 'Temp', value: '22.5°C' }, { label: 'Status', value: 'Normal' }], type: 'temperature' },
    { id: 'S002', name: 'Humidity Lab', status: 'yellow', metrics: [{ label: 'Humidity', value: '68%' }, { label: 'Status', value: 'High' }], type: 'humidity' },
    { id: 'S003', name: 'Pressure Tank 1', status: 'green', metrics: [{ label: 'Pressure', value: '1013 hPa' }, { label: 'Status', value: 'Normal' }], type: 'pressure' },
    { id: 'S004', name: 'Motion Detector A', status: 'green', metrics: [{ label: 'Activity', value: 'Active' }, { label: 'Count', value: '142' }], type: 'motion' },
    { id: 'S005', name: 'Light Sensor 1', status: 'green', metrics: [{ label: 'Light', value: '750 lux' }, { label: 'Status', value: 'Normal' }], type: 'light' },
    { id: 'S006', name: 'CO2 Monitor', status: 'red', metrics: [{ label: 'CO2', value: '1200 ppm' }, { label: 'Status', value: 'High' }], type: 'gas' },
    { id: 'S007', name: 'Vibration Sensor', status: 'green', metrics: [{ label: 'Level', value: '0.02g' }, { label: 'Status', value: 'Normal' }], type: 'vibration' },
    { id: 'S008', name: 'Door Sensor North', status: 'green', metrics: [{ label: 'State', value: 'Closed' }, { label: 'Opens', value: '24' }], type: 'door' },
    { id: 'S009', name: 'Water Level', status: 'yellow', metrics: [{ label: 'Level', value: '85%' }, { label: 'Status', value: 'Warning' }], type: 'water' },
    { id: 'S010', name: 'Power Monitor', status: 'green', metrics: [{ label: 'Power', value: '4.2 kW' }, { label: 'Status', value: 'Normal' }], type: 'power' },
    { id: 'S011', name: 'Air Quality', status: 'green', metrics: [{ label: 'AQI', value: '42' }, { label: 'Quality', value: 'Good' }], type: 'gas' },
    { id: 'S012', name: 'Sound Level', status: 'yellow', metrics: [{ label: 'Level', value: '78 dB' }, { label: 'Status', value: 'Loud' }], type: 'sound' },
    { id: 'S013', name: 'Temperature Shop', status: 'green', metrics: [{ label: 'Temp', value: '24.1°C' }, { label: 'Status', value: 'Normal' }], type: 'temperature' },
    { id: 'S014', name: 'Humidity Storage', status: 'green', metrics: [{ label: 'Humidity', value: '45%' }, { label: 'Status', value: 'Normal' }], type: 'humidity' },
    { id: 'S015', name: 'Motion Detector B', status: 'green', metrics: [{ label: 'Activity', value: 'Idle' }, { label: 'Count', value: '0' }], type: 'motion' },
    { id: 'S016', name: 'Smoke Detector 1', status: 'green', metrics: [{ label: 'Smoke', value: 'None' }, { label: 'Status', value: 'Clear' }], type: 'smoke' },
    { id: 'S017', name: 'Water Flow', status: 'green', metrics: [{ label: 'Flow', value: '2.3 L/m' }, { label: 'Total', value: '1842 L' }], type: 'water' },
    { id: 'S018', name: 'UV Index', status: 'green', metrics: [{ label: 'UV', value: '3' }, { label: 'Risk', value: 'Low' }], type: 'light' },
    { id: 'S019', name: 'Wind Speed', status: 'yellow', metrics: [{ label: 'Speed', value: '25 km/h' }, { label: 'Status', value: 'Windy' }], type: 'wind' },
    { id: 'S020', name: 'Dust Sensor', status: 'green', metrics: [{ label: 'PM2.5', value: '12 µg/m³' }, { label: 'Quality', value: 'Good' }], type: 'dust' },
    { id: 'S021', name: 'Gas Detector', status: 'green', metrics: [{ label: 'Gas', value: 'None' }, { label: 'Status', value: 'Safe' }], type: 'gas' },
    { id: 'S022', name: 'Proximity North', status: 'green', metrics: [{ label: 'Distance', value: '2.4m' }, { label: 'Object', value: 'Yes' }], type: 'proximity' },
    { id: 'S023', name: 'Temperature Out', status: 'green', metrics: [{ label: 'Temp', value: '18.2°C' }, { label: 'Status', value: 'Normal' }], type: 'temperature' },
    { id: 'S024', name: 'Rain Sensor', status: 'green', metrics: [{ label: 'Rain', value: 'None' }, { label: 'Level', value: '0 mm' }], type: 'rain' },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'type'>('name');
  
  // Grid configuration
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [gridColsInput, setGridColsInput] = useState('4');
  const [gridRowsInput, setGridRowsInput] = useState('3');

  // Get unique sensor types
  const sensorTypes = React.useMemo(() => {
    const types = new Set(sensors.map(s => s.type || 'other'));
    return Array.from(types).sort();
  }, [sensors]);

  // Filter and sort sensors
  const filteredAndSortedSensors = React.useMemo(() => {
    let filtered = sensors;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(s => s.type === filterType);
    }
    
    // Sort sensors
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const statusOrder = { 'red': 0, 'yellow': 1, 'green': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      } else { // type
        return (a.type || '').localeCompare(b.type || '');
      }
    });
  }, [sensors, filterStatus, filterType, sortBy]);

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

  // Calculate pagination based on grid size
  const itemsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(filteredAndSortedSensors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSensors = filteredAndSortedSensors.slice(startIndex, endIndex);

  // Reset to page 1 when grid size or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [gridCols, gridRows, filterStatus, filterType]);

  const navigateToSensor = (sensorId: string) => {
    console.log(`Navigate to sensor ${sensorId}`);
    // Implement navigation logic
  };

  const getPosition = (index: number) => {
    const row = Math.floor(index / gridCols);
    const col = index % gridCols;
    const gap = 16;
    return {
      x: col * (gridSize.cellWidth + gap),
      y: row * (gridSize.cellHeight + gap)
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'text-green-400';
      case 'yellow': return 'text-yellow-400';
      case 'red': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar */}
      <div className="bg-gray-800 w-64 flex flex-col h-full border-r border-gray-700">
        <div className="p-4 flex-1 flex flex-col overflow-hidden gap-4">
          <h1 className="text-2xl font-bold text-white mb-2">Sensors</h1>
          
          {/* Add Sensor Button */}
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors">
            <FaPlus />
            Add Sensor
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
                <span className="text-gray-300">All Sensors</span>
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
                <span className={getStatusColor('green')}>Normal</span>
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
                <span className={getStatusColor('red')}>Alert</span>
              </label>
            </div>
          </div>

          {/* Type Filter */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FaFilter className="text-gray-400" />
              <span className="text-gray-300 font-medium">Sensor Type</span>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-gray-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              {sensorTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FaSortAmountDown className="text-gray-400" />
              <span className="text-gray-300 font-medium">Sort By</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'type')}
              className="w-full bg-gray-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="type">Type</option>
            </select>
          </div>

          {/* Sensor Stats */}
          <div className="bg-gray-700 rounded-lg p-4 mt-auto">
            <h3 className="text-gray-300 font-medium mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-white">{filteredAndSortedSensors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('green')}>Normal:</span>
                <span className="text-white">{sensors.filter(s => s.status === 'green').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('yellow')}>Warning:</span>
                <span className="text-white">{sensors.filter(s => s.status === 'yellow').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('red')}>Alert:</span>
                <span className="text-white">{sensors.filter(s => s.status === 'red').length}</span>
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
          {currentSensors.map((sensor, index) => {
            const position = getPosition(index);
            return (
              <div
                key={sensor.id}
                className="absolute"
                style={{
                  left: position.x,
                  top: position.y,
                  width: gridSize.cellWidth,
                  height: gridSize.cellHeight
                }}
              >
                <SpecificWidget
                  type="sensor"
                  data={sensor}
                  onRemove={() => {}} // No remove on pages
                  onNavigate={() => navigateToSensor(sensor.id)}
                />
              </div>
            );
          })}
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
    </div>
  );
};

export default SensorsPage;