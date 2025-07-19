// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

interface Project {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  team: string;
  deadline?: string;
  description?: string;
  dateAdded: string;
  // Layout properties
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface ProjectTypeConfig {
  defaultName: string;
  priorities: Array<'low' | 'medium' | 'high' | 'critical'>;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  teams: string[];
  defaultMetrics: { label: string; value: string }[];
}

interface ProjectsPageProps {
  onNavigateToDetail?: (id: string) => void;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const PROJECT_TYPES: Record<string, ProjectTypeConfig> = {
  'software': {
    defaultName: 'Software Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'medium',
    teams: ['Engineering', 'Product', 'Design', 'QA', 'DevOps'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Tasks', value: '0/0' }
    ]
  },
  'hardware': {
    defaultName: 'Hardware Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'medium',
    teams: ['Hardware', 'Engineering', 'Manufacturing', 'Testing'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Phase', value: 'Planning' }
    ]
  },
  'research': {
    defaultName: 'Research Project',
    priorities: ['low', 'medium', 'high'],
    defaultPriority: 'medium',
    teams: ['Research', 'Data Science', 'Academic', 'Lab'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Experiments', value: '0/0' }
    ]
  },
  'design': {
    defaultName: 'Design Project',
    priorities: ['low', 'medium', 'high'],
    defaultPriority: 'medium',
    teams: ['Design', 'UX', 'Creative', 'Marketing'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Deliverables', value: '0/0' }
    ]
  },
  'manufacturing': {
    defaultName: 'Manufacturing Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'high',
    teams: ['Manufacturing', 'Operations', 'Quality', 'Supply Chain'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Units', value: '0/0' }
    ]
  },
  'other': {
    defaultName: 'Other Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'medium',
    teams: ['General', 'Cross-functional', 'Other'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Status', value: 'Planning' }
    ]
  }
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigateToDetail }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'deadline' | 'date'>('date');
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(2);
  const [newProject, setNewProject] = useState({
    type: 'software',
    name: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    team: '',
    deadline: '',
    description: ''
  });

  // Drag state
  const isDraggingRef = useRef(false);
  const draggedProjectRef = useRef<Project | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize state
  const isResizingRef = useRef(false);
  const resizedProjectRef = useRef<Project | null>(null);
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

  // Load saved projects on mount
  useEffect(() => {
    const saved = localStorage.getItem('wit-projects');
    if (saved) {
      try {
        const parsedProjects = JSON.parse(saved);
        setProjects(parsedProjects);
      } catch (error) {
        console.error('Failed to parse saved projects:', error);
        localStorage.removeItem('wit-projects');
      }
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('wit-projects', JSON.stringify(projects));
  }, [projects]);

  // Update project details when type changes
  useEffect(() => {
    const typeConfig = PROJECT_TYPES[newProject.type];
    if (typeConfig) {
      setNewProject(prev => ({
        ...prev,
        name: typeConfig.defaultName,
        priority: typeConfig.defaultPriority,
        team: prev.team || typeConfig.teams[0]
      }));
    }
  }, [newProject.type]);

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

  // Filter and sort projects
  const filteredProjects = projects.filter(project => {
    if (filterStatus !== 'all' && project.status !== filterStatus) return false;
    if (filterPriority !== 'all' && project.priority !== filterPriority) return false;
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'deadline':
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      case 'date':
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      default:
        return 0;
    }
  });

  // Pagination
  const projectsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(sortedProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const currentProjects = sortedProjects.slice(startIndex, startIndex + projectsPerPage);

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

  const handleMouseDown = (e: React.MouseEvent, project: Project) => {
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
      resizedProjectRef.current = project;
      resizeDirectionRef.current = direction;
      const size = project.size || { width: 1, height: 1 };
      const position = project.position || { x: 0, y: 0 };
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
      draggedProjectRef.current = project;
      const rect = element.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent, project: Project) => {
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
      
      if (isDraggingRef.current && draggedProjectRef.current) {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const gap = 16;
        
        // Calculate new position relative to the container
        const newX = e.clientX - rect.left - dragOffsetRef.current.x;
        const newY = e.clientY - rect.top - dragOffsetRef.current.y;

        setDragPosition({ x: newX, y: newY });
      } else if (isResizingRef.current && resizedProjectRef.current) {
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
      if (isDraggingRef.current && draggedProjectRef.current && dragPosition) {
        const gap = 16;
        const cellWidth = gridSize.cellWidth + gap;
        const cellHeight = gridSize.cellHeight + gap;

        const gridX = Math.round(dragPosition.x / cellWidth);
        const gridY = Math.round(dragPosition.y / cellHeight);

        const project = draggedProjectRef.current;
        const size = project.size || { width: 1, height: 1 };

        const finalX = Math.max(0, Math.min(gridCols - size.width, gridX));
        const finalY = Math.max(0, Math.min(gridRows - size.height, gridY));

        if (!isPositionOccupied(finalX, finalY, size.width, size.height, project.id)) {
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === project.id
                ? { ...p, position: { x: finalX, y: finalY } }
                : p
            )
          );
        }
      } else if (isResizingRef.current && resizedProjectRef.current && resizePreview) {
        const project = resizedProjectRef.current;
        const newX = resizePreview.x !== undefined ? resizePreview.x : (project.position?.x || 0);
        const newY = resizePreview.y !== undefined ? resizePreview.y : (project.position?.y || 0);

        if (!isPositionOccupied(newX, newY, resizePreview.width, resizePreview.height, project.id)) {
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === project.id
                ? { 
                    ...p, 
                    size: { width: resizePreview.width, height: resizePreview.height },
                    position: { x: newX, y: newY }
                  }
                : p
            )
          );
        }
      }

