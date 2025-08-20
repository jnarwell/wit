import React, { useState, useEffect, useCallback } from 'react';
import { FaChevronLeft, FaFolder, FaFile, FaMicrochip, FaCog, FaDownload, FaUpload, FaPlus, FaTrash, FaSync, FaCheck, FaTimes, FaExclamationTriangle, FaCube, FaFileExport, FaClipboardList, FaSearch } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './KiCadControlPage.css';

interface KiCadProject {
  name: string;
  path: string;
  hasSchematic: boolean;
  hasPCB: boolean;
  hasGerbers: boolean;
  has3DModel: boolean;
  lastModified: string;
  size: number;
}

interface KiCadControlPageProps {
  onClose: () => void;
}

const KiCadControlPage: React.FC<KiCadControlPageProps> = ({ onClose }) => {
  const { status: udcStatus, wsStatus, sendCommand } = useUDCWebSocket();
  const [projects, setProjects] = useState<KiCadProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<KiCadProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kicadStatus, setKicadStatus] = useState<any>(null);
  
  // Modal states
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'gerbers' | 'bom' | '3d'>('gerbers');
  
  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  
  // Export options
  const [exportFormat, setExportFormat] = useState('step');
  const [bomFormat, setBomFormat] = useState('csv');

  const loadKiCadStatus = useCallback(async () => {
    try {
      console.log('[KiCad] Loading status...');
      const response = await sendCommand('kicad', 'getStatus');
      console.log('[KiCad] Status response:', response);
      if (response && response.result) {
        setKicadStatus(response.result);
      } else {
        console.warn('[KiCad] No result in status response');
        setKicadStatus(null);
      }
    } catch (err) {
      console.error('[KiCad] Failed to load status:', err);
      setKicadStatus(null);
    }
  }, [sendCommand]);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[KiCad] Loading projects...');
      const response = await sendCommand('kicad', 'listProjects');
      console.log('[KiCad] Projects response:', response);
      if (response && response.result) {
        setProjects(response.result);
      } else {
        console.warn('[KiCad] No result in projects response');
        setProjects([]);
      }
    } catch (err) {
      setError('Failed to load projects');
      console.error('[KiCad] Failed to load projects:', err);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [sendCommand]);

  // Load KiCad status and projects when WebSocket is connected
  useEffect(() => {
    if (wsStatus === 'connected') {
      console.log('[KiCad] WebSocket connected, loading data...');
      loadKiCadStatus();
      loadProjects();
    } else {
      console.log('[KiCad] WebSocket status:', wsStatus);
    }
  }, [wsStatus, loadKiCadStatus, loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await sendCommand('kicad', 'createProject', {
        name: newProjectName,
        description: newProjectDescription
      });
      
      if (response.result.success) {
        await loadProjects();
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectDescription('');
      } else {
        setError('Failed to create project');
      }
    } catch (err) {
      setError('Failed to create project');
      console.error('Failed to create project:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (project: KiCadProject) => {
    try {
      await sendCommand('kicad', 'openProject', { projectPath: project.path });
      setSelectedProject(project);
    } catch (err) {
      setError('Failed to open project');
      console.error('Failed to open project:', err);
    }
  };

  const handleOpenSchematic = async () => {
    if (!selectedProject) return;
    
    try {
      await sendCommand('kicad', 'openSchematic', { projectPath: selectedProject.path });
    } catch (err) {
      setError('Failed to open schematic editor');
      console.error('Failed to open schematic:', err);
    }
  };

  const handleOpenPCB = async () => {
    if (!selectedProject) return;
    
    try {
      await sendCommand('kicad', 'openPCB', { projectPath: selectedProject.path });
    } catch (err) {
      setError('Failed to open PCB editor');
      console.error('Failed to open PCB:', err);
    }
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let response;
      switch (exportType) {
        case 'gerbers':
          response = await sendCommand('kicad', 'exportGerbers', { 
            projectPath: selectedProject.path 
          });
          break;
        case 'bom':
          response = await sendCommand('kicad', 'exportBOM', { 
            projectPath: selectedProject.path,
            format: bomFormat
          });
          break;
        case '3d':
          response = await sendCommand('kicad', 'export3D', { 
            projectPath: selectedProject.path,
            format: exportFormat
          });
          break;
      }
      
      if (response?.result?.success) {
        setShowExportModal(false);
        await loadProjects(); // Refresh to show export status
      } else {
        setError(`Failed to export ${exportType}`);
      }
    } catch (err) {
      setError(`Failed to export ${exportType}`);
      console.error(`Failed to export ${exportType}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (project: KiCadProject) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await sendCommand('kicad', 'deleteProject', { 
        projectPath: project.path 
      });
      
      if (response.result.success) {
        await loadProjects();
        if (selectedProject?.path === project.path) {
          setSelectedProject(null);
        }
      }
    } catch (err) {
      setError('Failed to delete project');
      console.error('Failed to delete project:', err);
    }
  };

  const handleRunDRC = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await sendCommand('kicad', 'runDRC', { 
        projectPath: selectedProject.path 
      });
      if (response.result.message) {
        alert(response.result.message);
      }
    } catch (err) {
      setError('Failed to run DRC');
      console.error('Failed to run DRC:', err);
    }
  };

  const handleRunERC = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await sendCommand('kicad', 'runERC', { 
        projectPath: selectedProject.path 
      });
      if (response.result.message) {
        alert(response.result.message);
      }
    } catch (err) {
      setError('Failed to run ERC');
      console.error('Failed to run ERC:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Show loading state while WebSocket is connecting
  if (wsStatus === 'connecting') {
    return (
      <div className="kicad-control-page">
        <div className="page-header">
          <button onClick={onClose} className="back-button">
            <FaChevronLeft /> Back
          </button>
          <h1>KiCad EDA Control</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Connecting to Universal Desktop Controller...</p>
        </div>
      </div>
    );
  }

  // Show error if WebSocket failed to connect
  if (wsStatus === 'failed' || wsStatus === 'disconnected') {
    return (
      <div className="kicad-control-page">
        <div className="page-header">
          <button onClick={onClose} className="back-button">
            <FaChevronLeft /> Back
          </button>
          <h1>KiCad EDA Control</h1>
        </div>
        <div className="error-container">
          <FaExclamationTriangle />
          <h2>Connection Error</h2>
          <p>Unable to connect to the Universal Desktop Controller.</p>
          <p>Please ensure the UDC is running and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kicad-control-page">
      <div className="page-header">
        <button onClick={onClose} className="back-button">
          <FaChevronLeft /> Back
        </button>
        <h1>KiCad EDA Control</h1>
        <div className="header-status">
          {kicadStatus?.installed ? (
            <span className="status-badge success">
              <FaCheck /> KiCad {kicadStatus.version}
            </span>
          ) : kicadStatus === null ? (
            <span className="status-badge warning">
              <FaSync className="spin" /> Loading...
            </span>
          ) : (
            <span className="status-badge error">
              <FaTimes /> KiCad Not Found
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FaExclamationTriangle /> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="kicad-content">
        <div className="projects-panel">
          <div className="panel-header">
            <h2>Projects</h2>
            <div className="panel-actions">
              <button 
                className="action-button"
                onClick={() => setShowNewProjectModal(true)}
                disabled={!kicadStatus?.installed}
              >
                <FaPlus /> New Project
              </button>
              <button 
                className="action-button"
                onClick={loadProjects}
                disabled={isLoading}
              >
                <FaSync className={isLoading ? 'spinning' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div className="projects-list">
            {isLoading && projects.length === 0 ? (
              <div className="loading-message">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="empty-message">
                <FaFolder />
                <p>No projects found</p>
                <p className="hint">Create a new project to get started</p>
              </div>
            ) : (
              projects.map((project) => (
                <div 
                  key={project.path}
                  className={`project-item ${selectedProject?.path === project.path ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="project-icon">
                    <FaFolder />
                  </div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <div className="project-details">
                      {project.hasSchematic && (
                        <span className="detail-badge">
                          <FaMicrochip /> Schematic
                        </span>
                      )}
                      {project.hasPCB && (
                        <span className="detail-badge">
                          <FaMicrochip /> PCB
                        </span>
                      )}
                      {project.hasGerbers && (
                        <span className="detail-badge">
                          <FaFileExport /> Gerbers
                        </span>
                      )}
                      {project.has3DModel && (
                        <span className="detail-badge">
                          <FaCube /> 3D Model
                        </span>
                      )}
                    </div>
                    <div className="project-meta">
                      <span>{formatFileSize(project.size)}</span>
                      <span className="separator">•</span>
                      <span>{formatDate(project.lastModified)}</span>
                    </div>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project);
                    }}
                    title="Delete project"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="control-panel">
          {selectedProject ? (
            <>
              <div className="panel-header">
                <h2>{selectedProject.name}</h2>
              </div>

              <div className="control-sections">
                <div className="control-section">
                  <h3>Design Tools</h3>
                  <div className="control-grid">
                    <button 
                      className="control-button"
                      onClick={() => handleOpenProject(selectedProject)}
                    >
                      <FaFolder /> Open Project
                    </button>
                    <button 
                      className="control-button"
                      onClick={handleOpenSchematic}
                      disabled={!selectedProject.hasSchematic}
                    >
                      <FaMicrochip /> Schematic Editor
                    </button>
                    <button 
                      className="control-button"
                      onClick={handleOpenPCB}
                      disabled={!selectedProject.hasPCB}
                    >
                      <FaMicrochip /> PCB Editor
                    </button>
                  </div>
                </div>

                <div className="control-section">
                  <h3>Analysis & Verification</h3>
                  <div className="control-grid">
                    <button 
                      className="control-button"
                      onClick={handleRunERC}
                      disabled={!selectedProject.hasSchematic}
                    >
                      <FaExclamationTriangle /> Run ERC
                    </button>
                    <button 
                      className="control-button"
                      onClick={handleRunDRC}
                      disabled={!selectedProject.hasPCB}
                    >
                      <FaExclamationTriangle /> Run DRC
                    </button>
                  </div>
                </div>

                <div className="control-section">
                  <h3>Export Options</h3>
                  <div className="control-grid">
                    <button 
                      className="control-button"
                      onClick={() => {
                        setExportType('gerbers');
                        setShowExportModal(true);
                      }}
                      disabled={!selectedProject.hasPCB}
                    >
                      <FaFileExport /> Export Gerbers
                    </button>
                    <button 
                      className="control-button"
                      onClick={() => {
                        setExportType('bom');
                        setShowExportModal(true);
                      }}
                      disabled={!selectedProject.hasSchematic}
                    >
                      <FaClipboardList /> Export BOM
                    </button>
                    <button 
                      className="control-button"
                      onClick={() => {
                        setExportType('3d');
                        setShowExportModal(true);
                      }}
                      disabled={!selectedProject.hasPCB}
                    >
                      <FaCube /> Export 3D Model
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <FaMicrochip className="no-selection-icon" />
              <h3>No Project Selected</h3>
              <p>Select a project from the list or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button 
                className="close-button"
                onClick={() => setShowNewProjectModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="MyPCBProject"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="A brief description of your project"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-button"
                onClick={handleCreateProject}
                disabled={isLoading || !newProjectName.trim()}
              >
                {isLoading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Export {exportType === 'gerbers' ? 'Gerbers' : exportType === 'bom' ? 'BOM' : '3D Model'}</h2>
              <button 
                className="close-button"
                onClick={() => setShowExportModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {exportType === 'gerbers' && (
                <p>Export Gerber files for PCB manufacturing. Files will be saved in the project's 'gerbers' folder.</p>
              )}
              {exportType === 'bom' && (
                <div className="form-group">
                  <label>Format</label>
                  <select
                    value={bomFormat}
                    onChange={(e) => setBomFormat(e.target.value)}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              )}
              {exportType === '3d' && (
                <div className="form-group">
                  <label>Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="step">STEP</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-button"
                onClick={handleExport}
                disabled={isLoading}
              >
                {isLoading ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KiCadControlPage;