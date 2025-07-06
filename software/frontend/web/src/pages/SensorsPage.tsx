// src/pages/SensorsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Sensor {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
}

const SensorsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sensors] = useState<Sensor[]>([
    { id: 'S001', name: 'Temperature Main', status: 'green', metrics: [{ label: 'Temp', value: '22.5°C' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S002', name: 'Humidity Lab', status: 'yellow', metrics: [{ label: 'Humidity', value: '68%' }, { label: 'Status', value: 'High' }] },
    { id: 'S003', name: 'Pressure Tank 1', status: 'green', metrics: [{ label: 'Pressure', value: '1013 hPa' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S004', name: 'Motion Detector A', status: 'green', metrics: [{ label: 'Activity', value: 'Active' }, { label: 'Count', value: '142' }] },
    { id: 'S005', name: 'Light Sensor 1', status: 'green', metrics: [{ label: 'Light', value: '750 lux' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S006', name: 'CO2 Monitor', status: 'red', metrics: [{ label: 'CO2', value: '1200 ppm' }, { label: 'Status', value: 'High' }] },
    { id: 'S007', name: 'Vibration Sensor', status: 'green', metrics: [{ label: 'Level', value: '0.02g' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S008', name: 'Door Sensor North', status: 'green', metrics: [{ label: 'State', value: 'Closed' }, { label: 'Opens', value: '24' }] },
    { id: 'S009', name: 'Water Level', status: 'yellow', metrics: [{ label: 'Level', value: '85%' }, { label: 'Status', value: 'Warning' }] },
    { id: 'S010', name: 'Power Monitor', status: 'green', metrics: [{ label: 'Power', value: '4.2 kW' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S011', name: 'Air Quality', status: 'green', metrics: [{ label: 'AQI', value: '42' }, { label: 'Quality', value: 'Good' }] },
    { id: 'S012', name: 'Sound Level', status: 'yellow', metrics: [{ label: 'Level', value: '78 dB' }, { label: 'Status', value: 'Loud' }] },
    { id: 'S013', name: 'Temperature Shop', status: 'green', metrics: [{ label: 'Temp', value: '24.1°C' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S014', name: 'Humidity Storage', status: 'green', metrics: [{ label: 'Humidity', value: '45%' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S015', name: 'Motion Detector B', status: 'green', metrics: [{ label: 'Activity', value: 'Idle' }, { label: 'Count', value: '0' }] },
    { id: 'S016', name: 'Smoke Detector 1', status: 'green', metrics: [{ label: 'Smoke', value: 'None' }, { label: 'Status', value: 'Clear' }] },
    { id: 'S017', name: 'Water Flow', status: 'green', metrics: [{ label: 'Flow', value: '2.3 L/m' }, { label: 'Total', value: '1842 L' }] },
    { id: 'S018', name: 'UV Index', status: 'green', metrics: [{ label: 'UV', value: '3' }, { label: 'Risk', value: 'Low' }] },
    { id: 'S019', name: 'Wind Speed', status: 'yellow', metrics: [{ label: 'Speed', value: '25 km/h' }, { label: 'Status', value: 'Windy' }] },
    { id: 'S020', name: 'Dust Sensor', status: 'green', metrics: [{ label: 'PM2.5', value: '12 µg/m³' }, { label: 'Quality', value: 'Good' }] },
    { id: 'S021', name: 'Gas Detector', status: 'green', metrics: [{ label: 'Gas', value: 'None' }, { label: 'Status', value: 'Safe' }] },
    { id: 'S022', name: 'Proximity North', status: 'green', metrics: [{ label: 'Distance', value: '2.4m' }, { label: 'Object', value: 'Yes' }] },
    { id: 'S023', name: 'Temperature Out', status: 'green', metrics: [{ label: 'Temp', value: '18.2°C' }, { label: 'Status', value: 'Normal' }] },
    { id: 'S024', name: 'Rain Sensor', status: 'green', metrics: [{ label: 'Rain', value: 'None' }, { label: 'Level', value: '0 mm' }] },
  ]);

  const [widgetsPerPage, setWidgetsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0, cols: 4, rows: 3 });

  // Calculate grid dimensions
  useEffect(() => {
    const calculateGrid = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const padding = 32;
      const gap = 16;
      
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
      } else if (widgetsPerPage <= 16) {
        cols = 4;
        rows = 4;
      } else {
        cols = 5;
        rows = Math.ceil(widgetsPerPage / 5);
      }

      const cellWidth = (availableWidth - (gap * (cols - 1))) / cols;
      const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;

      setGridSize({ cellWidth, cellHeight, cols, rows });
    };

    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [widgetsPerPage]);

  const totalPages = Math.ceil(sensors.length / widgetsPerPage);
  const startIndex = (currentPage - 1) * widgetsPerPage;
  const endIndex = startIndex + widgetsPerPage;
  const currentSensors = sensors.slice(startIndex, endIndex);

  const navigateToSensor = (sensorId: string) => {
    console.log(`Navigate to sensor ${sensorId}`);
    // Implement navigation logic
  };

  const getPosition = (index: number) => {
    const row = Math.floor(index / gridSize.cols);
    const col = index % gridSize.cols;
    return {
      x: col * (gridSize.cellWidth + 16),
      y: row * (gridSize.cellHeight + 16)
    };
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Sensors</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Per page:</label>
              <select
                value={widgetsPerPage}
                onChange={(e) => {
                  setWidgetsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
              >
                <option value="4">4</option>
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="12">12</option>
                <option value="16">16</option>
                <option value="20">20</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div ref={containerRef} className="flex-1 relative p-4">
        {currentSensors.map((sensor, index) => {
          const position = getPosition(index);
          return (
            <SpecificWidget
              key={sensor.id}
              type="sensor"
              data={sensor}
              onRemove={() => {}} // No remove on pages
              onNavigate={() => navigateToSensor(sensor.id)}
              style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: gridSize.cellWidth,
                height: gridSize.cellHeight
              }}
            />
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
  );
};

export default SensorsPage;