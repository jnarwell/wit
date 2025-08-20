import React, { useState, useEffect } from 'react';
import { FaPlay, FaStop, FaFolder, FaFileCode, FaPlus, FaCube, FaServer, FaGlobe, FaDownload, FaUpload, FaProjectDiagram, FaCog, FaChartLine, FaMicrochip, FaNetworkWired, FaDatabase, FaFlask, FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './LabVIEWControlPage.css';

interface VI {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: string;
}

interface Project {
  name: string;
  path: string;
  directory: string;
  size: number;
  modified: Date;
}

interface LabVIEWConfig {
  viPath: string;
  projectsPath: string;
  autoSaveInterval: number;
  webServicePort: number;
  enableRemotePanel: boolean;
  enableWebServices: boolean;
  defaultTargetType: string;
  viServerPort: number;
  viServerEnabled: boolean;
}

interface LabVIEWControlPageProps {
  onClose?: () => void;
}

const LabVIEWControlPage: React.FC<LabVIEWControlPageProps> = ({ onClose }) => {
  const { isAuthenticated } = useAuth();
  const { status: udcStatus, sendCommand, lastResponse } = useUDCWebSocket();
  const [activeTab, setActiveTab] = useState('vis');
  const [vis, setVIs] = useState<VI[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedVI, setSelectedVI] = useState<VI | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [labviewStatus, setLabVIEWStatus] = useState<any>({});
  const [showNewVIModal, setShowNewVIModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<LabVIEWConfig>({
    viPath: '~/Documents/LabVIEW Data',
    projectsPath: '~/Documents/LabVIEW Data/Projects',
    autoSaveInterval: 300,
    webServicePort: 8080,
    enableRemotePanel: false,
    enableWebServices: true,
    defaultTargetType: 'myComputer',
    viServerPort: 3363,
    viServerEnabled: false
  });
  
  const [newVI, setNewVI] = useState({
    name: '',
    template: 'blank'
  });
  
  const [newProject, setNewProject] = useState({
    name: '',
    template: 'blank'
  });

  // Check if LabVIEW plugin is active
  const isLabVIEWActive = udcStatus.plugins.some(
    p => p.id === 'labview' && (p.status === 'active' || p.status === 'running' || p.status === 'started')
  );

  useEffect(() => {
    if (isLabVIEWActive) {
      loadVIs();
      loadProjects();
      getLabVIEWStatus();
    }
  }, [isLabVIEWActive]);

  // Monitor command responses
  useEffect(() => {
    if (lastResponse && lastResponse.pluginId === 'labview') {
      if (lastResponse.action === 'listVIs' && lastResponse.data) {
        setVIs(lastResponse.data);
      } else if (lastResponse.action === 'listProjects' && lastResponse.data) {
        setProjects(lastResponse.data);
      } else if (lastResponse.action === 'status' && lastResponse.data) {
        setLabVIEWStatus(lastResponse.data);
      }
    }
  }, [lastResponse]);

  const loadVIs = async () => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'listVIs');
    } catch (error) {
      console.error('Failed to load VIs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      await sendCommand('labview', 'listProjects');
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const getLabVIEWStatus = async () => {
    try {
      const response = await fetch(`http://localhost:${config.webServicePort}/status`);
      if (response.ok) {
        const status = await response.json();
        setLabVIEWStatus(status);
      }
    } catch (error) {
      // Web service might not be running
    }
  };

  const handleLaunchLabVIEW = async () => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'launch');
    } catch (error) {
      console.error('Failed to launch LabVIEW:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenVI = async (vi: VI) => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'openVI', { viPath: vi.path });
      setSelectedVI(vi);
    } catch (error) {
      console.error('Failed to open VI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (project: Project) => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'openProject', { projectPath: project.path });
      setSelectedProject(project);
    } catch (error) {
      console.error('Failed to open project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunVI = async (vi: VI) => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'runVI', { viPath: vi.path });
    } catch (error) {
      console.error('Failed to run VI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopVI = async (vi: VI) => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'stopVI', { viPath: vi.path });
    } catch (error) {
      console.error('Failed to stop VI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewVI = async () => {
    if (!newVI.name) return;
    
    setIsLoading(true);
    try {
      await sendCommand('labview', 'newVI', newVI);
      setShowNewVIModal(false);
      setNewVI({ name: '', template: 'blank' });
      await loadVIs();
    } catch (error) {
      console.error('Failed to create VI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewProject = async () => {
    if (!newProject.name) return;
    
    setIsLoading(true);
    try {
      await sendCommand('labview', 'newProject', newProject);
      setShowNewProjectModal(false);
      setNewProject({ name: '', template: 'blank' });
      await loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildExecutable = async (project: Project) => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'buildExecutable', { 
        projectPath: project.path,
        buildSpec: 'default'
      });
    } catch (error) {
      console.error('Failed to build executable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVIServer = async () => {
    setIsLoading(true);
    try {
      if (config.viServerEnabled) {
        await sendCommand('labview', 'stopVIServer');
      } else {
        await sendCommand('labview', 'startVIServer');
      }
      setConfig({ ...config, viServerEnabled: !config.viServerEnabled });
    } catch (error) {
      console.error('Failed to toggle VI Server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWebService = async () => {
    setIsLoading(true);
    try {
      if (config.enableWebServices) {
        await sendCommand('labview', 'stopWebService');
      } else {
        await sendCommand('labview', 'startWebService');
      }
      setConfig({ ...config, enableWebServices: !config.enableWebServices });
    } catch (error) {
      console.error('Failed to toggle web service:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableRemotePanel = async (vi: VI) => {
    setIsLoading(true);
    try {
      const response = await sendCommand('labview', 'enableRemotePanel', { viPath: vi.path });
      if (response && response.url) {
        window.open(response.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to enable remote panel:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!selectedVI) return;
    
    setIsLoading(true);
    try {
      await sendCommand('labview', 'exportData', { 
        dataPath: selectedVI.path,
        format: 'csv'
      });
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportData = async () => {
    // In a real implementation, this would open a file picker
    const filePath = prompt('Enter the path to the data file:');
    if (!filePath || !selectedVI) return;
    
    setIsLoading(true);
    try {
      await sendCommand('labview', 'importData', { 
        filePath,
        viPath: selectedVI.path
      });
    } catch (error) {
      console.error('Failed to import data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    setIsLoading(true);
    try {
      await sendCommand('labview', 'updateConfig', config);
      setShowConfigModal(false);
    } catch (error) {
      console.error('Failed to update configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  if (!isAuthenticated) {
    return <div className="labview-control-page">Please log in to use LabVIEW control.</div>;
  }

  if (!isLabVIEWActive) {
    return (
      <div className="labview-control-page">
        <div className="not-connected">
          <FaMicrochip className="status-icon" />
          <h2>LabVIEW Plugin Not Active</h2>
          <p>Please ensure the LabVIEW plugin is running in the Universal Desktop Controller.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="labview-control-page">
      <div className="page-header">
        <div className="header-left">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft /> Back
            </button>
          )}
          <h1>LabVIEW Control Center</h1>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleLaunchLabVIEW} 
            className="primary-button"
            disabled={isLoading}
          >
            <FaPlay /> Launch LabVIEW
          </button>
          <button 
            onClick={() => setShowConfigModal(true)}
            className="secondary-button"
          >
            <FaCog /> Settings
          </button>
        </div>
      </div>

      <div className="status-bar">
        <div className="status-item">
          <span>VI Server:</span>
          <span className={config.viServerEnabled ? 'status-active' : 'status-inactive'}>
            {config.viServerEnabled ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="status-item">
          <span>Web Service:</span>
          <span className={config.enableWebServices ? 'status-active' : 'status-inactive'}>
            {config.enableWebServices ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="status-item">
          <span>Active VIs:</span>
          <span>{labviewStatus.activeVIs?.length || 0}</span>
        </div>
        <div className="status-item">
          <span>Remote Panels:</span>
          <span>{labviewStatus.remoteInstances?.length || 0}</span>
        </div>
      </div>

      <div className="control-tabs">
        <button
          className={`tab-button ${activeTab === 'vis' ? 'active' : ''}`}
          onClick={() => setActiveTab('vis')}
        >
          <FaFileCode /> Virtual Instruments
        </button>
        <button
          className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FaProjectDiagram /> Projects
        </button>
        <button
          className={`tab-button ${activeTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          <FaMicrochip /> Hardware
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <FaChartLine /> Data & Analysis
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'vis' && (
          <div className="vis-section">
            <div className="section-header">
              <h2>Virtual Instruments</h2>
              <button 
                onClick={() => setShowNewVIModal(true)}
                className="add-button"
              >
                <FaPlus /> New VI
              </button>
            </div>
            
            {isLoading ? (
              <div className="loading">Loading VIs...</div>
            ) : vis.length === 0 ? (
              <div className="empty-state">
                <FaFileCode className="empty-icon" />
                <p>No VIs found. Create your first VI to get started.</p>
              </div>
            ) : (
              <div className="vi-grid">
                {vis.map((vi, index) => (
                  <div 
                    key={index} 
                    className={`vi-card ${selectedVI?.path === vi.path ? 'selected' : ''}`}
                    onClick={() => setSelectedVI(vi)}
                  >
                    <div className="vi-icon">
                      <FaFileCode />
                    </div>
                    <div className="vi-info">
                      <h3>{vi.name}</h3>
                      <p className="vi-type">{vi.type}</p>
                      <p className="vi-meta">
                        {formatFileSize(vi.size)} • {formatDate(vi.modified)}
                      </p>
                    </div>
                    <div className="vi-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenVI(vi);
                        }}
                        className="action-button"
                        title="Open VI"
                      >
                        <FaFolder />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunVI(vi);
                        }}
                        className="action-button"
                        title="Run VI"
                      >
                        <FaPlay />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopVI(vi);
                        }}
                        className="action-button"
                        title="Stop VI"
                      >
                        <FaStop />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnableRemotePanel(vi);
                        }}
                        className="action-button"
                        title="Remote Panel"
                      >
                        <FaGlobe />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="projects-section">
            <div className="section-header">
              <h2>Projects</h2>
              <button 
                onClick={() => setShowNewProjectModal(true)}
                className="add-button"
              >
                <FaPlus /> New Project
              </button>
            </div>
            
            {projects.length === 0 ? (
              <div className="empty-state">
                <FaProjectDiagram className="empty-icon" />
                <p>No projects found. Create your first project to get started.</p>
              </div>
            ) : (
              <div className="project-list">
                {projects.map((project, index) => (
                  <div 
                    key={index} 
                    className={`project-card ${selectedProject?.path === project.path ? 'selected' : ''}`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <div className="project-icon">
                      <FaProjectDiagram />
                    </div>
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <p className="project-path">{project.directory}</p>
                      <p className="project-meta">
                        {formatFileSize(project.size)} • {formatDate(project.modified)}
                      </p>
                    </div>
                    <div className="project-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProject(project);
                        }}
                        className="action-button"
                        title="Open Project"
                      >
                        <FaFolder />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuildExecutable(project);
                        }}
                        className="action-button"
                        title="Build Executable"
                      >
                        <FaCube />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'hardware' && (
          <div className="hardware-section">
            <div className="section-header">
              <h2>Hardware Configuration</h2>
            </div>
            
            <div className="hardware-grid">
              <div className="hardware-card">
                <div className="hardware-icon">
                  <FaMicrochip />
                </div>
                <h3>DAQ Devices</h3>
                <p>Configure and manage data acquisition hardware</p>
                <button className="secondary-button">
                  Configure DAQ
                </button>
              </div>
              
              <div className="hardware-card">
                <div className="hardware-icon">
                  <FaNetworkWired />
                </div>
                <h3>Real-Time Targets</h3>
                <p>Deploy VIs to CompactRIO and PXI systems</p>
                <button className="secondary-button">
                  Manage Targets
                </button>
              </div>
              
              <div className="hardware-card">
                <div className="hardware-icon">
                  <FaServer />
                </div>
                <h3>FPGA Targets</h3>
                <p>Configure FPGA compilation and deployment</p>
                <button className="secondary-button">
                  FPGA Settings
                </button>
              </div>
              
              <div className="hardware-card">
                <div className="hardware-icon">
                  <FaFlask />
                </div>
                <h3>Instruments</h3>
                <p>Connect to oscilloscopes, DMMs, and other instruments</p>
                <button className="secondary-button">
                  Scan Instruments
                </button>
              </div>
            </div>
            
            <div className="server-controls">
              <h3>Server Configuration</h3>
              <div className="server-options">
                <div className="server-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.viServerEnabled}
                      onChange={handleToggleVIServer}
                    />
                    Enable VI Server
                  </label>
                  <span className="server-port">Port: {config.viServerPort}</span>
                </div>
                <div className="server-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.enableWebServices}
                      onChange={handleToggleWebService}
                    />
                    Enable Web Services
                  </label>
                  <span className="server-port">Port: {config.webServicePort}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="data-section">
            <div className="section-header">
              <h2>Data Management</h2>
              <div className="data-actions">
                <button 
                  onClick={handleExportData}
                  className="secondary-button"
                  disabled={!selectedVI}
                >
                  <FaDownload /> Export Data
                </button>
                <button 
                  onClick={handleImportData}
                  className="secondary-button"
                  disabled={!selectedVI}
                >
                  <FaUpload /> Import Data
                </button>
              </div>
            </div>
            
            <div className="data-tools">
              <div className="data-card">
                <div className="data-icon">
                  <FaChartLine />
                </div>
                <h3>Measurement Data</h3>
                <p>View and analyze measurement results</p>
                <div className="data-stats">
                  <div className="stat">
                    <span className="stat-label">Total Files:</span>
                    <span className="stat-value">0</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Storage Used:</span>
                    <span className="stat-value">0 MB</span>
                  </div>
                </div>
              </div>
              
              <div className="data-card">
                <div className="data-icon">
                  <FaDatabase />
                </div>
                <h3>Database Connectivity</h3>
                <p>Configure database connections for data logging</p>
                <button className="secondary-button">
                  Configure Database
                </button>
              </div>
            </div>
            
            {selectedVI && (
              <div className="selected-vi-info">
                <h3>Selected VI: {selectedVI.name}</h3>
                <p>Use the export and import buttons above to manage data for this VI.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New VI Modal */}
      {showNewVIModal && (
        <div className="modal-overlay" onClick={() => setShowNewVIModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New VI</h2>
              <button onClick={() => setShowNewVIModal(false)} className="close-button">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>VI Name</label>
                <input
                  type="text"
                  value={newVI.name}
                  onChange={(e) => setNewVI({ ...newVI, name: e.target.value })}
                  placeholder="MyVI.vi"
                />
              </div>
              <div className="form-group">
                <label>Template</label>
                <select
                  value={newVI.template}
                  onChange={(e) => setNewVI({ ...newVI, template: e.target.value })}
                >
                  <option value="blank">Blank VI</option>
                  <option value="state-machine">State Machine</option>
                  <option value="producer-consumer">Producer/Consumer</option>
                  <option value="event-driven">Event-Driven</option>
                  <option value="measurement">Measurement</option>
                  <option value="fpga">FPGA</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNewVIModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleCreateNewVI} className="save-button" disabled={!newVI.name}>
                Create VI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button onClick={() => setShowNewProjectModal(false)} className="close-button">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="MyProject"
                />
              </div>
              <div className="form-group">
                <label>Template</label>
                <select
                  value={newProject.template}
                  onChange={(e) => setNewProject({ ...newProject, template: e.target.value })}
                >
                  <option value="blank">Blank Project</option>
                  <option value="application">Application</option>
                  <option value="real-time">Real-Time</option>
                  <option value="fpga">FPGA</option>
                  <option value="test">Test System</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowNewProjectModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleCreateNewProject} className="save-button" disabled={!newProject.name}>
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>LabVIEW Configuration</h2>
              <button onClick={() => setShowConfigModal(false)} className="close-button">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>VI Path</label>
                <input
                  type="text"
                  value={config.viPath}
                  onChange={(e) => setConfig({ ...config, viPath: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Projects Path</label>
                <input
                  type="text"
                  value={config.projectsPath}
                  onChange={(e) => setConfig({ ...config, projectsPath: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Auto-Save Interval (seconds)</label>
                <input
                  type="number"
                  value={config.autoSaveInterval}
                  onChange={(e) => setConfig({ ...config, autoSaveInterval: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Web Service Port</label>
                <input
                  type="number"
                  value={config.webServicePort}
                  onChange={(e) => setConfig({ ...config, webServicePort: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>VI Server Port</label>
                <input
                  type="number"
                  value={config.viServerPort}
                  onChange={(e) => setConfig({ ...config, viServerPort: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Default Target Type</label>
                <select
                  value={config.defaultTargetType}
                  onChange={(e) => setConfig({ ...config, defaultTargetType: e.target.value })}
                >
                  <option value="myComputer">My Computer</option>
                  <option value="realTime">Real-Time Target</option>
                  <option value="fpga">FPGA Target</option>
                </select>
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={config.enableRemotePanel}
                    onChange={(e) => setConfig({ ...config, enableRemotePanel: e.target.checked })}
                  />
                  Enable Remote Panel by Default
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowConfigModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleUpdateConfig} className="save-button">
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabVIEWControlPage;