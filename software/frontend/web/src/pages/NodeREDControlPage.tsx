import React, { useState, useEffect, useRef } from 'react';
import { 
  FaArrowLeft, FaPlay, FaStop, FaSync, FaExternalLinkAlt, FaProjectDiagram, 
  FaPlus, FaDownload, FaCog, FaSitemap, FaCode, FaRobot, FaClock,
  FaThermometerHalf, FaPrint, FaWifi, FaDatabase, FaChartLine
} from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './NodeREDControlPage.css';

interface NodeREDFlow {
  id: string;
  type: string;
  label: string;
  info?: string;
  disabled: boolean;
  nodes?: number;
}

interface NodeREDStatus {
  running: boolean;
  port?: number;
  url?: string;
  userDir: string;
  flowsFile: string;
  projectsEnabled: boolean;
  flowCount?: number;
  nodeCount?: number;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'sensor' | 'machine' | 'automation' | 'integration';
}

interface NodeREDControlPageProps {
  onClose?: () => void;
}

const NodeREDControlPage: React.FC<NodeREDControlPageProps> = ({ onClose }) => {
  const [status, setStatus] = useState<NodeREDStatus | null>(null);
  const [flows, setFlows] = useState<NodeREDFlow[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ sensors: number; machines: number } | null>(null);
  
  const { status: udcStatus, wsStatus, sendCommand, lastPluginResponse } = useUDCWebSocket();
  const isConnected = udcStatus.connected;

  const flowTemplates: FlowTemplate[] = [
    {
      id: 'sensor-monitor',
      name: 'Sensor Monitor',
      description: 'Monitor and log sensor data',
      icon: <FaThermometerHalf />,
      category: 'sensor'
    },
    {
      id: 'machine-control',
      name: 'Machine Control',
      description: 'Control and monitor machines',
      icon: <FaPrint />,
      category: 'machine'
    },
    {
      id: 'scheduled-task',
      name: 'Scheduled Task',
      description: 'Run tasks on a schedule',
      icon: <FaClock />,
      category: 'automation'
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline',
      description: 'Process and transform data',
      icon: <FaDatabase />,
      category: 'integration'
    },
    {
      id: 'alert-system',
      name: 'Alert System',
      description: 'Send alerts based on conditions',
      icon: <FaRobot />,
      category: 'automation'
    },
    {
      id: 'mqtt-bridge',
      name: 'MQTT Bridge',
      description: 'Connect IoT devices via MQTT',
      icon: <FaWifi />,
      category: 'integration'
    }
  ];

  // Handle plugin responses
  useEffect(() => {
    if (lastPluginResponse && lastPluginResponse.pluginId === 'node-red') {
      const { command, result, error } = lastPluginResponse;
      
      if (error) {
        console.error('Node-RED error:', error);
        return;
      }
      
      switch (command) {
        case 'getStatus':
          if (result) {
            setStatus(result);
          }
          break;
          
        case 'getFlows':
          if (result) {
            setFlows(result.filter((f: any) => f.type === 'tab'));
          }
          break;
          
        case 'start':
          if (result?.success) {
            setIsStarting(false);
            refreshStatus();
          }
          break;
          
        case 'syncWithWIT':
          if (result?.success) {
            setSyncStatus({
              sensors: result.sensorsImported || 0,
              machines: result.machinesImported || 0
            });
            refreshFlows();
          }
          break;
      }
      
      // Handle real-time messages
      if (result?.type === 'node-red-started') {
        refreshStatus();
        refreshFlows();
      } else if (result?.type === 'node-red-stopped') {
        setStatus(prev => prev ? { ...prev, running: false } : null);
      }
    }
  }, [lastPluginResponse]);

  useEffect(() => {
    if (isConnected) {
      refreshStatus();
    }
  }, [isConnected]);

  const refreshStatus = async () => {
    try {
      sendCommand('node-red', 'getStatus', {});
    } catch (error) {
      console.error('Failed to get Node-RED status:', error);
    }
  };

  const refreshFlows = async () => {
    if (status?.running) {
      try {
        sendCommand('node-red', 'getFlows', {});
      } catch (error) {
        console.error('Failed to get flows:', error);
      }
    }
  };

  const startNodeRED = async () => {
    setIsStarting(true);
    try {
      sendCommand('node-red', 'start', {});
    } catch (error) {
      console.error('Failed to start Node-RED:', error);
      setIsStarting(false);
    }
  };

  const stopNodeRED = async () => {
    try {
      sendCommand('node-red', 'stop', {});
    } catch (error) {
      console.error('Failed to stop Node-RED:', error);
    }
  };

  const restartNodeRED = async () => {
    try {
      sendCommand('node-red', 'restart', {});
    } catch (error) {
      console.error('Failed to restart Node-RED:', error);
    }
  };

  const openEditor = async () => {
    try {
      sendCommand('node-red', 'openEditor', {});
    } catch (error) {
      console.error('Failed to open editor:', error);
    }
  };

  const syncWithWIT = async () => {
    try {
      sendCommand('node-red', 'syncWithWIT', {});
    } catch (error) {
      console.error('Failed to sync with W.I.T.:', error);
    }
  };

  const createFlowFromTemplate = async (templateId: string) => {
    const template = flowTemplates.find(t => t.id === templateId);
    if (!template) return;

    try {
      let command = '';
      let payload: any = { name: newFlowName || template.name };

      switch (templateId) {
        case 'sensor-monitor':
          command = 'createSensorFlow';
          payload = {
            sensorId: 'sensor-1',
            sensorName: newFlowName || 'Temperature Sensor',
            sensorType: 'temperature'
          };
          break;
          
        case 'machine-control':
          command = 'createMachineFlow';
          payload = {
            machineId: 'machine-1',
            machineName: newFlowName || '3D Printer',
            machineType: '3d-printer'
          };
          break;
          
        case 'scheduled-task':
          command = 'createAutomationFlow';
          payload = {
            name: newFlowName || 'Scheduled Task',
            trigger: { type: 'schedule', interval: '60' },
            action: { type: 'function', code: '// Your code here' }
          };
          break;
          
        default:
          command = 'createFlow';
          payload = {
            name: newFlowName || template.name,
            description: template.description,
            nodes: []
          };
      }

      sendCommand('node-red', command, payload);
      setShowCreateFlow(false);
      setNewFlowName('');
      setSelectedTemplate(null);
      
      // Refresh flows after creation
      setTimeout(refreshFlows, 1000);
    } catch (error) {
      console.error('Failed to create flow:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="node-red-control-page">
        <div className="page-header">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft /> Back
            </button>
          )}
          <h1>Node-RED Control Center</h1>
        </div>
        <div className="connection-status">
          <FaProjectDiagram className="node-red-icon" />
          <h2>Node-RED Integration</h2>
          <p>
            {wsStatus === 'connecting' 
              ? 'Connecting to Universal Desktop Controller...'
              : 'Please ensure the Node-RED plugin is active in the Universal Desktop Controller.'}
          </p>
          {onClose && (
            <button onClick={onClose} className="primary-button">
              Go to Software Integrations
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="node-red-control-page">
      <div className="node-red-header">
        <div className="node-red-title">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft /> Back
            </button>
          )}
          <FaProjectDiagram className="node-red-icon" />
          <h1>Node-RED Flow Automation</h1>
        </div>
        
        <div className="node-red-status-indicators">
          <div className={`status-indicator ${status?.running ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            Node-RED {status?.running ? 'Running' : 'Stopped'}
          </div>
          {status?.running && (
            <>
              <div className="status-indicator info">
                <FaSitemap /> {status.flowCount || 0} Flows
              </div>
              <div className="status-indicator info">
                <FaCode /> {status.nodeCount || 0} Nodes
              </div>
            </>
          )}
        </div>
      </div>

      <div className="node-red-controls">
        <div className="control-section">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button 
              className="action-btn primary"
              onClick={status?.running ? stopNodeRED : startNodeRED}
              disabled={isStarting}
            >
              {status?.running ? <FaStop /> : <FaPlay />}
              {isStarting ? 'Starting...' : (status?.running ? 'Stop Node-RED' : 'Start Node-RED')}
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={restartNodeRED}
              disabled={!status?.running || isStarting}
            >
              <FaSync /> Restart
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={openEditor}
              disabled={!status?.running}
            >
              <FaExternalLinkAlt /> Open Editor
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={syncWithWIT}
              disabled={!status?.running}
            >
              <FaDownload /> Import from W.I.T.
            </button>
          </div>

          {syncStatus && (
            <div className="sync-status">
              <p>✓ Imported {syncStatus.sensors} sensors and {syncStatus.machines} machines</p>
            </div>
          )}
        </div>

        <div className="control-section">
          <h3>Flow Templates</h3>
          <div className="template-grid">
            {flowTemplates.map(template => (
              <button
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTemplate(template.id);
                  setShowCreateFlow(true);
                }}
                disabled={!status?.running}
              >
                <div className="template-icon">{template.icon}</div>
                <h4>{template.name}</h4>
                <p>{template.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="node-red-workspace">
        <div className="flows-panel">
          <div className="panel-header">
            <h3><FaProjectDiagram /> Active Flows</h3>
            <button 
              className="add-flow-btn"
              onClick={() => setShowCreateFlow(true)}
              disabled={!status?.running}
            >
              <FaPlus /> New Flow
            </button>
          </div>
          
          <div className="flows-list">
            {flows.length > 0 ? (
              flows.map(flow => (
                <div key={flow.id} className="flow-item">
                  <div className="flow-info">
                    <h4>{flow.label}</h4>
                    {flow.info && <p>{flow.info}</p>}
                  </div>
                  <div className="flow-status">
                    <span className={`status-badge ${flow.disabled ? 'disabled' : 'enabled'}`}>
                      {flow.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-flows">
                {status?.running ? (
                  <>
                    <FaProjectDiagram />
                    <p>No flows created yet</p>
                    <p className="hint">Create a flow from a template or open the editor</p>
                  </>
                ) : (
                  <p>Start Node-RED to view flows</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="info-panel">
          <h3>What is Node-RED?</h3>
          <p>
            Node-RED is a flow-based visual programming tool for wiring together hardware devices, 
            APIs, and online services. Perfect for:
          </p>
          <ul>
            <li><FaThermometerHalf /> Collecting sensor data</li>
            <li><FaPrint /> Automating machine workflows</li>
            <li><FaChartLine /> Creating real-time dashboards</li>
            <li><FaWifi /> Connecting IoT devices</li>
            <li><FaRobot /> Building automation rules</li>
          </ul>
          
          {status?.running && status.url && (
            <div className="editor-link">
              <p>Editor URL:</p>
              <code>{status.url}</code>
            </div>
          )}
        </div>
      </div>

      {/* Create Flow Modal */}
      {showCreateFlow && (
        <div className="modal-overlay" onClick={() => setShowCreateFlow(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create New Flow</h2>
            {selectedTemplate && (
              <div className="selected-template">
                <p>Template: {flowTemplates.find(t => t.id === selectedTemplate)?.name}</p>
              </div>
            )}
            <input
              type="text"
              placeholder="Flow name (optional)"
              value={newFlowName}
              onChange={e => setNewFlowName(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowCreateFlow(false)}>Cancel</button>
              <button 
                className="primary"
                onClick={() => createFlowFromTemplate(selectedTemplate || 'empty')}
              >
                Create Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeREDControlPage;