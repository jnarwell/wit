import React, { useState } from 'react';
import './FunctionPage.css';
import { FaCube, FaImage, FaCalculator, FaChartLine, FaRobot, FaTools, FaCode, FaPalette, FaPlay, FaStop, FaExpand } from 'react-icons/fa';
import Simple3DViewer from './tools/Simple3DViewer';

interface FunctionTool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'modeling' | 'visualization' | 'analysis' | 'automation' | 'utilities';
  status: 'available' | 'beta' | 'coming-soon';
  version?: string;
}

const FunctionPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<FunctionTool | null>(null);

  const tools: FunctionTool[] = [
    // 3D Modeling Tools
    {
      id: 'cad-modeler',
      name: 'WIT CAD Modeler',
      description: 'Professional 3D modeling tool for designing parts and assemblies. Features parametric design, STL export, and direct integration with 3D printers.',
      icon: <FaCube />,
      category: 'modeling',
      status: 'available',
      version: '2.1.0'
    },
    {
      id: 'wit-slicer',
      name: 'WIT Slicer',
      description: 'Advanced 3D printing slicer with AI-powered support generation, multi-material support, and direct printer integration. Optimized for workshop environments.',
      icon: <FaCube />,
      category: 'modeling',
      status: 'available',
      version: '3.0.0'
    },
    {
      id: 'mesh-editor',
      name: 'Mesh Editor',
      description: 'Edit and repair STL files, reduce polygon count, and prepare models for 3D printing.',
      icon: <FaCube style={{ transform: 'rotate(45deg)' }} />,
      category: 'modeling',
      status: 'available',
      version: '1.5.0'
    },
    
    // Visualization Tools
    {
      id: 'image-analyzer',
      name: 'Image Analyzer',
      description: 'Advanced image processing and analysis tool. Measure dimensions, detect edges, and extract data from technical drawings.',
      icon: <FaImage />,
      category: 'visualization',
      status: 'available',
      version: '1.3.0'
    },
    {
      id: 'data-visualizer',
      name: 'Data Visualizer',
      description: 'Create interactive charts and graphs from sensor data, machine logs, and project metrics.',
      icon: <FaChartLine />,
      category: 'visualization',
      status: 'available',
      version: '1.8.0'
    },
    
    // Analysis Tools
    {
      id: 'gcode-simulator',
      name: 'G-Code Simulator',
      description: 'Simulate and visualize G-code before sending to machines. Estimate print time and material usage.',
      icon: <FaCode />,
      category: 'analysis',
      status: 'available',
      version: '2.0.0'
    },
    {
      id: 'stress-analyzer',
      name: 'Stress Analyzer',
      description: 'Perform basic finite element analysis on 3D models to identify weak points and optimize designs.',
      icon: <FaCalculator />,
      category: 'analysis',
      status: 'beta',
      version: '0.9.0'
    },
    
    // Automation Tools
    {
      id: 'workflow-builder',
      name: 'Workflow Builder',
      description: 'Create automated workflows for repetitive tasks. Connect machines, sensors, and software tools.',
      icon: <FaRobot />,
      category: 'automation',
      status: 'available',
      version: '1.6.0'
    },
    {
      id: 'script-runner',
      name: 'Script Runner',
      description: 'Run custom Python and JavaScript scripts for data processing, machine control, and automation.',
      icon: <FaCode />,
      category: 'automation',
      status: 'available',
      version: '1.2.0'
    },
    
    // Utilities
    {
      id: 'material-calculator',
      name: 'Material Calculator',
      description: 'Calculate material requirements, costs, and cutting lists for projects.',
      icon: <FaCalculator />,
      category: 'utilities',
      status: 'available',
      version: '1.4.0'
    },
    {
      id: 'color-matcher',
      name: 'Color Matcher',
      description: 'Match paint colors, filament colors, and material finishes using camera or color codes.',
      icon: <FaPalette />,
      category: 'utilities',
      status: 'beta',
      version: '0.8.0'
    },
    {
      id: 'toolpath-optimizer',
      name: 'Toolpath Optimizer',
      description: 'Optimize CNC and laser cutting paths to reduce machine time and material waste.',
      icon: <FaTools />,
      category: 'utilities',
      status: 'coming-soon'
    }
  ];

  const categories = [
    { id: 'all', name: 'All Tools', icon: <FaTools /> },
    { id: 'modeling', name: '3D Modeling', icon: <FaCube /> },
    { id: 'visualization', name: 'Visualization', icon: <FaImage /> },
    { id: 'analysis', name: 'Analysis', icon: <FaCalculator /> },
    { id: 'automation', name: 'Automation', icon: <FaRobot /> },
    { id: 'utilities', name: 'Utilities', icon: <FaTools /> }
  ];

  const filteredTools = selectedCategory === 'all' 
    ? tools 
    : tools.filter(tool => tool.category === selectedCategory);

  const launchTool = (tool: FunctionTool) => {
    if (tool.status === 'coming-soon') {
      alert('This tool is coming soon!');
      return;
    }
    setSelectedTool(tool);
    // In a real implementation, this would launch the actual tool
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="status-badge available">Available</span>;
      case 'beta':
        return <span className="status-badge beta">Beta</span>;
      case 'coming-soon':
        return <span className="status-badge coming-soon">Coming Soon</span>;
      default:
        return null;
    }
  };

  return (
    <div className="function-page">
      <div className="function-header">
        <h1>WIT Functions</h1>
        <p>Custom tools and capabilities built for your workshop</p>
      </div>

      <div className="function-categories">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.icon}
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      <div className="function-tools-grid">
        {filteredTools.map(tool => (
          <div 
            key={tool.id} 
            className={`function-tool-card ${tool.status === 'coming-soon' ? 'coming-soon' : ''}`}
            onClick={() => launchTool(tool)}
          >
            <div className="tool-header">
              <div className="tool-icon">{tool.icon}</div>
              {getStatusBadge(tool.status)}
            </div>
            <h3>{tool.name}</h3>
            {tool.version && tool.status !== 'coming-soon' && (
              <span className="tool-version">v{tool.version}</span>
            )}
            <p>{tool.description}</p>
            <button className="launch-button" disabled={tool.status === 'coming-soon'}>
              {tool.status === 'coming-soon' ? 'Coming Soon' : 'Launch Tool'}
            </button>
          </div>
        ))}
      </div>

      {/* Tool Window Modal */}
      {selectedTool && (
        <div className="tool-window-overlay" onClick={() => setSelectedTool(null)}>
          <div className="tool-window" onClick={(e) => e.stopPropagation()}>
            <div className="tool-window-header">
              <div className="tool-window-title">
                {selectedTool.icon}
                <span>{selectedTool.name}</span>
              </div>
              <div className="tool-window-controls">
                <button className="tool-control" title="Minimize">
                  <span>−</span>
                </button>
                <button className="tool-control" title="Maximize">
                  <FaExpand />
                </button>
                <button className="tool-control close" onClick={() => setSelectedTool(null)} title="Close">
                  <span>×</span>
                </button>
              </div>
            </div>
            <div className="tool-window-content">
              {/* Tool-specific content would be loaded here */}
              <div className="tool-placeholder">
                <div className="tool-placeholder-icon">{selectedTool.icon}</div>
                <h2>{selectedTool.name}</h2>
                <p>{selectedTool.description}</p>
                {selectedTool.status === 'beta' && (
                  <div className="beta-notice">
                    <strong>Beta Version:</strong> This tool is still in development. 
                    Please report any issues to help us improve.
                  </div>
                )}
                <div className="tool-demo-area">
                  {selectedTool.id === 'cad-modeler' && (
                    <Simple3DViewer />
                  )}
                  {selectedTool.id === 'wit-slicer' && (
                    <div className="demo-slicer">
                      <div className="slicer-interface">
                        <div className="slicer-sidebar">
                          <h3>Print Settings</h3>
                          <div className="slicer-setting">
                            <label>Layer Height</label>
                            <select defaultValue="0.2">
                              <option value="0.1">0.1mm (Fine)</option>
                              <option value="0.2">0.2mm (Normal)</option>
                              <option value="0.3">0.3mm (Draft)</option>
                            </select>
                          </div>
                          <div className="slicer-setting">
                            <label>Infill Density</label>
                            <input type="range" min="0" max="100" defaultValue="20" />
                            <span>20%</span>
                          </div>
                          <div className="slicer-setting">
                            <label>Support Material</label>
                            <input type="checkbox" />
                          </div>
                          <div className="slicer-setting">
                            <label>Print Speed</label>
                            <input type="number" defaultValue="60" /> mm/s
                          </div>
                          <div className="slicer-setting">
                            <label>Nozzle Temperature</label>
                            <input type="number" defaultValue="215" /> °C
                          </div>
                          <div className="slicer-setting">
                            <label>Bed Temperature</label>
                            <input type="number" defaultValue="60" /> °C
                          </div>
                          <button className="slice-button">
                            <FaCube /> Slice Model
                          </button>
                        </div>
                        <div className="slicer-preview">
                          <div className="slicer-3d-view">
                            <FaCube size={100} color="#4a90e2" />
                            <p>3D model preview and layer visualization</p>
                          </div>
                          <div className="slicer-stats">
                            <div className="stat">
                              <strong>Print Time:</strong> 2h 34m
                            </div>
                            <div className="stat">
                              <strong>Material:</strong> 24.5g
                            </div>
                            <div className="stat">
                              <strong>Layers:</strong> 150
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedTool.id === 'image-analyzer' && (
                    <div className="demo-image-viewer">
                      <div className="demo-image-canvas">
                        <FaImage size={80} color="#4a90e2" />
                        <p>Image analysis tools would load here</p>
                      </div>
                    </div>
                  )}
                  {selectedTool.id === 'workflow-builder' && (
                    <div className="demo-workflow">
                      <div className="demo-workflow-canvas">
                        <FaRobot size={80} color="#4a90e2" />
                        <p>Drag and drop workflow builder would load here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="function-stats">
        <div className="stat-card">
          <h3>{tools.filter(t => t.status === 'available').length}</h3>
          <p>Available Tools</p>
        </div>
        <div className="stat-card">
          <h3>{tools.filter(t => t.status === 'beta').length}</h3>
          <p>Beta Tools</p>
        </div>
        <div className="stat-card">
          <h3>{tools.filter(t => t.status === 'coming-soon').length}</h3>
          <p>Coming Soon</p>
        </div>
      </div>
    </div>
  );
};

export default FunctionPage;