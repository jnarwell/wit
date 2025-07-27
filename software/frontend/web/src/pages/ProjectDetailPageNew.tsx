// src/pages/ProjectDetailPageNew.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaEdit, FaSave, FaPlus, FaTrash, FaFolder, FaUpload, FaUserPlus, FaCheck, FaClock, FaExclamationCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import ProjectFileBrowser from '../components/ProjectFileBrowser';
import './ProjectDetailPageNew.css';

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
  name: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'cancelled';
  project_id: string;
  assigned_to?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  username: string;
  email?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joined_at?: string;
  avatar?: string;
}

interface ProjectDetailPageNewProps {
  projectId: string;
  onClose: () => void;
  onNotFound: () => void;
}

const ProjectDetailPageNew: React.FC<ProjectDetailPageNewProps> = ({ projectId, onClose, onNotFound }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  
  // Modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTask, setNewTask] = useState({ 
    name: '', 
    description: '', 
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigned_to: '',
    due_date: ''
  });
  const [newMember, setNewMember] = useState({ username: '', role: 'viewer' as Member['role'] });

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(true);

  const fetchProjectData = useCallback(async () => {
    if (!isAuthenticated || !tokens) {
      setError("Authentication required.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch main project details
      const projectResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      
      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          onNotFound();
        } else {
          throw new Error('Failed to fetch project details.');
        }
        return;
      }
      
      const projectData = await projectResponse.json();
      setProject(projectData);
      setEditedDescription(projectData.description || '');

      // Fetch tasks
      try {
        const tasksResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks`, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        });
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      }

      // Fetch members
      try {
        const membersResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        });
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tokens, isAuthenticated, onNotFound]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleSaveDescription = async () => {
    if (!tokens || !project) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...project,
          description: editedDescription,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update project');
      
      await fetchProjectData();
      setIsEditing(false);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddTask = async () => {
    if (!tokens) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTask.name,
          description: newTask.description,
          status: 'not_started',
          priority: newTask.priority,
          assigned_to: newTask.assigned_to || undefined,
          due_date: newTask.due_date || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to add task');
      
      fetchProjectData();
      setShowAddTaskModal(false);
      setNewTask({ 
        name: '', 
        description: '', 
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    if (!tokens) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error('Failed to update task');
      
      fetchProjectData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!tokens || !confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      
      if (!response.ok) throw new Error('Failed to delete task');
      
      fetchProjectData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddMember = async () => {
    if (!tokens) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newMember.username,
          role: newMember.role,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add member');
      }
      
      fetchProjectData();
      setShowAddMemberModal(false);
      setNewMember({ username: '', role: 'viewer' });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!tokens || !confirm('Are you sure you want to remove this member?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove member');
      }
      
      fetchProjectData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Calculate progress metrics
  const completedTasks = tasks.filter(t => t.status === 'complete').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const getTaskStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'complete': return <FaCheck className="text-green-500" />;
      case 'in_progress': return <FaClock className="text-yellow-500" />;
      case 'cancelled': return <FaTimes className="text-red-500" />;
      default: return <FaExclamationCircle className="text-gray-500" />;
    }
  };

  const getPriorityColor = (priority?: 'low' | 'medium' | 'high' | 'critical') => {
    switch (priority) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  if (isLoading) return <div className="h-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (error) return <div className="h-full bg-gray-900 flex items-center justify-center text-red-500">{error}</div>;
  if (!project) return <div className="h-full bg-gray-900 flex items-center justify-center text-gray-400">No project data.</div>;

  return (
    <div className="project-detail-container">
      {/* Header */}
      <div className="project-header">
        <div className="header-left">
          <h1 className="project-title">{project.name}</h1>
          <span className={`project-status ${getPriorityColor(project.extra_data?.priority)}`}>
            {project.extra_data?.priority || 'medium'} priority
          </span>
        </div>
        <button onClick={onClose} className="close-button">
          <FaTimes />
        </button>
      </div>

      <div className="project-content">
        {/* Left side - Main content (3/4) */}
        <div className="main-content">
          {/* Description Section */}
          <div className="content-section description-section">
            <div className="section-header">
              <h2>Description</h2>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="edit-button">
                  <FaEdit /> Edit
                </button>
              ) : (
                <div className="edit-actions">
                  <button onClick={handleSaveDescription} className="save-button">
                    <FaSave /> Save
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditedDescription(project.description || ''); }} className="cancel-button">
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="description-textarea"
                placeholder="Add project description..."
                rows={4}
              />
            ) : (
              <p className="description-text">
                {project.description || 'No description provided.'}
              </p>
            )}
          </div>

          {/* Progress Section */}
          <div className="content-section progress-section">
            <h2>Progress</h2>
            <div className="progress-stats">
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progressPercentage}%` }} />
              </div>
              <div className="progress-info">
                <span className="progress-percentage">{progressPercentage}%</span>
                <span className="progress-text">{completedTasks} of {totalTasks} tasks completed</span>
              </div>
            </div>
            {project.extra_data?.deadline && (
              <div className="deadline-info">
                <FaClock /> Deadline: {new Date(project.extra_data.deadline).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Tasks Section */}
          <div className="content-section tasks-section">
            <div className="section-header">
              <h2>Tasks ({tasks.length})</h2>
              <button onClick={() => setShowAddTaskModal(true)} className="add-button">
                <FaPlus /> Add Task
              </button>
            </div>
            <div className="tasks-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <div className="task-title-row">
                      {getTaskStatusIcon(task.status)}
                      <h4 className="task-name">{task.name}</h4>
                    </div>
                    <span className={`task-priority ${task.priority === 'high' ? 'priority-high' : task.priority === 'low' ? 'priority-low' : 'priority-medium'}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="task-description">{task.description}</p>
                  {task.assigned_to && (
                    <p className="task-assignee">Assigned to: {task.assigned_to}</p>
                  )}
                  <div className="task-actions">
                    <select 
                      value={task.status} 
                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                      className="status-select"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="complete">Complete</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button onClick={() => handleDeleteTask(task.id)} className="delete-button">
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Members Section */}
          <div className="content-section members-section">
            <div className="section-header">
              <h2>Team Members ({members.length})</h2>
              <button onClick={() => setShowAddMemberModal(true)} className="add-button">
                <FaUserPlus /> Add Member
              </button>
            </div>
            <div className="members-grid">
              {members.map(member => (
                <div key={member.id} className="member-card">
                  <div className="member-avatar">
                    {member.username.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="member-info">
                    <h4 className="member-name">{member.username}</h4>
                    <p className="member-email">{member.email}</p>
                    <span className={`member-role role-${member.role}`}>{member.role}</span>
                  </div>
                  {member.role !== 'owner' && (
                    <button onClick={() => handleRemoveMember(member.id)} className="remove-member-button">
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Project Files (1/4) */}
        <div className="sidebar-content project-files-sidebar">
          <ProjectFileBrowser 
            projectId={projectId}
            baseDir="project"
            onFileSelect={(path) => console.log('File selected:', path)}
          />
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal-title">Add New Task</h3>
            <input
              type="text"
              placeholder="Task Name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              className="modal-input"
            />
            <textarea
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="modal-textarea"
              rows={3}
            />
            <div className="form-row">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="modal-select"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className="modal-input"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleAddTask} className="primary-button">Add Task</button>
              <button onClick={() => setShowAddTaskModal(false)} className="secondary-button">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3 className="modal-title">Add Team Member</h3>
            <input
              type="text"
              placeholder="Username or Email"
              value={newMember.username}
              onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
              className="modal-input"
            />
            <select
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value as Member['role'] })}
              className="modal-select"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="modal-actions">
              <button onClick={handleAddMember} className="primary-button">Add Member</button>
              <button onClick={() => setShowAddMemberModal(false)} className="secondary-button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPageNew;