// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Project {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
}

const ProjectsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projects] = useState<Project[]>([
    { id: 'P001', name: 'Widget Production', status: 'green', metrics: [{ label: 'Progress', value: '78%' }, { label: 'Tasks', value: '12/15' }] },
    { id: 'P002', name: 'Client Dashboard', status: 'yellow', metrics: [{ label: 'Progress', value: '45%' }, { label: 'Tasks', value: '8/18' }] },
    { id: 'P003', name: 'Prototype Alpha', status: 'green', metrics: [{ label: 'Progress', value: '92%' }, { label: 'Tasks', value: '23/25' }] },
    { id: 'P004', name: 'Research Phase 2', status: 'red', metrics: [{ label: 'Progress', value: '15%' }, { label: 'Status', value: 'On Hold' }] },
    { id: 'P005', name: 'Manufacturing Line', status: 'green', metrics: [{ label: 'Progress', value: '65%' }, { label: 'Tasks', value: '18/28' }] },
    { id: 'P006', name: 'Quality Control', status: 'yellow', metrics: [{ label: 'Progress', value: '50%' }, { label: 'Tasks', value: '10/20' }] },
    { id: 'P007', name: 'Customer Portal', status: 'green', metrics: [{ label: 'Progress', value: '88%' }, { label: 'Tasks', value: '35/40' }] },
    { id: 'P008', name: 'Data Migration', status: 'yellow', metrics: [{ label: 'Progress', value: '33%' }, { label: 'Tasks', value: '5/15' }] },
    { id: 'P009', name: 'Mobile App v2', status: 'green', metrics: [{ label: 'Progress', value: '71%' }, { label: 'Tasks', value: '22/31' }] },
    { id: 'P010', name: 'API Integration', status: 'green', metrics: [{ label: 'Progress', value: '95%' }, { label: 'Tasks', value: '19/20' }] },
    { id: 'P011', name: 'Hardware Upgrade', status: 'yellow', metrics: [{ label: 'Progress', value: '40%' }, { label: 'Tasks', value: '8/20' }] },
    { id: 'P012', name: 'Training Program', status: 'green', metrics: [{ label: 'Progress', value: '100%' }, { label: 'Status', value: 'Complete' }] },
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

  const totalPages = Math.ceil(projects.length / widgetsPerPage);
  const startIndex = (currentPage - 1) * widgetsPerPage;
  const endIndex = startIndex + widgetsPerPage;
  const currentProjects = projects.slice(startIndex, endIndex);

  const navigateToProject = (projectId: string) => {
    console.log(`Navigate to project ${projectId}`);
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
          <h1 className="text-2xl font-bold text-white">Projects</h1>
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
        {currentProjects.map((project, index) => {
          const position = getPosition(index);
          return (
            <SpecificWidget
              key={project.id}
              type="project"
              data={project}
              onRemove={() => {}} // No remove on pages
              onNavigate={() => navigateToProject(project.id)}
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

export default ProjectsPage;