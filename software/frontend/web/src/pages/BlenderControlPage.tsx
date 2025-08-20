import React, { useState, useEffect } from 'react';
import { FaCubes, FaFolder, FaPlus, FaDownload, FaCog, FaPlay, FaEye, FaSave, FaCode, FaArrowLeft, FaRobot, FaBolt, FaCamera, FaSun } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './BlenderControlPage.css';

interface BlenderProject {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modified: string;
  created: string;
}

interface BlenderObject {
  name: string;
  type: string;
  location: number[];
  rotation: number[];
  scale: number[];
}

interface SceneInfo {
  objects: BlenderObject[];
  materials: string[];
  cameras: BlenderObject[];
  lights: BlenderObject[];
}

interface BlenderControlPageProps {
  onClose?: () => void;
}

const BlenderControlPage: React.FC<BlenderControlPageProps> = ({ onClose }) => {
  const { sendCommand, lastMessage, wsStatus } = useUDCWebSocket();
  const [status, setStatus] = useState<any>(null);
  const [projects, setProjects] = useState<BlenderProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<BlenderProject | null>(null);
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
  const [pythonCode, setPythonCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'scene' | 'ai-tools' | 'render'>('projects');
  const [isInitialized, setIsInitialized] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [renderSettings, setRenderSettings] = useState({
    engine: 'CYCLES',
    samples: 128,
    resolution: '1920x1080'
  });

  useEffect(() => {
    // Only load data when WebSocket is connected
    if (wsStatus === 'connected' && !isInitialized) {
      setIsInitialized(true);
      loadStatus();
      loadProjects();
    }
  }, [wsStatus, isInitialized]);

  useEffect(() => {
    // Handle messages from the plugin
    if (lastMessage && lastMessage.type === 'plugin_response') {
      if (lastMessage.pluginId === 'blender') {
        if (lastMessage.command === 'getStatus' && lastMessage.result) {
          setStatus(lastMessage.result);
        } else if (lastMessage.command === 'listProjects' && lastMessage.result) {
          setProjects(lastMessage.result);
        } else if (lastMessage.command === 'getSceneInfo' && lastMessage.result?.sceneInfo) {
          setSceneInfo(lastMessage.result.sceneInfo);
        }
      }
    }
  }, [lastMessage]);

  const loadStatus = async () => {
    if (wsStatus !== 'connected') {
      console.log('WebSocket not connected, skipping status load');
      return;
    }
    try {
      await sendCommand('blender', 'getStatus');
    } catch (error) {
      console.error('Failed to get status:', error);
      setError('Failed to get plugin status. Please check if Blender plugin is running.');
    }
  };

  const loadProjects = async () => {
    if (wsStatus !== 'connected') {
      console.log('WebSocket not connected, skipping projects load');
      return;
    }
    try {
      await sendCommand('blender', 'listProjects');
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load projects. Please check if Blender plugin is running.');
    }
  };

  const loadSceneInfo = async (projectPath?: string) => {
    if (wsStatus !== 'connected') return;
    
    try {
      await sendCommand('blender', 'getSceneInfo', { 
        filePath: projectPath 
      });
    } catch (error) {
      console.error('Failed to load scene info:', error);
    }
  };

  const handleLaunchBlender = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('blender', 'launch');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProject = async (template: string) => {
    const name = prompt('Enter project name:');
    if (!name) return;

    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('blender', 'newFile', { name, template });
      await loadProjects();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (project: BlenderProject) => {
    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('blender', 'openFile', { filePath: project.path });
      setSelectedProject(project);
      await loadSceneInfo(project.path);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecutePython = async () => {
    if (!pythonCode.trim()) {
      setError('Please enter Python code to execute');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await sendCommand('blender', 'executeScript', { 
        script: pythonCode,
        filePath: selectedProject?.path 
      });
      
      if (result.success) {
        console.log('Script executed successfully:', result.output);
        // Refresh scene info after script execution
        await loadSceneInfo(selectedProject?.path);
      } else {
        setError(`Script failed: ${result.message}`);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter an AI prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // This would integrate with the AI terminal in a real implementation
    // For now, we'll generate some example Python code based on common prompts
    try {
      let generatedCode = '';
      
      if (aiPrompt.toLowerCase().includes('cube')) {
        generatedCode = `import bpy
import sys
sys.path.append("${status?.pythonScriptsPath || ''}")
from wit_ai_helper import create_primitive

# Create a cube as requested
result = create_primitive("cube", location=(0, 0, 0), scale=(1, 1, 1))
print(f"Created: {result}")`;
      } else if (aiPrompt.toLowerCase().includes('material')) {
        generatedCode = `import bpy
import sys
sys.path.append("${status?.pythonScriptsPath || ''}")
from wit_ai_helper import create_material

# Create a new material
material_name = create_material("AI_Material", color=(0.8, 0.2, 0.2, 1.0), metallic=0.3, roughness=0.4)
print(f"Created material: {material_name}")`;
      } else if (aiPrompt.toLowerCase().includes('render')) {
        generatedCode = `import bpy
import sys
sys.path.append("${status?.pythonScriptsPath || ''}")
from wit_ai_helper import setup_render, render_image

# Setup render settings
setup_render(engine="CYCLES", samples=128, resolution=(1920, 1080))

# Render the scene
output_path = "${status?.projectsPath || ''}/render_output.png"
render_image(output_path)
print(f"Rendered to: {output_path}")`;
      } else {
        generatedCode = `# AI-generated code for: ${aiPrompt}
import bpy

# Add your custom implementation here
print("AI code generation completed")`;
      }
      
      setPythonCode(generatedCode);
      setActiveTab('scene'); // Switch to scene tab to show the code
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRender = async () => {
    if (!selectedProject) {
      setError('Please open a project first');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [width, height] = renderSettings.resolution.split('x').map(Number);
      const result = await sendCommand('blender', 'render', {
        filePath: selectedProject.path,
        engine: renderSettings.engine,
        samples: renderSettings.samples,
        resolution: [width, height],
        outputPath: `${status?.projectsPath}/renders/${selectedProject.name}_render.png`
      });

      if (result.success) {
        console.log('Render completed:', result.outputPath);
      } else {
        setError(result.message);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string, params: any = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      await sendCommand('blender', action, params);
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

  // Show loading state while WebSocket is connecting
  if (wsStatus === 'connecting' || wsStatus === 'disconnected') {
    return (
      <div className="blender-control-page">
        <div className="page-header">
          <div className="header-info">
            {onClose && (
              <button onClick={onClose} className="back-button">
                <FaArrowLeft />
              </button>
            )}
            <FaCubes className="page-icon" />
            <div>
              <h1>Blender Control</h1>
              <p>Connecting to desktop controller...</p>
            </div>
          </div>
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

  // Show error state if WebSocket failed
  if (wsStatus === 'failed') {
    return (
      <div className="blender-control-page">
        <div className="page-header">
          <div className="header-info">
            {onClose && (
              <button onClick={onClose} className="back-button">
                <FaArrowLeft />
              </button>
            )}
            <FaCubes className="page-icon" />
            <div>
              <h1>Blender Control</h1>
              <p>Connection failed</p>
            </div>
          </div>
        </div>
        <div className="error-message">
          <p>Failed to connect to desktop controller. Please ensure the Universal Desktop Controller is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="blender-control-page">
      <div className="page-header">
        <div className="header-info">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft />
            </button>
          )}
          <FaCubes className="page-icon" />
          <div>
            <h1>Blender Control</h1>
            <p>AI-powered 3D modeling, animation, and rendering</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={handleLaunchBlender} 
            className="launch-button"
            disabled={isLoading || !status?.installed}
          >
            <FaCubes /> Launch Blender
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
        {status?.aiEnabled && (
          <div className="status-item">
            <span className="status-label">AI Integration:</span>
            <span className="status-value active">Enabled</span>
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
          className={`tab ${activeTab === 'scene' ? 'active' : ''}`}
          onClick={() => setActiveTab('scene')}
        >
          <FaCode /> Scene & Scripts
        </button>
        <button 
          className={`tab ${activeTab === 'ai-tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-tools')}
        >
          <FaRobot /> AI Tools
        </button>
        <button 
          className={`tab ${activeTab === 'render' ? 'active' : ''}`}
          onClick={() => setActiveTab('render')}
        >
          <FaCamera /> Render
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'projects' && (
          <div className="projects-section">
            <div className="section-header">
              <h2>Projects</h2>
              <div className="project-actions">
                <button 
                  onClick={() => handleNewProject('basic')} 
                  className="action-button"
                >
                  <FaPlus /> Basic Scene
                </button>
                <button 
                  onClick={() => handleNewProject('product_viz')} 
                  className="action-button"
                >
                  <FaPlus /> Product Viz
                </button>
                <button 
                  onClick={() => handleNewProject('character')} 
                  className="action-button"
                >
                  <FaPlus /> Character
                </button>
                <button 
                  onClick={() => handleNewProject('architectural')} 
                  className="action-button"
                >
                  <FaPlus /> Architectural
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
                      <FaCubes />
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
          </div>
        )}

        {activeTab === 'scene' && (
          <div className="scene-section">
            <div className="section-header">
              <h2>Scene Information & Python Scripts</h2>
              <button 
                onClick={() => loadSceneInfo(selectedProject?.path)}
                className="action-button"
                disabled={!selectedProject}
              >
                <FaEye /> Refresh Scene
              </button>
            </div>

            {sceneInfo && (
              <div className="scene-info-grid">
                <div className="info-card">
                  <h3>Objects ({sceneInfo.objects.length})</h3>
                  <div className="info-list">
                    {sceneInfo.objects.map((obj, idx) => (
                      <div key={idx} className="info-item">
                        <span className="item-name">{obj.name}</span>
                        <span className="item-type">{obj.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-card">
                  <h3>Materials ({sceneInfo.materials.length})</h3>
                  <div className="info-list">
                    {sceneInfo.materials.map((material, idx) => (
                      <div key={idx} className="info-item">
                        <span className="item-name">{material}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-card">
                  <h3>Cameras ({sceneInfo.cameras.length})</h3>
                  <div className="info-list">
                    {sceneInfo.cameras.map((camera, idx) => (
                      <div key={idx} className="info-item">
                        <span className="item-name">{camera.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-card">
                  <h3>Lights ({sceneInfo.lights.length})</h3>
                  <div className="info-list">
                    {sceneInfo.lights.map((light, idx) => (
                      <div key={idx} className="info-item">
                        <span className="item-name">{light.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="python-editor">
              <div className="editor-header">
                <h3>Python Script Editor</h3>
                <button 
                  onClick={handleExecutePython}
                  className="execute-button"
                  disabled={!pythonCode.trim() || isLoading}
                >
                  <FaPlay /> Execute Script
                </button>
              </div>
              
              <textarea
                className="code-editor"
                value={pythonCode}
                onChange={(e) => setPythonCode(e.target.value)}
                placeholder="# Enter Blender Python code here
import bpy

# Example: Create a cube
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))

# Example: Get selected objects
selected = bpy.context.selected_objects
print(f'Selected objects: {[obj.name for obj in selected]}')"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {activeTab === 'ai-tools' && (
          <div className="ai-tools-section">
            <div className="section-header">
              <h2>AI-Powered 3D Tools</h2>
            </div>

            <div className="ai-prompt-section">
              <div className="prompt-input-group">
                <textarea
                  className="ai-prompt-input"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to create or modify in your 3D scene...
Examples:
• 'Create a red metallic sphere at position 2,0,1'
• 'Add studio lighting to the scene'
• 'Generate a procedural material for wood'
• 'Create a gear with 20 teeth'
• 'Set up camera for product photography'"
                  rows={4}
                />
                <button 
                  onClick={handleAIGenerate}
                  className="ai-generate-button"
                  disabled={!aiPrompt.trim() || isLoading}
                >
                  <FaRobot /> Generate Code
                </button>
              </div>
            </div>

            <div className="ai-quick-actions">
              <h3>Quick AI Actions</h3>
              <div className="quick-actions-grid">
                <button 
                  onClick={() => handleQuickAction('setupLighting', { style: 'studio' })}
                  className="quick-action-button"
                >
                  <FaSun /> Studio Lighting
                </button>
                <button 
                  onClick={() => handleQuickAction('setupLighting', { style: 'natural' })}
                  className="quick-action-button"
                >
                  <FaSun /> Natural Light
                </button>
                <button 
                  onClick={() => handleQuickAction('createObject', { type: 'sphere', location: [0, 0, 1] })}
                  className="quick-action-button"
                >
                  <FaCubes /> Add Sphere
                </button>
                <button 
                  onClick={() => handleQuickAction('createObject', { type: 'cylinder', location: [2, 0, 1] })}
                  className="quick-action-button"
                >
                  <FaCubes /> Add Cylinder
                </button>
              </div>
            </div>

            <div className="ai-templates">
              <h3>AI Scene Templates</h3>
              <div className="template-grid">
                <div className="template-card" onClick={() => setAiPrompt('Create a product visualization scene with professional lighting and camera setup')}>
                  <h4>Product Showcase</h4>
                  <p>Professional product photography setup</p>
                </div>
                <div className="template-card" onClick={() => setAiPrompt('Generate a mechanical assembly with gears, shafts, and bearings')}>
                  <h4>Mechanical Assembly</h4>
                  <p>Engineering parts and assemblies</p>
                </div>
                <div className="template-card" onClick={() => setAiPrompt('Create an architectural interior with furniture and lighting')}>
                  <h4>Architectural Interior</h4>
                  <p>Room design with furniture and decor</p>
                </div>
                <div className="template-card" onClick={() => setAiPrompt('Generate abstract art with procedural materials and interesting geometry')}>
                  <h4>Abstract Art</h4>
                  <p>Artistic and creative compositions</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'render' && (
          <div className="render-section">
            <div className="section-header">
              <h2>Render Settings</h2>
              <button 
                onClick={handleRender}
                className="render-button"
                disabled={!selectedProject || isLoading}
              >
                <FaCamera /> Render Scene
              </button>
            </div>

            <div className="render-settings">
              <div className="setting-group">
                <label>Render Engine</label>
                <select 
                  value={renderSettings.engine}
                  onChange={(e) => setRenderSettings({...renderSettings, engine: e.target.value})}
                >
                  <option value="CYCLES">Cycles (Realistic)</option>
                  <option value="EEVEE">Eevee (Fast)</option>
                  <option value="WORKBENCH">Workbench (Preview)</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Samples</label>
                <input
                  type="number"
                  value={renderSettings.samples}
                  onChange={(e) => setRenderSettings({...renderSettings, samples: parseInt(e.target.value)})}
                  min="1"
                  max="4096"
                />
              </div>

              <div className="setting-group">
                <label>Resolution</label>
                <select 
                  value={renderSettings.resolution}
                  onChange={(e) => setRenderSettings({...renderSettings, resolution: e.target.value})}
                >
                  <option value="640x480">640×480 (Preview)</option>
                  <option value="1280x720">1280×720 (HD)</option>
                  <option value="1920x1080">1920×1080 (Full HD)</option>
                  <option value="3840x2160">3840×2160 (4K)</option>
                </select>
              </div>
            </div>

            <div className="render-presets">
              <h3>Quick Presets</h3>
              <div className="preset-buttons">
                <button 
                  onClick={() => setRenderSettings({ engine: 'CYCLES', samples: 32, resolution: '640x480' })}
                  className="preset-button"
                >
                  <FaBolt /> Fast Preview
                </button>
                <button 
                  onClick={() => setRenderSettings({ engine: 'CYCLES', samples: 128, resolution: '1920x1080' })}
                  className="preset-button"
                >
                  <FaCamera /> Standard Quality
                </button>
                <button 
                  onClick={() => setRenderSettings({ engine: 'CYCLES', samples: 256, resolution: '3840x2160' })}
                  className="preset-button"
                >
                  <FaSave /> High Quality
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlenderControlPage;