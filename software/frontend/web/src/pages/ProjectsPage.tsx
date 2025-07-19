// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaSearch } from 'react-icons/fa';
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
    { id: 'P010', name: 'API Integration', status: 'green', metrics: [{ label: 'Progress', value: '100%' }, { label: 'Status', value: 'Complete' }] },
    { id: 'P011', name: 'Security Audit', status: 'yellow', metrics: [{ label: 'Progress', value: '25%' }, { label: 'Issues', value: '3 found' }] },
    { id: 'P012', name: 'Infrastructure Upgrade', status: 'red', metrics: [{ label: 'Progress', value: '10%' }, { label: 'Status', value: 'Blocked' }] },
    { id: 'P013', name: 'User Documentation', status: 'green', metrics: [{ label: 'Progress', value: '80%' }, { label: 'Pages', value: '48/60' }] },
    { id: 'P014', name: 'Performance Testing', status: 'yellow', metrics: [{ label: 'Progress', value: '55%' }, { label: 'Tests', value: '11/20' }] },
    { id: 'P015', name: 'Design System', status: 'green', metrics: [{ label: 'Progress', value: '95%' }, { label: 'Components', value: '38/40' }] },
    { id: 'P016', name: 'Analytics Platform', status: 'yellow', metrics: [{ label: 'Progress', value: '42%' }, { label: 'Modules', value: '5/12' }] },
    { id: 'P017', name: 'Inventory System', status: 'green', metrics: [{ label: 'Progress', value: '67%' }, { label: 'Features', value: '8/12' }] },
    { id: 'P018', name: 'Training Program', status: 'green', metrics: [{ label: 'Progress', value: '90%' }, { label: 'Sessions', value: '9/10' }] },
    { id: 'P019', name: 'Cost Analysis', status: 'yellow', metrics: [{ label: 'Progress', value: '38%' }, { label: 'Reports', value: '3/8' }] },
    { id: 'P020', name: 'Compliance Review', status: 'red', metrics: [{ label: 'Progress', value: '20%' }, { label: 'Status', value: 'Delayed' }] },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'status'>('name');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Grid configuration
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [gridColsInput, setGridColsInput] = useState('4');
  const [gridRowsInput, setGridRowsInput] = useState('3');

  // Filter, search and sort projects
  const filteredAndSortedProjects = React.useMemo(() => {
    let filtered = projects;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }
    
    // Sort projects
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const statusOrder = { 'red': 0, 'yellow': 1, 'green': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      } else { // progress
        const getProgress = (p: Project) => {
          const progressMetric = p.metrics.find(m => m.label === 'Progress');
          return progressMetric ? parseInt(progressMetric.value) : 0;
        };
        return getProgress(b) - getProgress(a);
      }
    });
  }, [projects, filterStatus, sortBy, searchTerm]);

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
  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredAndSortedProjects.slice(startIndex, endIndex);

  // Reset to page 1 when grid size or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [gridCols, gridRows, filterStatus, searchTerm]);

  const navigateToProject = (projectId: string) => {
    console.log(`Navigate to project ${projectId}`);
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
          <h1 className="text-2xl font-bold text-white mb-2">Projects</h1>
          
          {/* Add Project Button */}
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors">
            <FaPlus />
            New Project
          </button>

          {/* Search Box */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white rounded pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
                <span className="text-gray-300">All Projects</span>
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
                <span className={getStatusColor('green')}>Active</span>
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
                <span className={getStatusColor('yellow')}>In Progress</span>
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
                <span className={getStatusColor('red')}>On Hold</span>
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
              onChange={(e) => setSortBy(e.target.value as 'name' | 'progress' | 'status')}
              className="w-full bg-gray-600 text-white rounded px-3 py-2 text-sm"
            >
              <option value="name">Name</option>
              <option value="progress">Progress</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Project Stats */}
          <div className="bg-gray-700 rounded-lg p-4 mt-auto">
            <h3 className="text-gray-300 font-medium mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-white">{filteredAndSortedProjects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('green')}>Active:</span>
                <span className="text-white">{projects.filter(p => p.status === 'green').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('yellow')}>In Progress:</span>
                <span className="text-white">{projects.filter(p => p.status === 'yellow').length}</span>
              </div>
              <div className="flex justify-between">
                <span className={getStatusColor('red')}>On Hold:</span>
                <span className="text-white">{projects.filter(p => p.status === 'red').length}</span>
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
          {currentProjects.map((project, index) => {
            const position = getPosition(index);
            return (
              <div
                key={project.id}
                className="absolute"
                style={{
                  left: position.x,
                  top: position.y,
                  width: gridSize.cellWidth,
                  height: gridSize.cellHeight
                }}
              >
                <SpecificWidget
                  type="project"
                  data={project}
                  onRemove={() => {}} // No remove on pages
                  onNavigate={() => navigateToProject(project.id)}
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

export default ProjectsPage;