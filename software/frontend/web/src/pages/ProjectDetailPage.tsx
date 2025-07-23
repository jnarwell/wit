// src/pages/ProjectDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaEdit, FaSave, FaPlus } from 'react-icons/fa';
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
  name: string;
  description: string;
  status: string;
}

interface Team {
    id: string;
    name: string;
}

interface File {
  id: string;
  filename: string;
  filesize: number;
  filetype: string;
}

interface Member {
  id: string;
  username: string;
  role: string;
}

interface ProjectDetailPageProps {
  projectId: string; // This is the project_id (e.g., "PROJ-...")
  onClose: () => void;
  onNotFound: () => void;
}

const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ projectId, onClose, onNotFound }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Partial<Project> & { extra_data?: Partial<Project['extra_data']> }>({});
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', description: '' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');

  const fetchProjectData = useCallback(async () => {
    if (!isAuthenticated || !tokens) {
      setError("Authentication required.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setProjectNotFound(false);
    setError(null);

    try {
      // Fetch main project details
      const projectResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          setProjectNotFound(true);
          onNotFound();
        } else {
          throw new Error('Failed to fetch project details.');
        }
        return;
      }
      const projectData = await projectResponse.json();
      setProject(projectData);
      setEditedProject(projectData);

      // ... (rest of the function)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tokens, isAuthenticated]);

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

  const handleAddTask = async () => {
    if (!tokens) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });
      if (!response.ok) throw new Error('Failed to add task');
      fetchProjectData();
      setShowAddTaskModal(false);
      setNewTask({ name: '', description: '' });
    } catch (err) {
      // Handle error
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
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
      // Handle error
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!tokens) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to delete task');
      fetchProjectData();
    } catch (err) {
      // Handle error
    }
  };

  const handleFileUpload = async () => {
    if (!tokens || !fileToUpload) return;
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload file');
      fetchProjectData();
      setShowUploadModal(false);
      setFileToUpload(null);
    } catch (err) {
      // Handle error
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!tokens) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to delete file');
      fetchProjectData();
    } catch (err) {
      // Handle error
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
        body: JSON.stringify({ username: newMemberName, role: newMemberRole }),
      });
      if (!response.ok) throw new Error('Failed to add member');
      fetchProjectData();
      setShowAddMemberModal(false);
      setNewMemberName('');
      setNewMemberRole('viewer');
    } catch (err) {
      // Handle error
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tokens) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to remove member');
      fetchProjectData();
    } catch (err) {
      // Handle error
    }
  };

  if (isLoading) return <div className="h-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (projectNotFound) return <div className="h-full bg-gray-900 flex items-center justify-center text-red-500">Project not found.</div>;
  if (error) return <div className="h-full bg-gray-900 flex items-center justify-center text-red-500">{error}</div>;
  if (!project) return <div className="h-full bg-gray-900 flex items-center justify-center text-gray-400">No project data.</div>;


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

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* ... (project details) */}

        {/* Tasks Section */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Tasks</h3>
          <button onClick={() => setShowAddTaskModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">
            <FaPlus /> Add Task
          </button>
          <div className="space-y-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-gray-800 p-4 rounded">
                <h4 className="font-bold text-white">{task.name}</h4>
                <p className="text-gray-400">{task.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`px-2 py-1 text-xs rounded ${task.status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}`}>
                    {task.status}
                  </span>
                  <button onClick={() => handleUpdateTaskStatus(task.id, 'completed')} className="text-green-400">Complete</button>
                  <button onClick={() => handleDeleteTask(task.id)} className="text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Files Section */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Files</h3>
          <button onClick={() => setShowUploadModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">
            <FaPlus /> Upload File
          </button>
          <div className="space-y-4">
            {files.map(file => (
              <div key={file.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white">{file.filename}</h4>
                  <p className="text-gray-400 text-sm">{file.filetype} - {(file.filesize / 1024).toFixed(2)} KB</p>
                </div>
                <button onClick={() => handleDeleteFile(file.id)} className="text-red-400">Delete</button>
              </div>
            ))}
          </div>
        </div>

        {/* Members Section */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-4">Members</h3>
          <button onClick={() => setShowAddMemberModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">
            <FaPlus /> Add Member
          </button>
          <div className="space-y-4">
            {members.map(member => (
              <div key={member.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
                <div>
                  <p className="text-white">{member.username}</p>
                  <p className="text-gray-400 text-sm">{member.role}</p>
                </div>
                <button onClick={() => handleRemoveMember(member.id)} className="text-red-400">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded">
            <h3 className="text-xl font-bold text-white mb-4">Add New Task</h3>
            <input
              type="text"
              placeholder="Task Name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4"
            />
            <textarea
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4"
            />
            <div className="flex gap-4">
              <button onClick={handleAddTask} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
              <button onClick={() => setShowAddTaskModal(false)} className="bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded">
            <h3 className="text-xl font-bold text-white mb-4">Upload File</h3>
            <input
              type="file"
              onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4"
            />
            <div className="flex gap-4">
              <button onClick={handleFileUpload} className="bg-blue-600 text-white px-4 py-2 rounded">Upload</button>
              <button onClick={() => setShowUploadModal(false)} className="bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded">
            <h3 className="text-xl font-bold text-white mb-4">Add New Member</h3>
            <input
              type="text"
              placeholder="Username"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4"
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-4">
              <button onClick={handleAddMember} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
              <button onClick={() => setShowAddMemberModal(false)} className="bg-gray-600 text-white px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;