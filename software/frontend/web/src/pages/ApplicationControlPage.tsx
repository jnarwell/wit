import React, { useState, useEffect, useCallback } from 'react';
import { FaArrowLeft, FaDesktop, FaTerminal, FaCog, FaPlay, FaStop, FaRedo, FaFolder, FaFile, FaUpload, FaDownload, FaPlus, FaTrash, FaSave, FaCheck, FaTimes } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './ApplicationControlPage.css';

interface ApplicationConfig {
  [key: string]: any;
}

interface ApplicationStatus {
  running: boolean;
  connected: boolean;
  [key: string]: any;
}

interface ControlAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: string;
  args?: any;
  requiresRunning?: boolean;
  primary?: boolean;
}

// Plugin-specific configurations
const PLUGIN_CONFIGS: { [key: string]: any } = {
  'arduino-ide': {
    name: 'Arduino IDE',
    icon: <FaDesktop />,
    controls: [
      {
        id: 'launch',
        label: 'Open IDE',
        icon: <FaDesktop />,
        action: 'launch',
        primary: true
      },
      {
        id: 'serial',
        label: 'Serial Monitor',
        icon: <FaTerminal />,
        action: 'startSerial',
        args: { baudRate: 9600 }
      },
      {
        id: 'compile',
        label: 'Verify/Compile',
        icon: <FaCheck />,
        action: 'compile',
        requiresRunning: true
      },
      {
        id: 'upload',
        label: 'Upload',
        icon: <FaUpload />,
        action: 'upload',
        requiresRunning: true
      }
    ],
    statusFields: [
      { key: 'currentPort', label: 'Port' },
      { key: 'currentBoard', label: 'Board' },
      { key: 'connectedBoards', label: 'Connected Boards' }
    ],
    configFields: [
      {
        key: 'defaultBoard',
        label: 'Default Board',
        type: 'select',
        options: [
          { value: 'arduino:avr:uno', label: 'Arduino Uno' },
          { value: 'arduino:avr:mega', label: 'Arduino Mega' },
          { value: 'arduino:avr:nano', label: 'Arduino Nano' },
          { value: 'arduino:avr:leonardo', label: 'Arduino Leonardo' },
          { value: 'arduino:samd:mkr1000', label: 'Arduino MKR1000' },
          { value: 'arduino:samd:mkrzero', label: 'Arduino MKR Zero' },
          { value: 'esp8266:esp8266:nodemcuv2', label: 'NodeMCU v2' },
          { value: 'esp32:esp32:esp32', label: 'ESP32' }
        ]
      },
      {
        key: 'defaultPort',
        label: 'Default Port',
        type: 'text',
        placeholder: 'Auto-detect'
      },
      {
        key: 'sketchesPath',
        label: 'Sketches Directory',
        type: 'text',
        placeholder: '~/Documents/Arduino'
      },
      {
        key: 'enableSerial',
        label: 'Auto-start Serial Monitor',
        type: 'boolean'
      }
    ]
  }
};

interface ApplicationControlPageProps {
  pluginId: string;
  onClose: () => void;
}

