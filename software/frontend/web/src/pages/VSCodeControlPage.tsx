import React, { useState, useEffect } from 'react';
import { FaCode, FaFolder, FaFile, FaPlus, FaDownload, FaTerminal, FaCog, FaSearch, FaGitAlt, FaTimes, FaPlay, FaStop, FaClone } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './VSCodeControlPage.css';

interface VSCodeControlPageProps {
  onClose: () => void;
}

interface VSCodeStatus {
  vscodeInstalled: boolean;
  vscodePath: string;
  activeProcesses: number;
  installedExtensions: string[];
  config: any;
}

interface Project {
  name: string;
  path: string;
  type: string;
  lastModified: string;
}

interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
}

const VSCodeControlPage: React.FC<VSCodeControlPageProps> = ({ onClose }) => {
  const { sendCommand, lastMessage, wsStatus } = useUDCWebSocket();
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState<VSCodeStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Project creation form state
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    template: 'empty',
    location: ''
  });

  // Extension installation state
  const [showInstallExtension, setShowInstallExtension] = useState(false);
  const [extensionId, setExtensionId] = useState('');

  // Git clone state
  const [showGitClone, setShowGitClone] = useState(false);
  const [gitUrl, setGitUrl] = useState('');
  const [cloneLocation, setCloneLocation] = useState('');

  // Wait for WebSocket connection before loading data
  useEffect(() => {
    if (wsStatus === 'connected' && !isInitialized) {
      setIsInitialized(true);
      loadStatus();
      loadExtensions();
    }
  }, [wsStatus, isInitialized]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'plugin_response' && lastMessage?.pluginId === 'vscode') {
      handlePluginResponse(lastMessage);
    }
  }, [lastMessage]);

  const handlePluginResponse = (message: any) => {
    if (message.error) {
      setError(message.error);
      setLoading(false);
      return;
    }

    switch (message.command) {
      case 'getStatus':
        setStatus(message.result);
        setLoading(false);
        break;
      case 'listExtensions':
        if (message.result.success) {
          setExtensions(message.result.extensions.map((id: string) => ({
            id,
            name: id.split('.')[1] || id,
            version: 'Unknown',
            description: ''
          })));
        }
        break;
      case 'createProject':
        if (message.result.success) {
          setShowCreateProject(false);
          setNewProject({ name: '', template: 'empty', location: '' });
          // Refresh projects list if we had one
        }
        break;
      case 'installExtension':
        if (message.result.success) {
          setShowInstallExtension(false);
          setExtensionId('');
          loadExtensions(); // Refresh extensions list
        }
        break;
      case 'gitClone':
        if (message.result.success) {
          setShowGitClone(false);
          setGitUrl('');
          setCloneLocation('');
        }
        break;
    }
  };

  const loadStatus = async () => {
    if (wsStatus !== 'connected') {
      console.log('WebSocket not connected, skipping status load');
      return;
    }
    try {
      await sendCommand('vscode', 'getStatus');
    } catch (error) {
      console.error('Failed to get status:', error);
      setError('Failed to get VS Code status. Please check if plugin is running.');
      setLoading(false);
    }
  };

  const loadExtensions = async () => {
    if (wsStatus !== 'connected') return;
    try {
      await sendCommand('vscode', 'listExtensions');
    } catch (error) {
      console.error('Failed to load extensions:', error);
    }
  };

  const handleLaunchVSCode = async () => {
    try {
      await sendCommand('vscode', 'launch');
    } catch (error) {
      setError('Failed to launch VS Code');
    }
  };

  const handleOpenFolder = async () => {
    // In a real implementation, you'd open a folder picker
    // For now, we'll just launch VS Code
    try {
      await sendCommand('vscode', 'launch');
    } catch (error) {
      setError('Failed to open folder');
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name) {
      setError('Project name is required');
      return;
    }

    try {
      await sendCommand('vscode', 'createProject', {
        projectName: newProject.name,
        template: newProject.template,
        location: newProject.location || undefined
      });
    } catch (error) {
      setError('Failed to create project');
    }
  };

  const handleInstallExtension = async () => {
    if (!extensionId) {
      setError('Extension ID is required');
      return;
    }

    try {
      await sendCommand('vscode', 'installExtension', {
        extensionId: extensionId
      });
    } catch (error) {
      setError('Failed to install extension');
    }
  };

  const handleGitClone = async () => {
    if (!gitUrl) {
      setError('Repository URL is required');
      return;
    }

    try {
      await sendCommand('vscode', 'gitClone', {
        repositoryUrl: gitUrl,
        targetDirectory: cloneLocation || undefined
      });
    } catch (error) {
      setError('Failed to clone repository');
    }
  };

  const handleOpenTerminal = async () => {
    try {
      await sendCommand('vscode', 'openTerminal');
    } catch (error) {
      setError('Failed to open terminal');
    }
  };

  const handleOpenSettings = async () => {
    try {
      await sendCommand('vscode', 'openSettings');
    } catch (error) {
      setError('Failed to open settings');
    }
  };

  // Show loading state while connecting
  if (wsStatus === 'connecting' || wsStatus === 'disconnected') {
    return (
      <div className="vscode-control-page">
        <div className="page-header">
          <div className="header-left">
            <FaCode className="page-icon" />
            <div>
              <h1>Visual Studio Code Control</h1>
              <p>Professional code editor and development environment</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>
        <div className="status-bar">
          <div className="status-item">
            <span className="status-label">Connection:</span>
            <span className="status-value inactive">
              {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if connection failed
  if (wsStatus === 'failed') {
    return (
      <div className="vscode-control-page">
        <div className="page-header">
          <div className="header-left">
            <FaCode className="page-icon" />
            <div>
              <h1>Visual Studio Code Control</h1>
              <p>Connection failed</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>
        <div className="error-message">
          <p>Failed to connect to desktop controller. Please ensure the Universal Desktop Controller is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vscode-control-page">
      <div className="page-header">
        <div className="header-left">
          <FaCode className="page-icon" />
          <div>
            <h1>Visual Studio Code Control</h1>
            <p>Professional code editor and development environment</p>
          </div>
        </div>
        <button onClick={onClose} className="close-button">
          <FaTimes />
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">VS Code:</span>
          <span className={`status-value ${status?.vscodeInstalled ? 'active' : 'inactive'}`}>
            {status?.vscodeInstalled ? 'Installed' : 'Not Found'}
          </span>
        </div>
        {status?.vscodeInstalled && (
          <>
            <div className="status-item">
              <span className="status-label">Active Processes:</span>
              <span className="status-value">{status.activeProcesses}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Extensions:</span>
              <span className="status-value">{status.installedExtensions?.length || 0}</span>
            </div>
          </>
        )}
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaCode /> Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FaFolder /> Projects
        </button>
        <button 
          className={`tab-button ${activeTab === 'extensions' ? 'active' : ''}`}
          onClick={() => setActiveTab('extensions')}
        >
          <FaDownload /> Extensions
        </button>
        <button 
          className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          <FaCog /> Tools
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-grid">
                <button className="action-button" onClick={handleLaunchVSCode}>
                  <FaPlay />
                  <span>Launch VS Code</span>
                </button>
                <button className="action-button" onClick={handleOpenFolder}>
                  <FaFolder />
                  <span>Open Folder</span>
                </button>
                <button className="action-button" onClick={() => setShowCreateProject(true)}>
                  <FaPlus />
                  <span>New Project</span>
                </button>
                <button className="action-button" onClick={() => setShowGitClone(true)}>
                  <FaGitAlt />
                  <span>Clone Repository</span>
                </button>
                <button className="action-button" onClick={handleOpenTerminal}>
                  <FaTerminal />
                  <span>Open Terminal</span>
                </button>
                <button className="action-button" onClick={handleOpenSettings}>
                  <FaCog />
                  <span>Settings</span>
                </button>
              </div>
            </div>

            <div className="info-section">
              <h3>VS Code Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <strong>Installation Path:</strong>
                  <span>{status?.vscodePath || 'Not found'}</span>
                </div>
                <div className="info-item">
                  <strong>Status:</strong>
                  <span>{status?.vscodeInstalled ? 'Ready to use' : 'Not installed'}</span>
                </div>
                <div className="info-item">
                  <strong>Active Windows:</strong>
                  <span>{status?.activeProcesses || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="projects-tab">
            <div className="section-header">
              <h3>Project Management</h3>
              <button 
                className="primary-button"
                onClick={() => setShowCreateProject(true)}
              >
                <FaPlus /> New Project
              </button>
            </div>

            <div className="project-templates">
              <h4>Quick Start Templates</h4>
              <div className="template-grid">
                <div className="template-card" onClick={() => {
                  setNewProject({ ...newProject, template: 'node' });
                  setShowCreateProject(true);
                }}>
                  <div className="template-icon">📦</div>
                  <h5>Node.js</h5>
                  <p>JavaScript/TypeScript project with package.json</p>
                </div>
                <div className="template-card" onClick={() => {
                  setNewProject({ ...newProject, template: 'python' });
                  setShowCreateProject(true);
                }}>
                  <div className="template-icon">🐍</div>
                  <h5>Python</h5>
                  <p>Python project with virtual environment</p>
                </div>
                <div className="template-card" onClick={() => {
                  setNewProject({ ...newProject, template: 'web' });
                  setShowCreateProject(true);
                }}>
                  <div className="template-icon">🌐</div>
                  <h5>Web</h5>
                  <p>HTML, CSS, JavaScript starter</p>
                </div>
                <div className="template-card" onClick={() => {
                  setNewProject({ ...newProject, template: 'empty' });
                  setShowCreateProject(true);
                }}>
                  <div className="template-icon">📄</div>
                  <h5>Empty</h5>
                  <p>Blank project with README</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'extensions' && (
          <div className="extensions-tab">
            <div className="section-header">
              <h3>Installed Extensions ({extensions.length})</h3>
              <button 
                className="primary-button"
                onClick={() => setShowInstallExtension(true)}
              >
                <FaDownload /> Install Extension
              </button>
            </div>

            <div className="extensions-list">
              {extensions.length === 0 ? (
                <div className="empty-state">
                  <FaDownload className="empty-icon" />
                  <p>No extensions found</p>
                  <p>Extensions will appear here once VS Code is launched and extensions are installed.</p>
                </div>
              ) : (
                extensions.map((ext) => (
                  <div key={ext.id} className="extension-item">
                    <div className="extension-info">
                      <h4>{ext.name}</h4>
                      <p>{ext.id}</p>
                      {ext.description && <p className="extension-description">{ext.description}</p>}
                    </div>
                    <div className="extension-version">
                      <span>{ext.version}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="popular-extensions">
              <h4>Popular Extensions</h4>
              <div className="extension-suggestions">
                <button onClick={() => { setExtensionId('ms-python.python'); setShowInstallExtension(true); }}>
                  Python
                </button>
                <button onClick={() => { setExtensionId('dbaeumer.vscode-eslint'); setShowInstallExtension(true); }}>
                  ESLint
                </button>
                <button onClick={() => { setExtensionId('esbenp.prettier-vscode'); setShowInstallExtension(true); }}>
                  Prettier
                </button>
                <button onClick={() => { setExtensionId('ms-vscode.vscode-typescript-next'); setShowInstallExtension(true); }}>
                  TypeScript
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="tools-tab">
            <div className="tools-grid">
              <div className="tool-section">
                <h4>Development Tools</h4>
                <button className="tool-button" onClick={handleOpenTerminal}>
                  <FaTerminal />
                  <span>Integrated Terminal</span>
                </button>
                <button className="tool-button" onClick={handleOpenSettings}>
                  <FaCog />
                  <span>Settings</span>
                </button>
                <button className="tool-button" onClick={() => sendCommand('vscode', 'openKeybindings')}>
                  <FaCode />
                  <span>Keyboard Shortcuts</span>
                </button>
              </div>

              <div className="tool-section">
                <h4>Version Control</h4>
                <button className="tool-button" onClick={() => setShowGitClone(true)}>
                  <FaGitAlt />
                  <span>Clone Repository</span>
                </button>
                <button className="tool-button" onClick={() => sendCommand('vscode', 'gitStatus')}>
                  <FaSearch />
                  <span>Git Status</span>
                </button>
              </div>

              <div className="tool-section">
                <h4>Search & Navigation</h4>
                <button className="tool-button" onClick={() => sendCommand('vscode', 'search', { query: '' })}>
                  <FaSearch />
                  <span>Search in Files</span>
                </button>
                <button className="tool-button" onClick={() => sendCommand('vscode', 'runCommand', { command: 'workbench.action.quickOpen' })}>
                  <FaFile />
                  <span>Quick Open</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button onClick={() => setShowCreateProject(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div className="form-group">
                <label>Template</label>
                <select
                  value={newProject.template}
                  onChange={(e) => setNewProject({ ...newProject, template: e.target.value })}
                >
                  <option value="empty">Empty Project</option>
                  <option value="node">Node.js</option>
                  <option value="python">Python</option>
                  <option value="web">Web (HTML/CSS/JS)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Location (optional)</label>
                <input
                  type="text"
                  value={newProject.location}
                  onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  placeholder="Leave empty for default location"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateProject(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleCreateProject} className="primary-button">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Extension Modal */}
      {showInstallExtension && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Install Extension</h3>
              <button onClick={() => setShowInstallExtension(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Extension ID</label>
                <input
                  type="text"
                  value={extensionId}
                  onChange={(e) => setExtensionId(e.target.value)}
                  placeholder="e.g., ms-python.python"
                />
                <small>Enter the extension ID from the VS Code marketplace</small>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowInstallExtension(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleInstallExtension} className="primary-button">
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Git Clone Modal */}
      {showGitClone && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Clone Repository</h3>
              <button onClick={() => setShowGitClone(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Repository URL</label>
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                />
              </div>
              <div className="form-group">
                <label>Clone Location (optional)</label>
                <input
                  type="text"
                  value={cloneLocation}
                  onChange={(e) => setCloneLocation(e.target.value)}
                  placeholder="Leave empty for default location"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowGitClone(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleGitClone} className="primary-button">
                Clone & Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VSCodeControlPage;