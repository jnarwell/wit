// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an AuthContext

const API_BASE_URL = 'http://localhost:8000';

// Interface matching backend schema
interface Project {
  id: string; // uuid
  project_id: string; // "PROJ-..."
  name: string;
  description: string;
  type: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'complete';
  priority: 'low' | 'medium' | 'high';
  owner_id: string;
  created_at: string;
  updated_at: string;
  extra_data: {
    team?: string;
    deadline?: string;
    budget?: number;
    tags?: string[];
    custom_fields?: Record<string, any>;
  };
  // Layout properties (frontend only)
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface ProjectsPageProps {
  onNavigateToDetail?: (id: string) => void;
}

const PROJECT_TYPES = {
  'software': 'Software',
  'hardware': 'Hardware',
  'research': 'Research',
  'design': 'Design',
  'manufacturing': 'Manufacturing',
  'other': 'Other',
};

const PROJECT_STATUS = {
  'not_started': { label: 'Not Started', color: 'bg-gray-500' },
  'in_progress': { label: 'In Progress', color: 'bg-yellow-500' },
  'blocked': { label: 'Blocked', color: 'bg-red-500' },
  'complete': { label: 'Complete', color: 'bg-green-500' },
};

const PROJECT_PRIORITY = {
  'low': { label: 'Low', color: 'bg-blue-500' },
  'medium': { label: 'Medium', color: 'bg-yellow-500' },
  'high': { label: 'High', color: 'bg-red-500' },
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigateToDetail }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(2);
  
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    type: 'software',
    status: 'not_started' as 'not_started' | 'in_progress' | 'blocked' | 'complete',
    priority: 'medium' as 'low' | 'medium' | 'high',
    team: 'Engineering',
    deadline: '',
  });

  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated || !tokens) {
      setError("Please login to view projects.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data = await response.json();
      // Combine with local layout data if available
      const localLayouts = JSON.parse(localStorage.getItem('wit-projects-layout') || '{}');
      const mergedProjects = data.map((p: Project) => ({
        ...p,
        ...localLayouts[p.id],
      }));
      setProjects(mergedProjects);
      setError(null);
      // Save projects to localStorage for widgets
      localStorage.setItem('wit-projects', JSON.stringify(mergedProjects));
      // Dispatch event to notify widgets
      window.dispatchEvent(new Event('projects-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Save layout data to localStorage
  useEffect(() => {
    const layouts = projects.reduce((acc, p) => {
      if (p.position || p.size) {
        acc[p.id] = { position: p.position, size: p.size };
      }
      return acc;
    }, {} as Record<string, { position?: any; size?: any; }>);
    localStorage.setItem('wit-projects-layout', JSON.stringify(layouts));
  }, [projects]);

  const handleAddProject = async () => {
    if (!isAuthenticated || !tokens) {
      alert("Please login to add a project.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add project');
      }
      await fetchProjects(); // Re-fetch to get the new project
      setShowAddModal(false);
      setNewProject({
        name: '', description: '', type: 'software', status: 'not_started',
        priority: 'medium', team: 'Engineering', deadline: '',
      });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!isAuthenticated || !tokens) {
      alert("Please login to delete projects.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete project');
      }
      fetchProjects(); // Refresh list
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Pick<Project, 'status' | 'priority'>>) => {
    if (!isAuthenticated || !tokens) {
      alert("Please login to update projects.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update project');
      }
      
      // Update local state immediately for better UX
      setProjects(prev => prev.map(p => 
        p.project_id === projectId ? { ...p, ...updates } : p
      ));
      
      // Then fetch to ensure consistency
      fetchProjects();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  // ... (keep grid, drag-and-drop, and other UI logic as is)
  // Note: The drag-and-drop/resize logic will need to be adapted to use the correct project ID (`project.id` which is the UUID)

  const navigateToProject = (projectId: string) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(projectId);
    } else {
      console.log(`Navigate to project ${projectId}`);
    }
  };

  // The rest of the component remains largely the same, but data is now sourced from `projects` state
  // and interactions call the new handler functions.
  // I will omit the unchanged parts for brevity, but they are assumed to be present.

  const gridRef = useRef<HTMLDivElement>(null);

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
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'status':
        const statusOrder = { blocked: 0, in_progress: 1, not_started: 2, complete: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      case 'updated_at':
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      case 'created_at':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // A simplified render to show the core changes:
  return (
    <div className="h-full bg-gray-900 flex">
      {/* Sidebar (with updated stats) */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-4">Projects</h1>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!isAuthenticated}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <FaPlus /> Add Project
          </button>
        </div>
        
        {/* Filters and Controls */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Grid Size Control */}
          <div>
            <h3 className="text-gray-300 font-medium mb-3">Grid Layout</h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-400">Columns: {gridCols}</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={gridCols}
                  onChange={(e) => setGridCols(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          {/* Status Filter */}
          <div>
            <h3 className="text-gray-300 font-medium mb-3">Filter by Status</h3>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="all">All Projects</option>
              {Object.entries(PROJECT_STATUS).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>
          
          {/* Priority Filter */}
          <div>
            <h3 className="text-gray-300 font-medium mb-3">Filter by Priority</h3>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="all">All Priorities</option>
              {Object.entries(PROJECT_PRIORITY).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </div>
          
          {/* Sort By */}
          <div>
            <h3 className="text-gray-300 font-medium mb-3">Sort By</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="created_at">Date Created</option>
              <option value="updated_at">Last Updated</option>
              <option value="name">Name</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto relative">
        {isLoading ? (
          <div className="text-white">Loading projects...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div 
            ref={gridRef} 
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridAutoRows: 'min-content'
            }}
          >
            {sortedProjects.map((project) => (
              <div 
                key={project.id}
                className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                {/* Project Header with Status Light */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Status Light - Clickable */}
                    <div className="relative group">
                      <button
                        className={`w-4 h-4 rounded-full ${PROJECT_STATUS[project.status].color} hover:ring-2 hover:ring-gray-400 transition-all`}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      />
                      {/* Status Dropdown */}
                      <div className="absolute left-0 top-6 bg-gray-700 rounded-lg shadow-xl p-2 hidden group-hover:block z-10 min-w-[150px]">
                        {Object.entries(PROJECT_STATUS).map(([key, value]) => (
                          <button
                            key={key}
                            onClick={() => handleUpdateProject(project.project_id, { status: key as Project['status'] })}
                            className="w-full text-left px-3 py-2 hover:bg-gray-600 rounded flex items-center gap-2"
                          >
                            <div className={`w-3 h-3 rounded-full ${value.color}`} />
                            <span className="text-sm text-gray-200">{value.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Project Name */}
                    <h3 className="text-lg font-semibold text-white truncate">{project.name}</h3>
                  </div>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.project_id);
                    }}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <FaTimes />
                  </button>
                </div>
                
                {/* Project Type */}
                <div className="text-sm text-gray-400 mb-3">
                  {PROJECT_TYPES[project.type as keyof typeof PROJECT_TYPES] || project.type}
                </div>
                
                {/* Priority Tag - Clickable */}
                <div className="flex items-center justify-between mb-3">
                  <div className="relative group">
                    <button
                      className={`px-3 py-1 rounded-full text-xs font-medium text-white ${PROJECT_PRIORITY[project.priority].color} hover:ring-2 hover:ring-gray-400 transition-all`}
                    >
                      {PROJECT_PRIORITY[project.priority].label} Priority
                    </button>
                    {/* Priority Dropdown */}
                    <div className="absolute left-0 top-8 bg-gray-700 rounded-lg shadow-xl p-2 hidden group-hover:block z-10 min-w-[120px]">
                      {Object.entries(PROJECT_PRIORITY).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => handleUpdateProject(project.project_id, { priority: key as Project['priority'] })}
                          className="w-full text-left px-3 py-2 hover:bg-gray-600 rounded flex items-center gap-2"
                        >
                          <span className={`px-2 py-0.5 rounded text-xs ${value.color} text-white`}>
                            {value.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Team Info */}
                  {project.extra_data.team && (
                    <span className="text-xs text-gray-400">
                      {project.extra_data.team}
                    </span>
                  )}
                </div>
                
                {/* Progress Bar (placeholder - will be calculated from tasks) */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>0%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
                
                {/* Navigate Button */}
                <button
                  onClick={() => navigateToProject(project.project_id)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Project Modal (updated) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Project</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              />
              <textarea
                placeholder="Description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 h-20"
              />
              <select
                value={newProject.type}
                onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              >
                {Object.entries(PROJECT_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Status</label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value as Project['status'] })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  >
                    {Object.entries(PROJECT_STATUS).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Priority</label>
                  <select
                    value={newProject.priority}
                    onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as Project['priority'] })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  >
                    {Object.entries(PROJECT_PRIORITY).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <input
                type="text"
                placeholder="Team (optional)"
                value={newProject.team}
                onChange={(e) => setNewProject({ ...newProject, team: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              />
              
              <input
                type="date"
                placeholder="Deadline (optional)"
                value={newProject.deadline}
                onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddProject} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">
                Add Project
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded">
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