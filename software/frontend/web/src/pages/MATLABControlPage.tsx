import React, { useState, useEffect, useRef } from 'react';
import { 
  FaArrowLeft, FaPlay, FaStop, FaCalculator, FaCog, FaFileCode, FaChartLine, 
  FaDatabase, FaCloudUploadAlt, FaRocket, FaBrain, FaSync,
  FaFolder, FaSave, FaTrash, FaTerminal, FaEye, FaDownload
} from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './MATLABControlPage.css';

interface MATLABJob {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  progress?: number;
  result?: any;
  error?: string;
}

interface MATLABStatus {
  matlabInstalled: boolean;
  matlabRunning: boolean;
  engineRunning: boolean;
  enginePort?: number;
  webAppRunning: boolean;
  webAppPort?: number;
  activeJobs: number;
  workspace: string;
  enabledFeatures: {
    engine: boolean;
    webApps: boolean;
    gpu: boolean;
    parallel: boolean;
  };
}

interface MATLABControlPageProps {
  onClose?: () => void;
}

const MATLABControlPage: React.FC<MATLABControlPageProps> = ({ onClose }) => {
  const [status, setStatus] = useState<MATLABStatus | null>(null);
  const [activeJobs, setActiveJobs] = useState<MATLABJob[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState('statistics');
  const [isExecuting, setIsExecuting] = useState(false);
  const [engineStarting, setEngineStarting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const { status: udcStatus, wsStatus, sendCommand, lastPluginResponse } = useUDCWebSocket();
  const isConnected = udcStatus.connected;

  // Handle plugin responses
  useEffect(() => {
    if (lastPluginResponse && lastPluginResponse.pluginId === 'matlab') {
      const { command, result, error } = lastPluginResponse;
      console.log('Received MATLAB response:', { command, result, error });
      
      // Handle errors
      if (error) {
        setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
        
        // If engine closed, update status
        if (error.includes('MATLAB Engine closed')) {
          setStatus(prev => prev ? { ...prev, engineRunning: false } : null);
        }
        return;
      }
      
      // Handle direct command responses
      switch (command) {
        case 'getStatus':
          if (result) {
            setStatus(result);
          }
          break;
          
        case 'browseWorkspace':
          if (result?.files) {
            setWorkspaceFiles(result.files);
          }
          break;
          
        case 'executeCode':
          if (result) {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result.output || 'Code executed'}`]);
            if (result.jobId) {
              setActiveJobs(prev => [...prev, {
                id: result.jobId,
                type: 'code_execution',
                status: 'completed',
                startTime: Date.now(),
                endTime: Date.now(),
                result: result
              }]);
            }
          }
          break;
          
        case 'startEngine':
          if (result?.success) {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: MATLAB Engine started`]);
            refreshStatus();
          } else {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Failed to start engine: ${result?.error || 'Unknown error'}`]);
          }
          break;
          
        case 'stopEngine':
          if (result?.success) {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: MATLAB Engine stopped`]);
            refreshStatus();
          }
          break;
          
        case 'launch':
          if (result?.success) {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: MATLAB launched successfully`]);
          } else {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Failed to launch MATLAB`]);
          }
          break;
          
        case 'startWebApp':
          if (result?.success) {
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Web App server started on port ${result.port}`]);
            refreshStatus();
          }
          break;
      }
      
      // Handle message types (for real-time events)
      if (result?.type) {
        switch (result.type) {
          case 'engine_output':
          case 'engine_error':
            setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result.data}`]);
            break;
            
          case 'engine_closed':
            setStatus(prev => prev ? { ...prev, engineRunning: false } : null);
            break;
            
          case 'job_progress':
            setActiveJobs(prev => prev.map(job => 
              job.id === result.jobId 
                ? { ...job, progress: result.progress }
                : job
            ));
            break;
            
          case 'job_complete':
            setActiveJobs(prev => prev.map(job => 
              job.id === result.jobId 
                ? { ...job, status: result.success ? 'completed' : 'failed', endTime: Date.now() }
                : job
            ));
            break;
            
          case 'config_updated':
            // Refresh status after config update
            refreshStatus();
            break;
        }
      }
    }
  }, [lastPluginResponse]);

  useEffect(() => {
    if (isConnected) {
      refreshStatus();
      refreshWorkspace();
    }
  }, [isConnected]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const refreshStatus = async () => {
    try {
      sendCommand('matlab', 'getStatus', {});
    } catch (error) {
      console.error('Failed to get MATLAB status:', error);
    }
  };

  const refreshWorkspace = async () => {
    try {
      sendCommand('matlab', 'browseWorkspace', {});
    } catch (error) {
      console.error('Failed to browse workspace:', error);
    }
  };

  const launchMATLAB = async () => {
    try {
      sendCommand('matlab', 'launch', {
        nodesktop: false,
        nosplash: true
      });
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Launching MATLAB...`]);
      setTimeout(refreshStatus, 2000);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    }
  };

  const startEngine = async () => {
    setEngineStarting(true);
    try {
      sendCommand('matlab', 'startEngine', {});
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Starting MATLAB Engine...`]);
      setTimeout(refreshStatus, 3000);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    } finally {
      setEngineStarting(false);
    }
  };

  const stopEngine = async () => {
    try {
      sendCommand('matlab', 'stopEngine', {});
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Stopping MATLAB Engine...`]);
      setTimeout(refreshStatus, 1000);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    }
  };

  const executeCode = async () => {
    if (!codeInput.trim()) return;
    
    setIsExecuting(true);
    try {
      sendCommand('matlab', 'executeCode', {
        code: codeInput,
        timeout: 30000
      });
      
      setOutput(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()}: >> ${codeInput}`,
        `${new Date().toLocaleTimeString()}: Code execution started...`
      ]);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const runPredefinedAnalysis = async (analysisType: string) => {
    const analysisCommands = {
      statistics: "data = randn(100,1); disp(['Mean: ' num2str(mean(data))]); disp(['Std: ' num2str(std(data))]);",
      plotting: "t = 0:0.01:2*pi; y = sin(t); plot(t,y); title('Sine Wave'); xlabel('Time'); ylabel('Amplitude');",
      optimization: "fun = @(x) x(1)^2 + x(2)^2; x0 = [1; 1]; x = fminunc(fun, x0); disp(['Optimum: ' num2str(x')]);",
      simulation: "sys = tf([1], [1 1 1]); step(sys); title('Step Response');",
      fft: "Fs = 1000; t = 0:1/Fs:1-1/Fs; f = [50 120]; x = sin(2*pi*f(1)*t) + 0.5*sin(2*pi*f(2)*t); Y = fft(x); plot(abs(Y)); title('FFT Analysis');"
    };

    const command = analysisCommands[analysisType as keyof typeof analysisCommands];
    if (command) {
      setCodeInput(command);
      setIsExecuting(true);
      try {
        sendCommand('matlab', 'executeCode', { code: command });
        setOutput(prev => [
          ...prev,
          `${new Date().toLocaleTimeString()}: Running ${analysisType} analysis...`,
          `${new Date().toLocaleTimeString()}: Analysis started...`
        ]);
      } catch (error) {
        setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const clearWorkspace = async () => {
    try {
      sendCommand('matlab', 'clearWorkspace', {});
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Workspace cleared`]);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    }
  };

  const saveWorkspace = async () => {
    try {
      const filename = `workspace_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.mat`;
      sendCommand('matlab', 'saveData', {
        filePath: filename
      });
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Workspace saved as ${filename}`]);
      refreshWorkspace();
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    }
  };

  const startWebAppServer = async () => {
    try {
      sendCommand('matlab', 'startWebApp', {});
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Starting Web App server...`]);
      setTimeout(refreshStatus, 1000);
    } catch (error) {
      setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: Error: ${error}`]);
    }
  };

  if (!isConnected) {
    return (
      <div className="matlab-control-page">
        <div className="page-header">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft /> Back
            </button>
          )}
          <h1>MATLAB Control Center</h1>
        </div>
        <div className="connection-status">
          <FaCalculator className="matlab-icon" />
          <h2>MATLAB Integration</h2>
          <p>
            {wsStatus === 'connecting' 
              ? 'Connecting to Universal Desktop Controller...'
              : !udcStatus.connected
              ? 'UDC is connected but no plugins are active. Please start the MATLAB plugin.'
              : 'The MATLAB plugin is not active. Please start it from the Software Integrations page.'}
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
    <div className="matlab-control-page">
      <div className="matlab-header">
        <div className="matlab-title">
          {onClose && (
            <button onClick={onClose} className="back-button">
              <FaArrowLeft /> Back
            </button>
          )}
          <FaCalculator className="matlab-icon" />
          <h1>MATLAB Control Center</h1>
        </div>
        
        <div className="matlab-status-indicators">
          <div className={`status-indicator ${status?.matlabInstalled ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            MATLAB {status?.matlabInstalled ? 'Installed' : 'Not Found'}
          </div>
          <div className={`status-indicator ${status?.engineRunning ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            Engine {status?.engineRunning ? 'Running' : 'Stopped'}
          </div>
          <div className={`status-indicator ${status?.webAppRunning ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            Web Apps {status?.webAppRunning ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      <div className="matlab-controls">
        <div className="control-section">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button 
              className="action-btn primary"
              onClick={launchMATLAB}
              disabled={!status?.matlabInstalled}
            >
              <FaPlay /> Launch MATLAB
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={status?.engineRunning ? stopEngine : startEngine}
              disabled={!status?.matlabInstalled || engineStarting}
            >
              {status?.engineRunning ? <FaStop /> : <FaRocket />}
              {engineStarting ? 'Starting...' : (status?.engineRunning ? 'Stop Engine' : 'Start Engine')}
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={startWebAppServer}
              disabled={!status?.engineRunning || status?.webAppRunning}
            >
              <FaCloudUploadAlt /> Start Web Apps
            </button>
          </div>
        </div>

        <div className="control-section">
          <h3>Quick Analysis</h3>
          <div className="analysis-buttons">
            <button 
              className="analysis-btn"
              onClick={() => runPredefinedAnalysis('statistics')}
              disabled={!status?.engineRunning || isExecuting}
            >
              <FaChartLine /> Statistics
            </button>
            <button 
              className="analysis-btn"
              onClick={() => runPredefinedAnalysis('plotting')}
              disabled={!status?.engineRunning || isExecuting}
            >
              <FaEye /> Plotting
            </button>
            <button 
              className="analysis-btn"
              onClick={() => runPredefinedAnalysis('optimization')}
              disabled={!status?.engineRunning || isExecuting}
            >
              <FaRocket /> Optimization
            </button>
            <button 
              className="analysis-btn"
              onClick={() => runPredefinedAnalysis('simulation')}
              disabled={!status?.engineRunning || isExecuting}
            >
              <FaCog /> Simulation
            </button>
            <button 
              className="analysis-btn"
              onClick={() => runPredefinedAnalysis('fft')}
              disabled={!status?.engineRunning || isExecuting}
            >
              <FaBrain /> FFT Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="matlab-workspace">
        <div className="workspace-panel">
          <div className="workspace-header">
            <h3><FaTerminal /> Command Window</h3>
            <div className="workspace-actions">
              <button onClick={clearWorkspace} disabled={!status?.engineRunning}>
                <FaTrash /> Clear
              </button>
              <button onClick={saveWorkspace} disabled={!status?.engineRunning}>
                <FaSave /> Save
              </button>
              <button onClick={refreshWorkspace}>
                <FaSync /> Refresh
              </button>
            </div>
          </div>
          
          <div className="code-input-section">
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Enter MATLAB code here..."
              rows={4}
              disabled={!status?.engineRunning}
            />
            <button 
              className="execute-btn"
              onClick={executeCode}
              disabled={!status?.engineRunning || isExecuting || !codeInput.trim()}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          </div>
          
          <div className="output-section">
            <div className="output-content" ref={outputRef}>
              {output.map((line, index) => (
                <div key={index} className="output-line">{line}</div>
              ))}
              {output.length === 0 && (
                <div className="output-placeholder">
                  MATLAB output will appear here...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="files-panel">
          <div className="files-header">
            <h3><FaFolder /> Workspace Files</h3>
            <span className="file-count">{workspaceFiles.length} files</span>
          </div>
          
          <div className="files-list">
            {workspaceFiles.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <FaFileCode className="file-icon" />
                  <span className="file-name">{file.name}</span>
                  <span className="file-type">{file.type}</span>
                </div>
                <div className="file-meta">
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  <span className="file-date">{new Date(file.modified).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {workspaceFiles.length === 0 && (
              <div className="no-files">
                No MATLAB files found in workspace
              </div>
            )}
          </div>
        </div>
      </div>

      {activeJobs.length > 0 && (
        <div className="active-jobs">
          <h3>Active Jobs</h3>
          {activeJobs.map(job => (
            <div key={job.id} className={`job-item ${job.status}`}>
              <div className="job-info">
                <span className="job-type">{job.type}</span>
                <span className="job-status">{job.status}</span>
              </div>
              {job.progress !== undefined && (
                <div className="job-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{job.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MATLABControlPage;