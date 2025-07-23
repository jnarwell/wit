// src/pages/ProjectsPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an AuthContext

const API_BASE_URL = 'http://localhost:8000';

// Interface matching backend schema
interface Project {
  id: string; // uuid
  project_id: string; // "PROJ-..."
  name: string;
  description: string;
  type: string;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  extra_data: {
    team?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
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
    status: 'planning',
    team: 'Engineering',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
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
        name: '', description: '', type: 'software', status: 'planning',
        team: 'Engineering', priority: 'medium', deadline: '',
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
        {/* ... filters and sorting ... */}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto relative">
        {isLoading ? (
          <div className="text-white">Loading projects...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div ref={gridRef} className="relative h-full">
            {projects.map((project) => (
              <div key={project.id} /* ... style and event handlers ... */>
                <SpecificWidget
                  type="project"
                  data={{
                    id: project.project_id,
                    name: project.name,
                    status: project.status === 'active' ? 'green' : 'yellow', // Example mapping
                    metrics: [
                      { label: 'Team', value: project.extra_data.team || 'N/A' },
                      { label: 'Priority', value: project.extra_data.priority || 'N/A' }
                    ]
                  }}
                  onRemove={() => handleDeleteProject(project.project_id)}
                  onNavigate={() => navigateToProject(project.project_id)}
                />
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
              {/* Add other fields for team, priority, deadline etc. */}
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