// src/pages/ProjectDetailPageTabbed.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaEdit, FaSave, FaPlus, FaTrash, FaFolder, FaUpload, FaUserPlus, FaCheck, FaClock, FaExclamationCircle, FaTasks, FaUsers, FaChartLine, FaCog } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import ProjectFileBrowser from '../components/ProjectFileBrowser';
import './ProjectDetailPageTabbed.css';

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

interface ProjectDetailPageTabbedProps {
  projectId: string;
  onClose: () => void;
  onNotFound: () => void;
}

type TabType = 'overview' | 'tasks' | 'team' | 'files' | 'settings';
type TaskFilter = 'all' | 'not_started' | 'in_progress' | 'blocked' | 'complete';

const ProjectDetailPageTabbed: React.FC<ProjectDetailPageTabbedProps> = ({ projectId, onClose, onNotFound }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [newTask, setNewTask] = useState({ 
    name: '', 
    description: '', 
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigned_to: '',
    due_date: ''
  });
  const [newMember, setNewMember] = useState({ username: '', role: 'viewer' as Member['role'] });

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
          return;
        }
        throw new Error('Failed to fetch project');
      }
      
      const projectData = await projectResponse.json();
      setProject(projectData);

      // Fetch tasks in parallel
      const [tasksResponse, membersResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks`, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        }),
        fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members`, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        }),
      ]);

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData);
      }
      
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, isAuthenticated, tokens, onNotFound]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

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
      setNewTask({ name: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    if (!tokens) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) throw new Error('Failed to update task');
      
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!tokens || !confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete task');
      
      fetchProjectData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowEditTaskModal(true);
  };

  const handleUpdateTask = async () => {
    if (!tokens || !editingTask) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingTask.name,
          description: editingTask.description,
          status: editingTask.status,
          priority: editingTask.priority,
          assigned_to: editingTask.assigned_to || undefined,
          due_date: editingTask.due_date || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update task');
      
      fetchProjectData();
      setShowEditTaskModal(false);
      setEditingTask(null);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getTasksByStatus = (status: Task['status']) => tasks.filter(t => t.status === status);
  const completedTasks = tasks.filter(t => t.status === 'complete').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filter tasks based on selected filter
  const getFilteredTasks = () => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter(task => task.status === taskFilter);
  };

  const filteredTasks = getFilteredTasks();

  if (isLoading) return <div className="h-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (error) return <div className="h-full bg-gray-900 flex items-center justify-center text-red-500">{error}</div>;
  if (!project) return <div className="h-full bg-gray-900 flex items-center justify-center text-gray-400">No project data.</div>;

  return (
    <div className="project-detail-tabbed">
      {/* Header */}
      <div className="project-header">
        <div className="header-content">
          <h1 className="project-title">{project.name}</h1>
          <span className="project-id">ID: {project.project_id}</span>
        </div>
        <button onClick={onClose} className="close-button">
          <FaTimes />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartLine /> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <FaTasks /> Tasks
          <span className="tab-badge">{tasks.length}</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <FaUsers /> Team
          <span className="tab-badge">{members.length}</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <FaFolder /> Files
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <FaCog /> Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-grid">
              {/* Description Card */}
              <div className="overview-card description-card">
                <h2>Description</h2>
                <p>{project.description || 'No description provided.'}</p>
              </div>

              {/* Progress Card */}
              <div className="overview-card progress-card">
                <h2>Progress</h2>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progressPercentage}%` }} />
                </div>
                <div className="progress-stats">
                  <span className="progress-percentage">{progressPercentage}%</span>
                  <span className="progress-text">{completedTasks} of {totalTasks} tasks completed</span>
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="overview-card stats-card">
                <h2>Quick Stats</h2>
                <div className="stat-grid">
                  <div className="stat-item">
                    <span className="stat-value">{getTasksByStatus('not_started').length}</span>
                    <span className="stat-label">Not Started</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{getTasksByStatus('in_progress').length}</span>
                    <span className="stat-label">In Progress</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{getTasksByStatus('blocked').length}</span>
                    <span className="stat-label">Blocked</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{getTasksByStatus('complete').length}</span>
                    <span className="stat-label">Complete</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className="overview-card activity-card">
                <h2>Recent Activity</h2>
                <p className="text-gray-400">No recent activity to display.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            <div className="tasks-header">
              <h2>Project Tasks</h2>
              <button onClick={() => setShowAddTaskModal(true)} className="add-task-button">
                <FaPlus /> Add Task
              </button>
            </div>

            {/* Task Filters */}
            <div className="task-filters">
              <button 
                className={`filter-button ${taskFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTaskFilter('all')}
              >
                All ({tasks.length})
              </button>
              <button 
                className={`filter-button ${taskFilter === 'not_started' ? 'active' : ''}`}
                onClick={() => setTaskFilter('not_started')}
              >
                Not Started ({getTasksByStatus('not_started').length})
              </button>
              <button 
                className={`filter-button ${taskFilter === 'in_progress' ? 'active' : ''}`}
                onClick={() => setTaskFilter('in_progress')}
              >
                In Progress ({getTasksByStatus('in_progress').length})
              </button>
              <button 
                className={`filter-button ${taskFilter === 'blocked' ? 'active' : ''}`}
                onClick={() => setTaskFilter('blocked')}
              >
                Blocked ({getTasksByStatus('blocked').length})
              </button>
              <button 
                className={`filter-button ${taskFilter === 'complete' ? 'active' : ''}`}
                onClick={() => setTaskFilter('complete')}
              >
                Complete ({getTasksByStatus('complete').length})
              </button>
            </div>

            {/* Tasks List */}
            <div className="tasks-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <FaTasks className="empty-icon" />
                  <p>No tasks yet. Create your first task!</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <p>No tasks match the selected filter.</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`task-item status-${task.status}`}
                    onClick={() => handleEditTask(task)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="task-main">
                      <div className="task-info">
                        <h3 className="task-title">{task.name}</h3>
                        <p className="task-description">{task.description}</p>
                        <div className="task-meta">
                          <span className={`task-priority priority-${task.priority}`}>
                            {task.priority} priority
                          </span>
                          {task.due_date && (
                            <span className="task-due-date">
                              <FaClock /> Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.assigned_to && (
                            <span className="task-assignee">
                              Assigned to: {task.assigned_to}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={task.status} 
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                          className="task-status-select"
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="complete">Complete</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button onClick={() => handleDeleteTask(task.id)} className="task-delete-button">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="team-tab">
            <div className="team-header">
              <h2>Team Members</h2>
              <button onClick={() => setShowAddMemberModal(true)} className="add-member-button">
                <FaUserPlus /> Add Member
              </button>
            </div>
            <div className="members-list">
              {members.map(member => (
                <div key={member.id} className="member-card">
                  <div className="member-avatar">
                    {member.username[0].toUpperCase()}
                  </div>
                  <div className="member-info">
                    <h4>{member.username}</h4>
                    <span className="member-role">{member.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-tab">
            <ProjectFileBrowser projectId={projectId} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h2>Project Settings</h2>
            <p className="text-gray-400">Settings functionality coming soon...</p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="modal-overlay" onClick={() => setShowAddTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Task</h2>
            <input
              type="text"
              placeholder="Task name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              className="modal-input"
            />
            <textarea
              placeholder="Task description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="modal-textarea"
              rows={3}
            />
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
              placeholder="Due date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              className="modal-input"
            />
            <input
              type="text"
              placeholder="Assigned to (optional)"
              value={newTask.assigned_to}
              onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
              className="modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => setShowAddTaskModal(false)} className="cancel-button">Cancel</button>
              <button onClick={handleAddTask} className="primary-button">Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Team Member</h2>
            <input
              type="text"
              placeholder="Username"
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
              <button onClick={() => setShowAddMemberModal(false)} className="cancel-button">Cancel</button>
              <button className="primary-button">Add Member</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Task</h2>
            <input
              type="text"
              placeholder="Task name"
              value={editingTask.name}
              onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
              className="modal-input"
            />
            <textarea
              placeholder="Task description"
              value={editingTask.description}
              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
              className="modal-textarea"
              rows={3}
            />
            <select 
              value={editingTask.priority} 
              onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
              className="modal-select"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <select 
              value={editingTask.status} 
              onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as Task['status'] })}
              className="modal-select"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              placeholder="Due date"
              value={editingTask.due_date ? editingTask.due_date.split('T')[0] : ''}
              onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
              className="modal-input"
            />
            <input
              type="text"
              placeholder="Assigned to (optional)"
              value={editingTask.assigned_to || ''}
              onChange={(e) => setEditingTask({ ...editingTask, assigned_to: e.target.value })}
              className="modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => { setShowEditTaskModal(false); setEditingTask(null); }} className="cancel-button">Cancel</button>
              <button onClick={handleUpdateTask} className="primary-button">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPageTabbed;