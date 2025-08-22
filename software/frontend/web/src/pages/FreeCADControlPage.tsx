import React, { useState, useEffect } from 'react';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './FreeCADControlPage.css';

interface FreeCADControlPageProps {
  onClose: () => void;
}

interface Project {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modified: string;
  created: string;
}

interface FreeCADStatus {
  initialized: boolean;
  started: boolean;
  installed: boolean;
  path: string | null;
  cmdPath: string | null;
  version: string;
  projectsPath: string;
  activeProcesses: number;
  watchedFiles: number;
  recentProjects: Project[];
  supportedFormats: string[];
  aiEnabled: boolean;
  defaultWorkbench: string;
  pythonScriptsPath: string;
}

interface DocumentInfo {
  name: string;
  objects: Array<{
    name: string;
    type: string;
    label: string;
    volume?: number;
    area?: number;
    boundingBox?: {
      length: number;
      width: number;
      height: number;
    };
  }>;
  materials: any[];
  assemblies: any[];
}

const FreeCADControlPage: React.FC<FreeCADControlPageProps> = ({ onClose }) => {
  const { sendCommand, lastMessage, wsStatus } = useUDCWebSocket();
  const [activeTab, setActiveTab] = useState<'projects' | 'modeling' | 'ai' | 'analysis'>('projects');
  const [status, setStatus] = useState<FreeCADStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Modeling state
  const [aiPrompt, setAiPrompt] = useState('');
  const [pythonCode, setPythonCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Primitive creation state
  const [primitiveType, setPrimitiveType] = useState<'box' | 'cylinder' | 'gear'>('box');
  const [primitiveParams, setPrimitiveParams] = useState({
    length: 10,
    width: 10,
    height: 10,
    radius: 5,
    cylHeight: 10,
    teeth: 20,
    module: 1.0,
    name: ''
  });

  // Export state
  const [exportObject, setExportObject] = useState('');
  const [exportFormat, setExportFormat] = useState('step');
  const [exportPath, setExportPath] = useState('');

  // Template state
  const [templateType, setTemplateType] = useState<'mechanical' | 'assembly' | 'sheet_metal' | 'architectural'>('mechanical');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (wsStatus === 'connected' && !isInitialized) {
      setIsInitialized(true);
      loadStatus();
      loadProjects();
    }
  }, [wsStatus, isInitialized]);

  useEffect(() => {
    if (lastMessage?.type === 'plugin_response' && lastMessage?.plugin === 'freecad') {
      setLoading(false);
      
      const { command, success, data, message } = lastMessage;
      
      if (!success) {
        setError(message || 'Command failed');
        return;
      }

      switch (command) {
        case 'getStatus':
          setStatus(data);
          break;
        case 'listProjects':
          setProjects(data || []);
          break;
        case 'getDocumentInfo':
          if (data?.documentInfo) {
            setDocumentInfo(data.documentInfo);
          }
          break;
        case 'executeScript':
          if (command === 'executeScript' && data?.output) {
            console.log('Script output:', data.output);
          }
          break;
      }
    }
  }, [lastMessage]);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'getStatus');
    } catch (error) {
      setError('Failed to get FreeCAD status');
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      await sendCommand('freecad', 'listProjects');
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const launchFreeCAD = async (filePath?: string) => {
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'launch', filePath ? { filePath } : {});
    } catch (error) {
      setError('Failed to launch FreeCAD');
      setLoading(false);
    }
  };

  const openProject = async (project: Project) => {
    await launchFreeCAD(project.path);
  };

  const createNewProject = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'newFile', {
        template: templateType,
        name: projectName
      });
      setProjectName('');
      loadProjects();
    } catch (error) {
      setError('Failed to create new project');
      setLoading(false);
    }
  };

  const createPrimitive = async () => {
    setLoading(true);
    setError(null);
    try {
      const dimensions: any = {};
      
      switch (primitiveType) {
        case 'box':
          dimensions.length = primitiveParams.length;
          dimensions.width = primitiveParams.width;
          dimensions.height = primitiveParams.height;
          break;
        case 'cylinder':
          dimensions.radius = primitiveParams.radius;
          dimensions.cylHeight = primitiveParams.cylHeight;
          break;
        case 'gear':
          dimensions.teeth = primitiveParams.teeth;
          dimensions.module = primitiveParams.module;
          break;
      }
      
      await sendCommand('freecad', 'createPrimitive', {
        type: primitiveType,
        dimensions,
        name: primitiveParams.name || primitiveType.charAt(0).toUpperCase() + primitiveType.slice(1)
      });
    } catch (error) {
      setError('Failed to create primitive');
      setLoading(false);
    }
  };

  const executeScript = async () => {
    if (!pythonCode.trim()) {
      setError('Please enter Python code to execute');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'executeScript', {
        script: pythonCode
      });
    } catch (error) {
      setError('Failed to execute script');
      setLoading(false);
    }
  };

  const generateAICode = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter an AI prompt');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    // Simple AI code generation based on prompt keywords
    let generatedCode = '';
    const prompt = aiPrompt.toLowerCase();
    
    if (prompt.includes('box') || prompt.includes('cube')) {
      const size = prompt.match(/(\d+)\s*mm/) ? prompt.match(/(\d+)\s*mm/)?.[1] : '20';
      generatedCode = `import sys
sys.path.append("~/Documents/FreeCAD/Scripts")
from wit_ai_helper import create_parametric_box

# Create ${aiPrompt}
result = create_parametric_box(${size}, ${size}, ${size}, "AI_Box")
print(f"Created box: {result}")`;
    } else if (prompt.includes('cylinder') || prompt.includes('pipe')) {
      generatedCode = `import sys
sys.path.append("~/Documents/FreeCAD/Scripts")
from wit_ai_helper import create_cylinder

# Create ${aiPrompt}
result = create_cylinder(10, 20, "AI_Cylinder")
print(f"Created cylinder: {result}")`;
    } else if (prompt.includes('gear')) {
      const teeth = prompt.match(/(\d+)\s*teeth/) ? prompt.match(/(\d+)\s*teeth/)?.[1] : '20';
      generatedCode = `import sys
sys.path.append("~/Documents/FreeCAD/Scripts")
from wit_ai_helper import create_gear

# Create ${aiPrompt}
result = create_gear(${teeth}, 1.0, name="AI_Gear")
print(f"Created gear: {result}")`;
    } else if (prompt.includes('bracket')) {
      generatedCode = `import FreeCAD
import Part
import PartDesign
import Sketcher

# Create ${aiPrompt}
doc = FreeCAD.newDocument("Bracket")
body = doc.addObject('PartDesign::Body', 'BracketBody')

# Create base sketch
sketch = doc.addObject('Sketcher::SketchObject', 'BaseSketch')
body.addObject(sketch)
sketch.Support = (doc.getObject("XY_Plane"), [""])
sketch.MapMode = "FlatFace"

# Add bracket geometry
sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(50, 0, 0)), False)
sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(50, 0, 0), FreeCAD.Vector(50, 30, 0)), False)
sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(50, 30, 0), FreeCAD.Vector(0, 30, 0)), False)
sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(0, 30, 0), FreeCAD.Vector(0, 0, 0)), False)

# Create pad
pad = doc.addObject("PartDesign::Pad", "BracketPad")
body.addObject(pad)
pad.Profile = sketch
pad.Length = 5

doc.recompute()
print("Created parametric bracket")`;
    } else {
      generatedCode = `# ${aiPrompt}
import FreeCAD
import Part

# Create a simple shape for your request
doc = FreeCAD.newDocument("AI_Design")
box = doc.addObject("Part::Box", "Shape")
box.Length = 20
box.Width = 20
box.Height = 20

doc.recompute()
print("Created basic shape - modify as needed")`;
    }
    
    setPythonCode(generatedCode);
    setIsGenerating(false);
  };

  const exportModel = async () => {
    if (!exportObject.trim()) {
      setError('Please enter object name to export');
      return;
    }
    
    if (!exportPath.trim()) {
      setError('Please enter export file path');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'exportModel', {
        objectName: exportObject,
        filePath: exportPath,
        format: exportFormat
      });
    } catch (error) {
      setError('Failed to export model');
      setLoading(false);
    }
  };

  const loadDocumentInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendCommand('freecad', 'getDocumentInfo');
    } catch (error) {
      setError('Failed to get document info');
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (wsStatus !== 'connected') {
    return (
      <div className="freecad-control-page">
        <div className="page-header">
          <h1>FreeCAD Control</h1>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        <div className="connection-status">
          <p>Connecting to W.I.T. Universal Desktop Controller...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="freecad-control-page">
      <div className="page-header">
        <h1>FreeCAD Control</h1>
        <button onClick={onClose} className="close-button">✕</button>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="status-bar">
        {status ? (
          <>
            <span className={`status-indicator ${status.installed ? 'connected' : 'disconnected'}`}>
              {status.installed ? '🟢' : '🔴'}
            </span>
            <span>
              FreeCAD {status.version} 
              {status.installed && ` - ${status.activeProcesses} active processes`}
            </span>
            {status.aiEnabled && <span className="ai-badge">🤖 AI Enabled</span>}
          </>
        ) : (
          <span>Loading status...</span>
        )}
        <button onClick={loadStatus} className="refresh-button" disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div className="tab-container">
        <div className="tab-buttons">
          <button 
            className={activeTab === 'projects' ? 'active' : ''} 
            onClick={() => setActiveTab('projects')}
          >
            📁 Projects
          </button>
          <button 
            className={activeTab === 'modeling' ? 'active' : ''} 
            onClick={() => setActiveTab('modeling')}
          >
            🎯 Modeling
          </button>
          <button 
            className={activeTab === 'ai' ? 'active' : ''} 
            onClick={() => setActiveTab('ai')}
          >
            🤖 AI Tools
          </button>
          <button 
            className={activeTab === 'analysis' ? 'active' : ''} 
            onClick={() => setActiveTab('analysis')}
          >
            📊 Analysis
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'projects' && (
            <div className="projects-tab">
              <div className="action-section">
                <h3>Create New Project</h3>
                <div className="form-row">
                  <select 
                    value={templateType} 
                    onChange={(e) => setTemplateType(e.target.value as any)}
                  >
                    <option value="mechanical">Mechanical Part</option>
                    <option value="assembly">Assembly</option>
                    <option value="sheet_metal">Sheet Metal</option>
                    <option value="architectural">Architectural</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                  <button onClick={createNewProject} disabled={loading}>
                    ➕ Create
                  </button>
                </div>
              </div>

              <div className="action-section">
                <h3>Recent Projects</h3>
                <div className="projects-list">
                  {projects.length > 0 ? (
                    projects.map((project, index) => (
                      <div key={index} className="project-item">
                        <div className="project-info">
                          <h4>{project.name}</h4>
                          <p>Modified: {formatDate(project.modified)}</p>
                          <p>Size: {formatBytes(project.size)}</p>
                        </div>
                        <button onClick={() => openProject(project)} disabled={loading}>
                          📂 Open
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No projects found. Create a new project to get started!</p>
                  )}
                </div>
              </div>

              <div className="action-section">
                <button onClick={() => launchFreeCAD()} disabled={loading}>
                  🚀 Launch FreeCAD
                </button>
              </div>
            </div>
          )}

          {activeTab === 'modeling' && (
            <div className="modeling-tab">
              <div className="action-section">
                <h3>Create Primitives</h3>
                <div className="form-row">
                  <select 
                    value={primitiveType} 
                    onChange={(e) => setPrimitiveType(e.target.value as any)}
                  >
                    <option value="box">Box</option>
                    <option value="cylinder">Cylinder</option>
                    <option value="gear">Gear</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Object name (optional)"
                    value={primitiveParams.name}
                    onChange={(e) => setPrimitiveParams({...primitiveParams, name: e.target.value})}
                  />
                </div>

                {primitiveType === 'box' && (
                  <div className="parameters-grid">
                    <div>
                      <label>Length:</label>
                      <input
                        type="number"
                        value={primitiveParams.length}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, length: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label>Width:</label>
                      <input
                        type="number"
                        value={primitiveParams.width}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, width: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label>Height:</label>
                      <input
                        type="number"
                        value={primitiveParams.height}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, height: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                )}

                {primitiveType === 'cylinder' && (
                  <div className="parameters-grid">
                    <div>
                      <label>Radius:</label>
                      <input
                        type="number"
                        value={primitiveParams.radius}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, radius: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label>Height:</label>
                      <input
                        type="number"
                        value={primitiveParams.cylHeight}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, cylHeight: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                )}

                {primitiveType === 'gear' && (
                  <div className="parameters-grid">
                    <div>
                      <label>Teeth:</label>
                      <input
                        type="number"
                        value={primitiveParams.teeth}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, teeth: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label>Module:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={primitiveParams.module}
                        onChange={(e) => setPrimitiveParams({...primitiveParams, module: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                )}

                <button onClick={createPrimitive} disabled={loading}>
                  ➕ Create {primitiveType.charAt(0).toUpperCase() + primitiveType.slice(1)}
                </button>
              </div>

              <div className="action-section">
                <h3>Export Model</h3>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Object name"
                    value={exportObject}
                    onChange={(e) => setExportObject(e.target.value)}
                  />
                  <select 
                    value={exportFormat} 
                    onChange={(e) => setExportFormat(e.target.value)}
                  >
                    <option value="step">STEP (.step)</option>
                    <option value="iges">IGES (.iges)</option>
                    <option value="stl">STL (.stl)</option>
                    <option value="obj">OBJ (.obj)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Export file path (e.g., ~/Desktop/model.step)"
                  value={exportPath}
                  onChange={(e) => setExportPath(e.target.value)}
                  className="full-width"
                />
                <button onClick={exportModel} disabled={loading}>
                  💾 Export
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="ai-tab">
              <div className="action-section">
                <h3>AI-Powered Design</h3>
                <textarea
                  placeholder="Describe what you want to create (e.g., 'Create a 50mm cube', 'Make a gear with 24 teeth', 'Design a mounting bracket')"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                />
                <button onClick={generateAICode} disabled={isGenerating}>
                  {isGenerating ? '🤖 Generating...' : '🤖 Generate Code'}
                </button>
              </div>

              <div className="action-section">
                <h3>Python Script Editor</h3>
                <textarea
                  placeholder="Enter FreeCAD Python code here..."
                  value={pythonCode}
                  onChange={(e) => setPythonCode(e.target.value)}
                  rows={15}
                  className="code-editor"
                />
                <button onClick={executeScript} disabled={loading}>
                  ▶️ Execute Script
                </button>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="analysis-tab">
              <div className="action-section">
                <h3>Document Information</h3>
                <button onClick={loadDocumentInfo} disabled={loading}>
                  📊 Load Document Info
                </button>
                
                {documentInfo && (
                  <div className="document-info">
                    <h4>Document: {documentInfo.name}</h4>
                    <div className="objects-list">
                      <h5>Objects ({documentInfo.objects.length}):</h5>
                      {documentInfo.objects.map((obj, index) => (
                        <div key={index} className="object-item">
                          <strong>{obj.label || obj.name}</strong>
                          <span className="object-type">{obj.type}</span>
                          {obj.volume && <span>Volume: {obj.volume.toFixed(2)} mm³</span>}
                          {obj.boundingBox && (
                            <span>
                              Size: {obj.boundingBox.length.toFixed(1)} × {obj.boundingBox.width.toFixed(1)} × {obj.boundingBox.height.toFixed(1)} mm
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="action-section">
                <h3>Status Information</h3>
                {status && (
                  <div className="status-details">
                    <div className="status-grid">
                      <div><strong>Installation:</strong> {status.installed ? 'Installed' : 'Not Found'}</div>
                      <div><strong>Version:</strong> {status.version}</div>
                      <div><strong>Path:</strong> {status.path || 'Not found'}</div>
                      <div><strong>Command Line:</strong> {status.cmdPath || 'Not available'}</div>
                      <div><strong>Projects Path:</strong> {status.projectsPath}</div>
                      <div><strong>Scripts Path:</strong> {status.pythonScriptsPath}</div>
                      <div><strong>Default Workbench:</strong> {status.defaultWorkbench}</div>
                      <div><strong>Supported Formats:</strong> {status.supportedFormats?.join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">⏳ Processing...</div>
        </div>
      )}
    </div>
  );
};

export default FreeCADControlPage;