      // Reset states
      isDraggingRef.current = false;
      draggedProjectRef.current = null;
      setDragPosition(null);
      isResizingRef.current = false;
      resizedProjectRef.current = null;
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
  }, [dragPosition, gridSize, gridCols, gridRows, resizePreview, projects]);

  const isPositionOccupied = (x: number, y: number, width: number, height: number, excludeId?: string): boolean => {
    return currentProjects.some(project => {
      if (project.id === excludeId) return false;
      
      const pPos = project.position || { x: 0, y: 0 };
      const pSize = project.size || { width: 1, height: 1 };
      
      const collision = !(
        x + width <= pPos.x ||
        x >= pPos.x + pSize.width ||
        y + height <= pPos.y ||
        y >= pPos.y + pSize.height
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

  const handleAddProject = () => {
    const projectId = `P${Date.now()}`;
    const typeConfig = PROJECT_TYPES[newProject.type];
    
    const position = findAvailablePosition(1, 1);
    if (!position) {
      alert('No space available! Please remove projects or increase grid size.');
      return;
    }
    
    const newProjectData: Project = {
      id: projectId,
      name: newProject.name || typeConfig.defaultName,
      type: newProject.type,
      status: 'green',
      metrics: typeConfig.defaultMetrics,
      priority: newProject.priority,
      team: newProject.team,
      deadline: newProject.deadline,
      description: newProject.description,
      dateAdded: new Date().toISOString(),
      position: position,
      size: { width: 1, height: 1 }
    };

    setProjects([...projects, newProjectData]);
    
    setNewProject({
      type: 'software',
      name: '',
      priority: 'medium',
      team: '',
      deadline: '',
      description: ''
    });
    
    setShowAddModal(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prevProjects => {
      const newProjects = prevProjects.filter(p => p.id !== projectId);
      localStorage.setItem('wit-projects', JSON.stringify(newProjects));
      return newProjects;
    });
  };

  const navigateToProject = (projectId: string) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(projectId);
    } else {
      console.log(`Navigate to project ${projectId}`);
    }
  };

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-4">Projects</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <FaPlus />
            Add Project
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Status Filter */}
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
              <option value="all">All Status</option>
              <option value="green">On Track</option>
              <option value="yellow">At Risk</option>
              <option value="red">Off Track</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <FaFilter className="w-4 h-4" />
              <span className="font-medium">Filter by Priority</span>
            </div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
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
              <option value="priority">Priority</option>
              <option value="deadline">Deadline</option>
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
                <span className="text-white">{projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Critical:</span>
                <span className="text-red-400">{projects.filter(p => p.priority === 'critical').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">On Track:</span>
                <span className="text-green-400">{projects.filter(p => p.status === 'green').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">At Risk:</span>
                <span className="text-yellow-400">{projects.filter(p => p.status === 'yellow').length}</span>
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
          {/* Project Grid */}
          {currentProjects.map((project, index) => {
            const position = project.position || { x: index % gridCols, y: Math.floor(index / gridCols) };
            const size = project.size || { width: 1, height: 1 };
            const gap = 16;
            
            const isDragging = isDraggingRef.current && draggedProjectRef.current?.id === project.id;
            const isResizing = isResizingRef.current && resizedProjectRef.current?.id === project.id;
            
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
                key={project.id}
                style={style}
                className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
                onMouseDown={(e) => handleMouseDown(e, project)}
                onMouseMove={(e) => handleMouseMove(e, project)}
                onMouseLeave={(e) => {
                  if (!isDraggingRef.current && !isResizingRef.current) {
                    (e.currentTarget as HTMLElement).style.cursor = 'default';
                  }
                }}
              >
                <SpecificWidget
                  type="project"
                  data={project}
                  onRemove={() => handleDeleteProject(project.id)}
                  onNavigate={() => {
                    if (canNavigate && !isDraggingRef.current && !isResizingRef.current) {
                      navigateToProject(project.id);
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

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add New Project</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Project Type */}
              <div>
                <label className="block text-gray-300 mb-1">Project Type</label>
                <select
                  value={newProject.type}
                  onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {Object.entries(PROJECT_TYPES).map(([value, config]) => (
                    <option key={value} value={value}>{config.defaultName}</option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-gray-300 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder={PROJECT_TYPES[newProject.type].defaultName}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-gray-300 mb-1">Priority</label>
                <select
                  value={newProject.priority}
                  onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as any })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {PROJECT_TYPES[newProject.type].priorities.map(priority => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team */}
              <div>
                <label className="block text-gray-300 mb-1">Team</label>
                <select
                  value={newProject.team}
                  onChange={(e) => setNewProject({ ...newProject, team: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {PROJECT_TYPES[newProject.type].teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-gray-300 mb-1">Deadline (Optional)</label>
                <input
                  type="date"
                  value={newProject.deadline}
                  onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-300 mb-1">Description (Optional)</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Project goals, objectives, and details..."
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddProject}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Add Project
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

export default ProjectsPage;