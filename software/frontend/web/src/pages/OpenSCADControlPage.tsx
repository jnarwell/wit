import React, { useState, useEffect } from 'react';
import { FaCube, FaFolder, FaPlus, FaDownload, FaCog, FaPlay, FaEye, FaSave, FaCode } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './OpenSCADControlPage.css';

interface OpenSCADProject {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modified: string;
  created: string;
}

interface OpenSCADVariable {
  name: string;
  defaultValue: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  min?: number;
  max?: number;
  step?: number;
  values?: string[];
  description?: string;
}

const OpenSCADControlPage: React.FC = () => {
  const { sendCommand, lastMessage } = useUDCWebSocket();
  const [status, setStatus] = useState<any>(null);
  const [projects, setProjects] = useState<OpenSCADProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<OpenSCADProject | null>(null);
  const [variables, setVariables] = useState<OpenSCADVariable[]>([]);
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'editor' | 'variables'>('projects');

  useEffect(() => {
    // Get initial status
    loadStatus();
    loadProjects();
  }, []);

  useEffect(() => {
    // Handle messages from the plugin
    if (lastMessage && lastMessage.type === 'plugin_response') {
      if (lastMessage.pluginId === 'openscad') {
        if (lastMessage.command === 'getStatus' && lastMessage.result) {
          setStatus(lastMessage.result);
        } else if (lastMessage.command === 'listProjects' && lastMessage.result) {
          setProjects(lastMessage.result);
        } else if (lastMessage.command === 'getVariables' && lastMessage.result) {
          setVariables(lastMessage.result.variables || []);
        }
      }
    }
  }, [lastMessage]);

  const loadStatus = async () => {
    try {
      await sendCommand('openscad', 'getStatus');
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  };

  const loadProjects = async () => {
    try {
      await sendCommand('openscad', 'listProjects');
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleLaunchOpenSCAD = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('openscad', 'launch');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewFile = async (template: string) => {
    const name = prompt('Enter file name:');
    if (!name) return;

    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('openscad', 'newFile', { name, template });
      await loadProjects();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (project: OpenSCADProject) => {
    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('openscad', 'openFile', { filePath: project.path });
      setSelectedProject(project);
      // Load variables if any
      await sendCommand('openscad', 'getVariables', { filePath: project.path });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRender = async (quality: 'preview' | 'render') => {
    if (!selectedProject) return;

    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('openscad', 'render', { 
        filePath: selectedProject.path, 
        quality 
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!selectedProject) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await sendCommand('openscad', 'export', { 
        filePath: selectedProject.path, 
        format 
      });
      if (result?.outputPath) {
        alert(`Exported to: ${result.outputPath}`);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateVariable = async (varName: string, value: any) => {
    if (!selectedProject) return;

    try {
      await sendCommand('openscad', 'updateVariables', {
        filePath: selectedProject.path,
        variables: { [varName]: value }
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleCompileCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await sendCommand('openscad', 'checkSyntax', { code });
      if (result?.valid) {
        alert('Syntax is valid!');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="openscad-control-page">
      <div className="page-header">
        <div className="header-info">
          <FaCube className="page-icon" />
          <div>
            <h1>OpenSCAD Control</h1>
            <p>The Programmers Solid 3D CAD Modeller</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={handleLaunchOpenSCAD} 
            className="launch-button"
            disabled={isLoading || !status?.installed}
          >
            <FaCube /> Launch OpenSCAD
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className={`status-value ${status?.installed ? 'active' : 'inactive'}`}>
            {status?.installed ? 'Installed' : 'Not Installed'}
          </span>
        </div>
        {status?.version && (
          <div className="status-item">
            <span className="status-label">Version:</span>
            <span className="status-value">{status.version}</span>
          </div>
        )}
        {status?.path && (
          <div className="status-item">
            <span className="status-label">Path:</span>
            <span className="status-value">{status.path}</span>
          </div>
        )}
      </div>

      <div className="control-tabs">
        <button 
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FaFolder /> Projects
        </button>
        <button 
          className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          <FaCode /> Code Editor
        </button>
        {selectedProject && (
          <button 
            className={`tab ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => setActiveTab('variables')}
          >
            <FaCog /> Variables
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'projects' && (
          <div className="projects-section">
            <div className="section-header">
              <h2>Projects</h2>
              <div className="project-actions">
                <button 
                  onClick={() => handleNewFile('basic')} 
                  className="action-button"
                >
                  <FaPlus /> New Basic
                </button>
                <button 
                  onClick={() => handleNewFile('parametric_box')} 
                  className="action-button"
                >
                  <FaPlus /> New Box
                </button>
                <button 
                  onClick={() => handleNewFile('gear')} 
                  className="action-button"
                >
                  <FaPlus /> New Gear
                </button>
              </div>
            </div>

            <div className="projects-grid">
              {projects.length === 0 ? (
                <div className="empty-state">
                  <FaFolder className="empty-icon" />
                  <p>No projects found</p>
                  <p className="hint">Create a new project to get started</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div 
                    key={project.path} 
                    className={`project-card ${selectedProject?.path === project.path ? 'selected' : ''}`}
                    onClick={() => handleOpenProject(project)}
                  >
                    <div className="project-icon">
                      <FaCube />
                    </div>
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <p className="project-path">{project.relativePath}</p>
                      <div className="project-meta">
                        <span>{formatFileSize(project.size)}</span>
                        <span>{new Date(project.modified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedProject && (
              <div className="project-controls">
                <h3>Project Actions</h3>
                <div className="control-buttons">
                  <button 
                    onClick={() => handleRender('preview')} 
                    className="control-button"
                  >
                    <FaEye /> Preview
                  </button>
                  <button 
                    onClick={() => handleRender('render')} 
                    className="control-button"
                  >
                    <FaPlay /> Render
                  </button>
                  <button 
                    onClick={() => handleExport('stl')} 
                    className="control-button"
                  >
                    <FaDownload /> Export STL
                  </button>
                  <button 
                    onClick={() => handleExport('dxf')} 
                    className="control-button"
                  >
                    <FaDownload /> Export DXF
                  </button>
                  <button 
                    onClick={() => handleExport('png')} 
                    className="control-button"
                  >
                    <FaSave /> Export PNG
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="editor-section">
            <div className="section-header">
              <h2>Code Editor</h2>
              <button 
                onClick={handleCompileCode} 
                className="action-button"
                disabled={!code || isLoading}
              >
                <FaPlay /> Check Syntax
              </button>
            </div>
            
            <textarea
              className="code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="// Enter OpenSCAD code here&#10;// Example:&#10;difference() {&#10;    cube([20, 20, 20]);&#10;    sphere(r=15);&#10;}"
              spellCheck={false}
            />
          </div>
        )}

        {activeTab === 'variables' && selectedProject && (
          <div className="variables-section">
            <div className="section-header">
              <h2>Customizable Variables</h2>
            </div>
            
            {variables.length === 0 ? (
              <div className="empty-state">
                <FaCog className="empty-icon" />
                <p>No customizable variables found</p>
                <p className="hint">Add parameters with comments like: diameter = 20; // [10:50]</p>
              </div>
            ) : (
              <div className="variables-list">
                {variables.map((variable) => (
                  <div key={variable.name} className="variable-control">
                    <label>{variable.name}</label>
                    {variable.type === 'number' && (
                      <input
                        type="range"
                        min={variable.min}
                        max={variable.max}
                        step={variable.step || 1}
                        defaultValue={variable.defaultValue}
                        onChange={(e) => handleUpdateVariable(variable.name, e.target.value)}
                      />
                    )}
                    {variable.type === 'text' && (
                      <input
                        type="text"
                        defaultValue={variable.defaultValue}
                        onChange={(e) => handleUpdateVariable(variable.name, e.target.value)}
                      />
                    )}
                    {variable.type === 'boolean' && (
                      <input
                        type="checkbox"
                        defaultChecked={variable.defaultValue === 'true'}
                        onChange={(e) => handleUpdateVariable(variable.name, e.target.checked)}
                      />
                    )}
                    {variable.type === 'select' && (
                      <select
                        defaultValue={variable.defaultValue}
                        onChange={(e) => handleUpdateVariable(variable.name, e.target.value)}
                      >
                        {variable.values?.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    )}
                    {variable.description && (
                      <p className="variable-description">{variable.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenSCADControlPage;