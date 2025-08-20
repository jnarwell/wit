import React, { useState, useEffect, useCallback } from 'react';
import { FaArrowLeft, FaCog, FaPlay, FaStop, FaUpload, FaDownload, FaEye, FaTrash, FaCube, FaLayerGroup, FaThermometerHalf, FaClock, FaWeight } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './SlicerControlPage.css';

interface SlicerInfo {
  id: string;
  name: string;
  path: string;
  version: string;
  cliSupport: string;
  isDefault: boolean;
}

interface SlicingProfile {
  name: string;
  settings: {
    layerHeight: string;
    infillDensity: string;
    printSpeed: string;
    supportMaterial: boolean;
    filamentType: string;
  };
  isDefault: boolean;
}

interface SlicingJob {
  id: string;
  slicer: string;
  inputFile: string;
  outputFile: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

interface SlicedFile {
  name: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
}

interface GCodeAnalysis {
  filePath: string;
  fileSize: number;
  lineCount: number;
  estimatedPrintTime: string;
  filamentUsed: string;
  layerCount: number;
  temperature: string;
  bedTemperature: string;
  generatedBy: string;
}

interface SlicerControlPageProps {
  onClose: () => void;
}

const SlicerControlPage: React.FC<SlicerControlPageProps> = ({ onClose }) => {
  const { status: udcStatus, wsStatus, sendCommand, lastPluginResponse } = useUDCWebSocket();
  
  const [availableSlicers, setAvailableSlicers] = useState<SlicerInfo[]>([]);
  const [slicingProfiles, setSlicingProfiles] = useState<SlicingProfile[]>([]);
  const [activeJobs, setActiveJobs] = useState<SlicingJob[]>([]);
  const [slicedFiles, setSlicedFiles] = useState<SlicedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedSlicer, setSelectedSlicer] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('default');
  const [analysisData, setAnalysisData] = useState<GCodeAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [manualFilePath, setManualFilePath] = useState<string>('');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browsedFiles, setBrowsedFiles] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Find the plugin from UDC status
  const plugin = udcStatus.plugins.find(p => p.id === 'unified-slicer');
  const isConnected = wsStatus === 'connected' && udcStatus.connected && plugin?.status === 'active';
  
  // Fetch initial data
  useEffect(() => {
    if (!isConnected) return;
    
    sendCommand('unified-slicer', 'getAvailableSlicers');
    sendCommand('unified-slicer', 'getSlicingProfiles');
    sendCommand('unified-slicer', 'getSlicedFiles');
    sendCommand('unified-slicer', 'getJobStatus');
  }, [isConnected, sendCommand]);
  
  // Handle plugin responses
  useEffect(() => {
    if (!lastPluginResponse || lastPluginResponse.pluginId !== 'unified-slicer') return;
    
    const { command, result } = lastPluginResponse;
    console.log('[SlicerControlPage] Processing plugin response:', { command, result });
    
    switch (command) {
      case 'getAvailableSlicers':
        console.log('[SlicerControlPage] Got slicers:', result);
        if (result?.slicers) {
          console.log('[SlicerControlPage] Setting available slicers:', result.slicers);
          setAvailableSlicers(result.slicers);
          if (result.defaultSlicer) {
            setSelectedSlicer(result.defaultSlicer);
          }
        }
        break;
        
      case 'getSlicingProfiles':
        if (result?.profiles) {
          setSlicingProfiles(result.profiles);
        }
        break;
        
      case 'getSlicedFiles':
        if (Array.isArray(result)) {
          setSlicedFiles(result);
        }
        break;
        
      case 'getJobStatus':
        if (Array.isArray(result)) {
          setActiveJobs(result);
        }
        break;
        
      case 'analyzeGCode':
        if (result) {
          setAnalysisData(result);
          setShowAnalysis(true);
        }
        break;
        
      case 'searchFiles':
        console.log('[SlicerControlPage] Search results:', result);
        setIsSearching(false);
        if (result?.results && result.results.length > 0) {
          setBrowsedFiles(result.results);
          setShowFileBrowser(true);
        } else {
          alert('No files found matching the selected file name. Please use the manual path option or browse for files.');
        }
        break;
        
      case 'browse3DFiles':
        console.log('[SlicerControlPage] Browse results:', result);
        if (result?.files) {
          setBrowsedFiles(result.files);
        }
        break;
    }
  }, [lastPluginResponse]);
  
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    const fileName = files[0].name;
    console.log('[SlicerControlPage] Searching for file:', fileName);
    
    // Search for the file on the user's computer
    setIsSearching(true);
    sendCommand('unified-slicer', 'searchFiles', { filename: fileName });
  }, [sendCommand]);
  
  const handleSlice = useCallback(async () => {
    if (selectedFiles.length === 0 || !selectedSlicer) return;
    
    const profile = slicingProfiles.find(p => p.name === selectedProfile);
    
    if (selectedFiles.length === 1) {
      // Single file slicing
      sendCommand('unified-slicer', 'slice', {
        inputFile: selectedFiles[0],
        slicer: selectedSlicer,
        profile: profile?.settings
      });
    } else {
      // Batch slicing
      sendCommand('unified-slicer', 'batchSlice', {
        files: selectedFiles,
        slicer: selectedSlicer,
        profile: profile?.settings
      });
    }
    
    // Refresh job status
    setTimeout(() => {
      sendCommand('unified-slicer', 'getJobStatus');
    }, 1000);
  }, [selectedFiles, selectedSlicer, selectedProfile, slicingProfiles, sendCommand]);
  
  const handleLaunchSlicer = useCallback((slicerId: string) => {
    sendCommand('unified-slicer', 'launchSlicer', {
      slicer: slicerId,
      files: selectedFiles
    });
  }, [selectedFiles, sendCommand]);
  
  const handleCancelJob = useCallback((jobId: string) => {
    sendCommand('unified-slicer', 'cancelJob', { jobId });
    setTimeout(() => {
      sendCommand('unified-slicer', 'getJobStatus');
    }, 500);
  }, [sendCommand]);
  
  const handleAnalyzeFile = useCallback((filePath: string) => {
    sendCommand('unified-slicer', 'analyzeGCode', { filePath });
  }, [sendCommand]);
  
  const handleDeleteFile = useCallback((filePath: string) => {
    sendCommand('unified-slicer', 'deleteSlicedFile', { filePath });
    setTimeout(() => {
      sendCommand('unified-slicer', 'getSlicedFiles');
    }, 500);
  }, [sendCommand]);
  
  const handleSendToPrinter = useCallback((filePath: string) => {
    sendCommand('unified-slicer', 'sendToPrinter', { filePath });
  }, [sendCommand]);
  
  if (!isConnected) {
    return (
      <div className="slicer-control-page">
        <div className="page-header">
          <button onClick={onClose} className="back-button">
            <FaArrowLeft /> Back
          </button>
          <h1>3D Slicer Control</h1>
        </div>
        <div className="disconnected-message">
          <FaCube className="disconnected-icon" />
          <h2>Slicer Plugin Not Connected</h2>
          <p>
            {wsStatus === 'failed' || wsStatus === 'disconnected' 
              ? 'Please ensure the Universal Desktop Controller is running and connected to the backend.'
              : wsStatus === 'connecting' 
              ? 'Connecting to Universal Desktop Controller...'
              : !udcStatus.connected
              ? 'UDC is connected but no plugins are active. Please start the Unified Slicer plugin.'
              : 'The Unified Slicer plugin is not active. Please start it from the Software Integrations page.'}
          </p>
          <button onClick={onClose} className="primary-button">
            Go to Software Integrations
          </button>
        </div>
      </div>
    );
  }
  
  console.log('[SlicerControlPage] Rendering with slicers:', availableSlicers);
  
  return (
    <div className="slicer-control-page">
      <div className="page-header">
        <div className="header-left">
          <button onClick={onClose} className="back-button">
            <FaArrowLeft /> Back
          </button>
          <h1>3D Slicer Control</h1>
        </div>
        <div className="header-status">
          <span className="status-badge connected">
            {availableSlicers.length} Slicer{availableSlicers.length !== 1 ? 's' : ''} Available
          </span>
        </div>
      </div>
      
      <div className="slicer-layout">
        {/* Available Slicers */}
        <div className="control-section slicers-section">
          <h2>Available Slicers</h2>
          <div className="slicers-grid">
            {availableSlicers.map((slicer) => (
              <div
                key={slicer.id}
                className={`slicer-card ${selectedSlicer === slicer.id ? 'selected' : ''}`}
                onClick={() => setSelectedSlicer(slicer.id)}
              >
                <div className="slicer-info">
                  <h3>{slicer.name}</h3>
                  <p className="slicer-version">v{slicer.version}</p>
                  <p className="slicer-cli">CLI: {slicer.cliSupport}</p>
                  {slicer.isDefault && <span className="default-badge">Default</span>}
                </div>
                <div className="slicer-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchSlicer(slicer.id);
                    }}
                    className="launch-button"
                    title="Launch Slicer"
                  >
                    <FaPlay />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* File Selection and Slicing */}
        <div className="control-section slicing-section">
          <h2>Slice Files</h2>
          <div className="slicing-controls">
            <div className="file-input-wrapper">
              <input
                type="file"
                id="file-input"
                multiple
                accept=".stl,.3mf,.obj,.amf,.ply"
                onChange={handleFileUpload}
                className="file-input"
              />
              <label htmlFor="file-input" className="file-input-label">
                <FaUpload /> Select 3D Files
              </label>
              {selectedFiles.length > 0 && (
                <span className="file-count">{selectedFiles.length} file(s) selected</span>
              )}
            </div>
            
            <div className="manual-path-input" style={{ marginTop: '10px' }}>
              <input
                type="text"
                placeholder="Or enter full file path (e.g., /path/to/file.stl)"
                value={manualFilePath}
                onChange={(e) => setManualFilePath(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
              />
              <button
                onClick={() => {
                  if (manualFilePath.trim()) {
                    setSelectedFiles([manualFilePath.trim()]);
                    setManualFilePath('');
                  }
                }}
                style={{ padding: '8px 16px' }}
              >
                Use Manual Path
              </button>
            </div>
            
            <div className="profile-selector">
              <label htmlFor="profile-select">Slicing Profile:</label>
              <select
                id="profile-select"
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
              >
                {slicingProfiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name} {profile.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleSlice}
              disabled={selectedFiles.length === 0 || !selectedSlicer}
              className="slice-button primary-button"
            >
              <FaLayerGroup /> Slice {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : 'File'}
            </button>
          </div>
          
          {/* Selected Profile Details */}
          {selectedProfile && (
            <div className="profile-details">
              <h3>Profile Settings</h3>
              {(() => {
                const profile = slicingProfiles.find(p => p.name === selectedProfile);
                if (!profile) return null;
                
                return (
                  <div className="settings-grid">
                    <div className="setting-item">
                      <label>Layer Height:</label>
                      <span>{profile.settings.layerHeight}mm</span>
                    </div>
                    <div className="setting-item">
                      <label>Infill Density:</label>
                      <span>{profile.settings.infillDensity}</span>
                    </div>
                    <div className="setting-item">
                      <label>Print Speed:</label>
                      <span>{profile.settings.printSpeed}mm/s</span>
                    </div>
                    <div className="setting-item">
                      <label>Support Material:</label>
                      <span>{profile.settings.supportMaterial ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        
        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="control-section jobs-section">
            <h2>Active Jobs</h2>
            <div className="jobs-list">
              {activeJobs.map((job) => (
                <div key={job.id} className={`job-item ${job.status}`}>
                  <div className="job-info">
                    <h4>{job.inputFile}</h4>
                    <p>Slicer: {job.slicer}</p>
                    <p>Status: {job.status}</p>
                    {job.status === 'running' && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${job.progress}%` }}
                        />
                        <span className="progress-text">{job.progress}%</span>
                      </div>
                    )}
                  </div>
                  <div className="job-actions">
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="cancel-button"
                        title="Cancel Job"
                      >
                        <FaStop />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Sliced Files */}
        <div className="control-section files-section">
          <h2>Sliced Files</h2>
          <div className="files-list">
            {slicedFiles.map((file) => (
              <div key={file.path} className="file-item">
                <div className="file-info">
                  <h4>{file.name}</h4>
                  <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Created: {new Date(file.created).toLocaleDateString()}</p>
                </div>
                <div className="file-actions">
                  <button
                    onClick={() => handleAnalyzeFile(file.path)}
                    className="analyze-button"
                    title="Analyze G-code"
                  >
                    <FaEye />
                  </button>
                  <button
                    onClick={() => handleSendToPrinter(file.path)}
                    className="print-button"
                    title="Send to Printer"
                  >
                    <FaUpload />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.path)}
                    className="delete-button"
                    title="Delete File"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* G-code Analysis Modal */}
      {showAnalysis && analysisData && (
        <div className="modal-overlay" onClick={() => setShowAnalysis(false)}>
          <div className="modal-content analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>G-code Analysis</h2>
              <button onClick={() => setShowAnalysis(false)} className="close-button">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="analysis-grid">
                <div className="analysis-item">
                  <FaClock />
                  <label>Print Time:</label>
                  <span>{analysisData.estimatedPrintTime}</span>
                </div>
                <div className="analysis-item">
                  <FaWeight />
                  <label>Filament Used:</label>
                  <span>{analysisData.filamentUsed}</span>
                </div>
                <div className="analysis-item">
                  <FaLayerGroup />
                  <label>Layer Count:</label>
                  <span>{analysisData.layerCount}</span>
                </div>
                <div className="analysis-item">
                  <FaThermometerHalf />
                  <label>Temperature:</label>
                  <span>{analysisData.temperature}</span>
                </div>
                <div className="analysis-item">
                  <FaThermometerHalf />
                  <label>Bed Temperature:</label>
                  <span>{analysisData.bedTemperature}</span>
                </div>
                <div className="analysis-item">
                  <FaCog />
                  <label>Generated By:</label>
                  <span>{analysisData.generatedBy}</span>
                </div>
              </div>
              <div className="file-details">
                <p><strong>File:</strong> {analysisData.filePath}</p>
                <p><strong>Size:</strong> {(analysisData.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Lines:</strong> {analysisData.lineCount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* File Browser Modal */}
      {showFileBrowser && (
        <div className="modal-overlay" onClick={() => setShowFileBrowser(false)}>
          <div className="modal-content file-browser-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select 3D Model File</h2>
              <button onClick={() => setShowFileBrowser(false)} className="close-button">
                ×
              </button>
            </div>
            <div className="modal-body">
              {browsedFiles.length > 0 ? (
                <div className="file-list">
                  {browsedFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="file-browser-item"
                      onClick={() => {
                        setSelectedFiles([file.path]);
                        setShowFileBrowser(false);
                      }}
                    >
                      <div className="file-info">
                        <h4>{file.name}</h4>
                        <p>{file.path}</p>
                        <p className="file-meta">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • 
                          Modified: {new Date(file.modified).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No files found. Try browsing in a different directory.</p>
              )}
              <div className="browse-actions">
                <button 
                  onClick={() => {
                    sendCommand('unified-slicer', 'browse3DFiles', {});
                  }}
                  className="browse-button"
                >
                  Browse Documents Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlicerControlPage;