// src/pages/ProjectDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaEdit, FaSave, FaProjectDiagram, FaCalendarAlt, FaUsers, FaFlag, FaTasks, FaPlus } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'http://localhost:8000';

// Interfaces matching backend schemas
interface Project {
  id: string;
  project_id: string;
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
}

interface Task {
  id: string;
  task_id: string;
  title: string;
  status: string;
  priority: string;
}

interface Team {
    id: string;
    team_id: string;
    name: string;
    // Add other team properties as needed
}

interface ProjectDetailPageProps {
  projectId: string; // This is the project_id (e.g., "PROJ-...")
  onClose: () => void;
}

const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ projectId, onClose }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Partial<Project> & { extra_data?: Partial<Project['extra_data']> }>({});

  const fetchProjectData = useCallback(async () => {
    if (!isAuthenticated || !tokens) {
      setError("Authentication required.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Fetch main project details
      const projectResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!projectResponse.ok) throw new Error('Failed to fetch project details.');
      const projectData = await projectResponse.json();
      setProject(projectData);
      setEditedProject(projectData);

      // Fetch associated tasks
      const tasksResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData);
      }

      // Fetch associated teams
      const teamsResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/teams`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tokens]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleSave = async () => {
    if (!editedProject || !isAuthenticated || !tokens) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProject),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update project');
      }
      await fetchProjectData(); // Refresh data
      setIsEditing(false);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setEditedProject(project);
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof Project, value: any) => {
    setEditedProject(prev => ({ ...prev, [field]: value }));
  };

  const handleExtraDataChange = (field: keyof Project['extra_data'], value: any) => {
    setEditedProject(prev => ({
      ...prev,
      extra_data: { ...prev?.extra_data, [field]: value },
    }));
  };

  if (isLoading) return <div className="h-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (error) return <div className="h-full bg-gray-900 flex items-center justify-center text-red-500">{error}</div>;
  if (!project) return <div className="h-full bg-gray-900 flex items-center justify-center text-gray-400">Project not found.</div>;

  return (
    <div className="h-full bg-gray-900 text-white overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Project Details</h1>
        <div>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded flex items-center gap-2">
              <FaEdit /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center gap-2">
                <FaSave /> Save
              </button>
              <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Cancel</button>
            </div>
          )}
          <button onClick={onClose} className="ml-2 p-2 hover:bg-gray-800 rounded"><FaTimes /></button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info */}
          <div className="bg-gray-800 p-6 rounded-lg">
            {isEditing ? (
              <input type="text" value={editedProject.name || ''} onChange={e => handleInputChange('name', e.target.value)} className="text-3xl font-bold bg-gray-700 p-2 rounded w-full" />
            ) : (
              <h2 className="text-3xl font-bold">{project.name}</h2>
            )}
            <div className="mt-2">
              {isEditing ? (
                <textarea value={editedProject.description || ''} onChange={e => handleInputChange('description', e.target.value)} className="text-gray-300 bg-gray-700 p-2 rounded w-full h-24" />
              ) : (
                <p className="text-gray-300">{project.description}</p>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-medium mb-4 flex items-center gap-2"><FaTasks /> Tasks ({tasks.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tasks.map(task => (
                <div key={task.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                  <span>{task.title}</span>
                  <span className="text-sm capitalize px-2 py-1 bg-gray-600 rounded-full">{task.status}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full bg-blue-600/50 hover:bg-blue-600/80 py-2 rounded flex items-center justify-center gap-2">
              <FaPlus /> Add Task
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h3 className="text-xl font-medium">Details</h3>
            <div>
              <label className="text-sm text-gray-400">Project ID</label>
              <p>{project.project_id}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Status</label>
              {isEditing ? (
                <select value={editedProject.status || ''} onChange={e => handleInputChange('status', e.target.value)} className="bg-gray-700 p-2 rounded w-full">
                  <option>planning</option><option>active</option><option>paused</option><option>completed</option><option>archived</option>
                </select>
              ) : (
                <p className="capitalize">{project.status}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400">Priority</label>
              {isEditing ? (
                <select value={editedProject.extra_data?.priority || ''} onChange={e => handleExtraDataChange('priority', e.target.value)} className="bg-gray-700 p-2 rounded w-full">
                  <option>low</option><option>medium</option><option>high</option><option>critical</option>
                </select>
              ) : (
                <p className="capitalize">{project.extra_data.priority}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400">Deadline</label>
              {isEditing ? (
                <input type="date" value={editedProject.extra_data?.deadline?.split('T')[0] || ''} onChange={e => handleExtraDataChange('deadline', e.target.value)} className="bg-gray-700 p-2 rounded w-full" />
              ) : (
                <p>{project.extra_data.deadline ? new Date(project.extra_data.deadline).toLocaleDateString() : 'Not set'}</p>
              )}
            </div>
             <div>
                <label className="text-sm text-gray-400">Owner ID</label>
                <p>{project.owner_id}</p>
            </div>
          </div>

          {/* Teams Card */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-medium mb-4 flex items-center gap-2"><FaUsers /> Teams ({teams.length})</h3>
            <div className="space-y-2">
              {teams.map(team => (
                <div key={team.id} className="bg-gray-700 p-3 rounded">
                  {team.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;