const ApplicationControlPage: React.FC<ApplicationControlPageProps> = ({ pluginId, onClose }) => {
  const { status: udcStatus, wsStatus, sendCommand, lastPluginResponse } = useUDCWebSocket();
  
  const [appStatus, setAppStatus] = useState<ApplicationStatus>({
    running: false,
    connected: false
  });
  const [appConfig, setAppConfig] = useState<ApplicationConfig>({});
  const [editingConfig, setEditingConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState<ApplicationConfig>({});
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  
  // Get plugin configuration
  const pluginConfig = PLUGIN_CONFIGS[pluginId || ''] || {
    name: 'Unknown Application',
    icon: <FaDesktop />,
    controls: [],
    statusFields: [],
    configFields: []
  };
  
  // Find the actual plugin from UDC status
  const plugin = udcStatus.plugins.find(p => p.id === pluginId);
  const isConnected = wsStatus === 'connected' && udcStatus.connected && plugin?.status === 'active';
  
  // Fetch initial status and config
  useEffect(() => {
    if (!isConnected || !pluginId) return;
    
    // Get status
    sendCommand(pluginId, 'getStatus');
    
    // Get project list if applicable
    if (pluginId === 'arduino-ide') {
      sendCommand(pluginId, 'getSketchList');
    }
  }, [isConnected, pluginId, sendCommand]);
  
  // Handle WebSocket messages from UDC
  useEffect(() => {
    if (!lastPluginResponse || lastPluginResponse.pluginId !== pluginId) return;
    
    // Handle different response types
    if (lastPluginResponse.result) {
      // Update status if it's a status response
      if (lastPluginResponse.result.running !== undefined) {
        setAppStatus(prev => ({ ...prev, ...lastPluginResponse.result }));
        setAppConfig(lastPluginResponse.result.config || {});
      }
      
      // Handle project list
      if (Array.isArray(lastPluginResponse.result)) {
        setProjects(lastPluginResponse.result);
      }
    }
    
    // Handle serial data
    if (lastPluginResponse.type === 'serial_data') {
      setSerialOutput(prev => [...prev, lastPluginResponse.data]);
    }
  }, [lastPluginResponse, pluginId]);
  
  const handleAction = useCallback((action: ControlAction) => {
    if (!pluginId) return;
    
    sendCommand(pluginId, action.action, action.args);
  }, [pluginId, sendCommand]);
  
  const handleConfigEdit = () => {
    setTempConfig({ ...appConfig });
    setEditingConfig(true);
  };
  
  const handleConfigSave = () => {
    if (!pluginId) return;
    
    sendCommand(pluginId, 'updateConfig', tempConfig);
    setAppConfig(tempConfig);
    setEditingConfig(false);
  };
  
  const handleConfigCancel = () => {
    setTempConfig({});
    setEditingConfig(false);
  };
  
  const handleSerialSend = () => {
    if (!pluginId || !serialInput.trim()) return;
    
    sendCommand(pluginId, 'sendSerial', { data: serialInput + '\n' });
    setSerialInput('');
  };
  
  const handleProjectSelect = (projectPath: string) => {
    setSelectedProject(projectPath);
    if (pluginId) {
      sendCommand(pluginId, 'openSketch', { projectPath });
    }
  };
  
  if (!isConnected) {
    return (
      <div className="application-control-page">
        <div className="page-header">
          <button onClick={onClose} className="back-button">
            <FaArrowLeft /> Back
          </button>
          <h1>{pluginConfig.name}</h1>
        </div>
        <div className="disconnected-message">
          <FaDesktop className="disconnected-icon" />
          <h2>Plugin Not Connected</h2>
          <p>
            {wsStatus === 'failed' || wsStatus === 'disconnected' 
              ? 'Please ensure the Universal Desktop Controller is running and connected to the backend.'
              : wsStatus === 'connecting' 
              ? 'Connecting to Universal Desktop Controller...'
              : !udcStatus.connected
              ? 'UDC is connected but no plugins are active. Please start the plugin from the Software Integrations page.'
              : `The ${pluginConfig.name} plugin is not active. Please start it from the Software Integrations page.`}
          </p>
          <button onClick={onClose} className="primary-button">
            Go to Software Integrations
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="application-control-page">
      <div className="page-header">
        <div className="header-left">
          <button onClick={onClose} className="back-button">
            <FaArrowLeft /> Back
          </button>
          <h1>{pluginConfig.name} Control</h1>
        </div>
        <div className="header-status">
          <span className={`status-badge ${appStatus.running ? 'running' : 'stopped'}`}>
            {appStatus.running ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>
      
      <div className="control-layout">
        {/* Quick Controls */}
        <div className="control-section quick-controls">
          <h2>Quick Controls</h2>
          <div className="control-buttons">
            {pluginConfig.controls.map((control: ControlAction) => (
              <button
                key={control.id}
                className={`control-button ${control.primary ? 'primary' : ''}`}
                onClick={() => handleAction(control)}
                disabled={control.requiresRunning && !appStatus.running}
              >
                {control.icon}
                <span>{control.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Status Section */}
        <div className="control-section status-section">
          <h2>Status</h2>
          <div className="status-grid">
            {pluginConfig.statusFields.map((field: any) => (
              <div key={field.key} className="status-item">
                <label>{field.label}:</label>
                <span>{appStatus[field.key] || 'N/A'}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Configuration Section */}
        <div className="control-section config-section">
          <div className="section-header">
            <h2>Configuration</h2>
            {!editingConfig && (
              <button onClick={handleConfigEdit} className="edit-button">
                <FaCog /> Edit
              </button>
            )}
          </div>
          
          {editingConfig ? (
            <div className="config-editor">
              {pluginConfig.configFields.map((field: any) => (
                <div key={field.key} className="config-field">
                  <label>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={tempConfig[field.key] || ''}
                      onChange={(e) => setTempConfig({ ...tempConfig, [field.key]: e.target.value })}
                    >
                      <option value="">Default</option>
                      {field.options.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={tempConfig[field.key] || false}
                      onChange={(e) => setTempConfig({ ...tempConfig, [field.key]: e.target.checked })}
                    />
                  ) : (
                    <input
                      type="text"
                      value={tempConfig[field.key] || ''}
                      onChange={(e) => setTempConfig({ ...tempConfig, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
              <div className="config-actions">
                <button onClick={handleConfigCancel} className="cancel-button">
                  <FaTimes /> Cancel
                </button>
                <button onClick={handleConfigSave} className="save-button">
                  <FaSave /> Save
                </button>
              </div>
            </div>
          ) : (
            <div className="config-display">
              {pluginConfig.configFields.map((field: any) => (
                <div key={field.key} className="config-item">
                  <label>{field.label}:</label>
                  <span>
                    {field.type === 'boolean' 
                      ? (appConfig[field.key] ? 'Enabled' : 'Disabled')
                      : (appConfig[field.key] || 'Not set')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Project Browser (if applicable) */}
        {pluginId === 'arduino-ide' && (
          <div className="control-section project-section">
            <h2>Projects</h2>
            <div className="project-list">
              {projects.map((project) => (
                <div
                  key={project.path}
                  className={`project-item ${selectedProject === project.path ? 'selected' : ''}`}
                  onClick={() => handleProjectSelect(project.path)}
                >
                  <FaFolder />
                  <span className="project-name">{project.name}</span>
                  <span className="project-date">
                    {new Date(project.modified).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
            <button className="new-project-button">
              <FaPlus /> New Project
            </button>
          </div>
        )}
        
        {/* Serial Monitor (if applicable) */}
        {pluginId === 'arduino-ide' && (
          <div className="control-section serial-section">
            <h2>Serial Monitor</h2>
            <div className="serial-monitor">
              <div className="serial-output">
                {serialOutput.map((line, index) => (
                  <div key={index} className="serial-line">
                    {line}
                  </div>
                ))}
              </div>
              <div className="serial-input-wrapper">
                <input
                  type="text"
                  className="serial-input"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSerialSend()}
                  placeholder="Enter command..."
                />
                <button onClick={handleSerialSend} className="send-button">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationControlPage;