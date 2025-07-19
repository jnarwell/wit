// src/pages/ProjectDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaEdit, FaSave, FaProjectDiagram, FaCalendarAlt, FaUsers, FaFlag } from 'react-icons/fa';

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
}

interface ProjectDetailPageProps {
  projectId: string;
  onClose: () => void;
}

const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ projectId, onClose }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Project | null>(null);

  useEffect(() => {
    // Load project from localStorage
    const savedProjects = localStorage.getItem('wit-projects');
    if (savedProjects) {
      const projects: Project[] = JSON.parse(savedProjects);
      const foundProject = projects.find(p => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
        setEditedProject(foundProject);
      }
    }
  }, [projectId]);

  const handleSave = () => {
    if (!editedProject) return;

    // Update in localStorage
    const savedProjects = localStorage.getItem('wit-projects');
    if (savedProjects) {
      const projects: Project[] = JSON.parse(savedProjects);
      const index = projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        projects[index] = editedProject;
        localStorage.setItem('wit-projects', JSON.stringify(projects));
        setProject(editedProject);
        setIsEditing(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedProject(project);
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'text-green-500';
      case 'yellow': return 'text-yellow-500';
      case 'red': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-600';
      case 'medium': return 'bg-yellow-600';
      case 'high': return 'bg-orange-600';
      case 'critical': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const formatTypeName = (type: string) => {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDeadlineStatus = () => {
    if (!project?.deadline) return null;
    
    const deadline = new Date(project.deadline);
    const today = new Date();
    const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { text: 'Overdue', color: 'text-red-500' };
    } else if (daysUntil === 0) {
      return { text: 'Due Today', color: 'text-yellow-500' };
    } else if (daysUntil <= 7) {
      return { text: `${daysUntil} days remaining`, color: 'text-yellow-500' };
    } else {
      return { text: `${daysUntil} days remaining`, color: 'text-gray-400' };
    }
  };

  if (!project || !editedProject) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Project not found</div>
      </div>
    );
  }

  const deadlineStatus = getDeadlineStatus();

  return (
    <div className="h-full bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Project Details</h1>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                <FaEdit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  <FaSave className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
            >
              <FaTimes className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Main Info Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedProject.name}
                  onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                  className="text-3xl font-bold bg-gray-700 text-white rounded px-3 py-1 w-full"
                />
              ) : (
                <h2 className="text-3xl font-bold text-white">{project.name}</h2>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-gray-400">Type:</span>
                <span className="text-white font-medium">{formatTypeName(project.type)}</span>
                <span className="text-gray-400 ml-4">Status:</span>
                <span className={`font-medium ${getStatusColor(project.status)}`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="text-gray-400">
              ID: {project.id}
            </div>
          </div>

          {/* Priority Badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium ${getPriorityColor(project.priority)}`}>
              <FaFlag className="w-3 h-3 mr-1" />
              {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {project.metrics.map((metric, index) => (
              <div key={index} className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">{metric.label}</div>
                <div className="text-white text-lg font-medium mt-1">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team & Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Information */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <FaUsers className="w-5 h-5" />
              Team Information
            </h3>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Assigned Team</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProject.team}
                  onChange={(e) => setEditedProject({ ...editedProject, team: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div className="text-white text-lg">{project.team}</div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <FaCalendarAlt className="w-5 h-5" />
              Timeline
            </h3>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Deadline</label>
              {isEditing ? (
                <input
                  type="date"
                  value={editedProject.deadline || ''}
                  onChange={(e) => setEditedProject({ ...editedProject, deadline: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div>
                  <div className="text-white">
                    {project.deadline 
                      ? new Date(project.deadline).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'No deadline set'}
                  </div>
                  {deadlineStatus && (
                    <div className={`mt-1 text-sm ${deadlineStatus.color}`}>
                      {deadlineStatus.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
            <FaProjectDiagram className="w-5 h-5" />
            Project Description
          </h3>
          {isEditing ? (
            <textarea
              value={editedProject.description || ''}
              onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
              placeholder="Add project description, goals, and objectives..."
              className="w-full bg-gray-700 text-white rounded px-3 py-2 h-32 resize-none"
            />
          ) : (
            <div className="text-gray-300 whitespace-pre-wrap">
              {project.description || 'No description added yet.'}
            </div>
          )}
        </div>

        {/* Project Settings */}
        {isEditing && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-medium text-white mb-4">Project Settings</h3>
            
            {/* Priority */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Priority Level</label>
              <div className="space-y-2">
                {['low', 'medium', 'high', 'critical'].map((priorityLevel) => (
                  <label key={priorityLevel} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="priority"
                      value={priorityLevel}
                      checked={editedProject.priority === priorityLevel}
                      onChange={() => setEditedProject({ ...editedProject, priority: priorityLevel as any })}
                      className="w-4 h-4"
                    />
                    <span className="text-white capitalize">{priorityLevel}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Project Status</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="green"
                    checked={editedProject.status === 'green'}
                    onChange={() => setEditedProject({ ...editedProject, status: 'green' })}
                    className="w-4 h-4"
                  />
                  <span className="text-green-500 font-medium">On Track</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="yellow"
                    checked={editedProject.status === 'yellow'}
                    onChange={() => setEditedProject({ ...editedProject, status: 'yellow' })}
                    className="w-4 h-4"
                  />
                  <span className="text-yellow-500 font-medium">At Risk</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="status"
                    value="red"
                    checked={editedProject.status === 'red'}
                    onChange={() => setEditedProject({ ...editedProject, status: 'red' })}
                    className="w-4 h-4"
                  />
                  <span className="text-red-500 font-medium">Off Track</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Additional Information</h3>
          <div className="text-gray-400">
            <div>Created: {new Date(project.dateAdded).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;