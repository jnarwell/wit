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
      { label: 'Status', value: 'Active' }
    ]
  },
  'marketing': {
    defaultName: 'Marketing Campaign',
    priorities: ['low', 'medium', 'high'],
    defaultPriority: 'medium',
    teams: ['Marketing', 'Creative', 'Social Media', 'Analytics'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Reach', value: '0' }
    ]
  },
  'operations': {
    defaultName: 'Operations Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'high',
    teams: ['Operations', 'Logistics', 'Finance', 'HR'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Efficiency', value: '0%' }
    ]
  },
  'custom': {
    defaultName: 'Custom Project',
    priorities: ['low', 'medium', 'high', 'critical'],
    defaultPriority: 'medium',
    teams: ['Custom', 'Cross-functional', 'Other'],
    defaultMetrics: [
      { label: 'Progress', value: '0%' },
      { label: 'Status', value: 'Planning' }
    ]
  }
};

const ProjectsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date' | 'priority'>('date');
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);
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
  const filteredAndSortedProjects = React.useMemo(() => {
    let filtered = projects;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }
    
    if (filterPriority !== 'all') {
      filtered = filtered.filter(p => p.priority === filterPriority);
    }
    
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        const statusOrder = { 'red': 0, 'yellow': 1, 'green': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      } else if (sortBy === 'priority') {
        const priorityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      } else {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    });
  }, [projects, filterStatus, filterPriority, sortBy]);

  // Pagination
  const itemsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredAndSortedProjects.slice(startIndex, endIndex);

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

  const handleMouseMove = useCallback((e: React.MouseEvent, project: Project) => {
    if (isDraggingRef.current || isResizingRef.current) return;
    
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, project: Project) => {
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
      resizedProjectRef.current = project;
      resizeDirectionRef.current = direction;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: project.size?.width || 1,
        height: project.size?.height || 1,
        posX: project.position?.x || 0,
        posY: project.position?.y || 0
      };
      element.style.cursor = getCursorStyle(direction);
    } else {
      handleDragStart(e, project);
    }
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent, project: Project) => {
    if (!containerRef.current) return;
    
    isDraggingRef.current = true;
    draggedProjectRef.current = project;
    
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
    if (!isDraggingRef.current || !draggedProjectRef.current || !containerRef.current) return;
    
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
    if (!isDraggingRef.current || !draggedProjectRef.current || !containerRef.current || !dragPosition) return;
    
    const draggedProject = draggedProjectRef.current;
    const gap = 16;
    
    const gridX = Math.max(0, Math.round(dragPosition.x / (gridSize.cellWidth + gap)));
    const gridY = Math.max(0, Math.round(dragPosition.y / (gridSize.cellHeight + gap)));
    
    const newX = Math.min(gridX, Math.max(0, gridCols - (draggedProject.size?.width || 1)));
    const newY = Math.min(gridY, Math.max(0, gridRows - (draggedProject.size?.height || 1)));
    
    setProjects(prevProjects => 
      prevProjects.map(p => 
        p.id === draggedProject.id 
          ? { ...p, position: { x: newX, y: newY } }
          : p
      )
    );
    
    isDraggingRef.current = false;
    draggedProjectRef.current = null;
    setDragPosition(null);
    
    setTimeout(() => {
      setCanNavigate(true);
    }, 100);
  }, [dragPosition, gridSize, gridCols, gridRows]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizedProjectRef.current || !containerRef.current) return;
    
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
    
    const project = resizedProjectRef.current;
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
    
    const wouldCollide = isPositionOccupied(newX, newY, newWidth, newHeight, project.id);
    
    if (!wouldCollide) {
      setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
    }
  }, [gridSize, gridCols, gridRows]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current || !resizedProjectRef.current || !resizePreview) return;
    
    const resizedProject = resizedProjectRef.current;
    
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === resizedProject.id
          ? { 
              ...p, 
              size: { width: resizePreview.width, height: resizePreview.height },
              position: { 
                x: resizePreview.x !== undefined ? resizePreview.x : p.position!.x,
                y: resizePreview.y !== undefined ? resizePreview.y : p.position!.y
              }
            }
          : p
      )
    );
    
    isResizingRef.current = false;
    resizedProjectRef.current = null;
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
    
    // Calculate initial status based on deadline
    let status: 'green' | 'yellow' | 'red' = 'green';
    if (newProject.deadline) {
      const daysUntilDeadline = Math.floor((new Date(newProject.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 7) status = 'red';
      else if (daysUntilDeadline < 30) status = 'yellow';
    }
    
    const newProjectData: Project = {
      id: projectId,
      name: newProject.name || typeConfig.defaultName,
      type: newProject.type,
      status: status,
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
    console.log(`Navigate to project ${projectId}`);
    // Implement navigation logic
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'text-gray-400';
      case 'medium': return 'text-blue-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
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
          Add Project
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
              <option value="green">On Track</option>
              <option value="yellow">At Risk</option>
              <option value="red">Behind</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="w-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
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
              <option value="priority">Priority</option>
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
                max="6"
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
              <span className="text-white">{projects.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">On Track:</span>
              <span className="text-green-400">{projects.filter(p => p.status === 'green').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">At Risk:</span>
              <span className="text-yellow-400">{projects.filter(p => p.status === 'yellow').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Behind:</span>
              <span className="text-red-400">{projects.filter(p => p.status === 'red').length}</span>
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

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Add New Project</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes />
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
                  <option value="software">Software</option>
                  <option value="hardware">Hardware</option>
                  <option value="research">Research</option>
                  <option value="marketing">Marketing</option>
                  <option value="operations">Operations</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Name */}
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
                  placeholder="Project goals, requirements, or notes"
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