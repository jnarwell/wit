// src/pages/MachinesPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Machine {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
}

const MachinesPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [machines] = useState<Machine[]>([
    { id: '001', name: 'CNC Mill Alpha', status: 'green', metrics: [{ label: 'Jobs', value: '142' }, { label: 'Uptime', value: '98%' }] },
    { id: '002', name: '3D Printer Beta', status: 'yellow', metrics: [{ label: 'Jobs', value: '89' }, { label: 'Uptime', value: '92%' }] },
    { id: '003', name: 'Laser Cutter', status: 'green', metrics: [{ label: 'Jobs', value: '276' }, { label: 'Uptime', value: '99%' }] },
    { id: '004', name: 'CNC Router', status: 'red', metrics: [{ label: 'Jobs', value: '0' }, { label: 'Status', value: 'Maint.' }] },
    { id: '005', name: 'Plasma Cutter', status: 'green', metrics: [{ label: 'Jobs', value: '67' }, { label: 'Uptime', value: '95%' }] },
    { id: '006', name: 'Welding Station', status: 'green', metrics: [{ label: 'Jobs', value: '183' }, { label: 'Uptime', value: '100%' }] },
    { id: '007', name: 'Drill Press', status: 'yellow', metrics: [{ label: 'Jobs', value: '421' }, { label: 'Uptime', value: '88%' }] },
    { id: '008', name: 'Band Saw', status: 'green', metrics: [{ label: 'Jobs', value: '312' }, { label: 'Uptime', value: '97%' }] },
  ]);

  const [widgetsPerPage, setWidgetsPerPage] = useState(9);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0, cols: 3, rows: 3 });

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

  const totalPages = Math.ceil(machines.length / widgetsPerPage);
  const startIndex = (currentPage - 1) * widgetsPerPage;
  const endIndex = startIndex + widgetsPerPage;
  const currentMachines = machines.slice(startIndex, endIndex);

  const navigateToMachine = (machineId: string) => {
    console.log(`Navigate to machine ${machineId}`);
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
          <h1 className="text-2xl font-bold text-white">Machines</h1>
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
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div ref={containerRef} className="flex-1 relative p-4">
        {currentMachines.map((machine, index) => {
          const position = getPosition(index);
          return (
            <SpecificWidget
              key={machine.id}
              type="machine"
              data={machine}
              onRemove={() => {}} // No remove on pages
              onNavigate={() => navigateToMachine(machine.id)}
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

export default MachinesPage;