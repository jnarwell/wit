import React, { useState, useEffect } from 'react';
import { FaDocker, FaPlay, FaStop, FaPause, FaTrash, FaDownload, FaUpload, FaHammer, FaTimes, FaTerminal, FaCog, FaSearch, FaPlus, FaEye, FaCode, FaNetworkWired, FaDatabase, FaLayerGroup, FaBoxes, FaProjectDiagram } from 'react-icons/fa';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './DockerControlPage.css';

interface DockerControlPageProps {
  onClose: () => void;
}

interface DockerContainer {
  id: string;
  image: string;
  command: string;
  created: string;
  status: string;
  ports: string;
  names: string;
}

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  created: string;
  size: string;
}

interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

interface DockerVolume {
  driver: string;
  name: string;
}

interface DockerStatus {
  dockerInstalled: boolean;
  dockerDesktopInstalled: boolean;
  dockerPath: string;
  dockerDesktopPath: string;
  config: any;
}

const DockerControlPage: React.FC<DockerControlPageProps> = ({ onClose }) => {
  const { sendCommand, lastMessage, wsStatus } = useUDCWebSocket();
  const [activeTab, setActiveTab] = useState('containers');
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Container management modals
  const [showCreateContainer, setShowCreateContainer] = useState(false);
  const [showContainerLogs, setShowContainerLogs] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [containerLogs, setContainerLogs] = useState('');

  // Image management modals
  const [showPullImage, setShowPullImage] = useState(false);
  const [showBuildImage, setShowBuildImage] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [buildConfig, setBuildConfig] = useState({
    imageName: '',
    dockerfilePath: '',
    buildContext: '.',
    buildArgs: ['']
  });

  // Container creation form
  const [newContainer, setNewContainer] = useState({
    image: '',
    name: '',
    ports: [''],
    volumes: [''],
    environment: [''],
    command: ''
  });

  // Wait for WebSocket connection before loading data
  useEffect(() => {
    if (wsStatus === 'connected' && !isInitialized) {
      setIsInitialized(true);
      loadStatus();
      loadContainers();
      loadImages();
      loadNetworks();
      loadVolumes();
    }
  }, [wsStatus, isInitialized]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'plugin_response' && lastMessage?.pluginId === 'docker') {
      handlePluginResponse(lastMessage);
    }
  }, [lastMessage]);

  const handlePluginResponse = (message: any) => {
    if (message.error) {
      setError(message.error);
      setLoading(false);
      return;
    }

    switch (message.command) {
      case 'getStatus':
        setStatus(message.result);
        setLoading(false);
        break;
      case 'listContainers':
        if (message.result.success) {
          setContainers(message.result.containers || []);
        }
        break;
      case 'listImages':
        if (message.result.success) {
          setImages(message.result.images || []);
        }
        break;
      case 'listNetworks':
        if (message.result.success) {
          setNetworks(message.result.networks || []);
        }
        break;
      case 'listVolumes':
        if (message.result.success) {
          setVolumes(message.result.volumes || []);
        }
        break;
      case 'getContainerLogs':
        if (message.result.success) {
          setContainerLogs(message.result.logs);
          setShowContainerLogs(true);
        }
        break;
      case 'createContainer':
      case 'startContainer':
      case 'stopContainer':
      case 'restartContainer':
      case 'removeContainer':
        if (message.result.success) {
          loadContainers(); // Refresh containers list
        }
        break;
      case 'pullImage':
      case 'buildImage':
      case 'removeImage':
        if (message.result.success) {
          loadImages(); // Refresh images list
          if (message.command === 'pullImage') {
            setShowPullImage(false);
            setPullImageName('');
          } else if (message.command === 'buildImage') {
            setShowBuildImage(false);
            setBuildConfig({
              imageName: '',
              dockerfilePath: '',
              buildContext: '.',
              buildArgs: ['']
            });
          }
        }
        break;
    }
  };

  const loadStatus = async () => {
    if (wsStatus !== 'connected') {
      console.log('WebSocket not connected, skipping status load');
      return;
    }
    try {
      await sendCommand('docker', 'getStatus');
    } catch (error) {
      console.error('Failed to get status:', error);
      setError('Failed to get Docker status. Please check if plugin is running.');
      setLoading(false);
    }
  };

  const loadContainers = async () => {
    if (wsStatus !== 'connected') return;
    try {
      await sendCommand('docker', 'listContainers', { all: true });
    } catch (error) {
      console.error('Failed to load containers:', error);
    }
  };

  const loadImages = async () => {
    if (wsStatus !== 'connected') return;
    try {
      await sendCommand('docker', 'listImages');
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const loadNetworks = async () => {
    if (wsStatus !== 'connected') return;
    try {
      await sendCommand('docker', 'listNetworks');
    } catch (error) {
      console.error('Failed to load networks:', error);
    }
  };

  const loadVolumes = async () => {
    if (wsStatus !== 'connected') return;
    try {
      await sendCommand('docker', 'listVolumes');
    } catch (error) {
      console.error('Failed to load volumes:', error);
    }
  };

  const handleLaunchDocker = async () => {
    try {
      await sendCommand('docker', 'launch');
    } catch (error) {
      setError('Failed to launch Docker Desktop');
    }
  };

  const handleContainerAction = async (action: string, containerId: string) => {
    try {
      await sendCommand('docker', action, { containerId });
    } catch (error) {
      setError(`Failed to ${action} container`);
    }
  };

  const handleViewLogs = async (container: DockerContainer) => {
    setSelectedContainer(container);
    try {
      await sendCommand('docker', 'getContainerLogs', { 
        containerId: container.id,
        tail: 100 
      });
    } catch (error) {
      setError('Failed to get container logs');
    }
  };

  const handleCreateContainer = async () => {
    if (!newContainer.image) {
      setError('Image name is required');
      return;
    }

    try {
      await sendCommand('docker', 'createContainer', {
        image: newContainer.image,
        name: newContainer.name || undefined,
        ports: newContainer.ports.filter(p => p.trim()),
        volumes: newContainer.volumes.filter(v => v.trim()),
        environment: newContainer.environment.filter(e => e.trim()),
        command: newContainer.command || undefined
      });
      setShowCreateContainer(false);
      setNewContainer({
        image: '',
        name: '',
        ports: [''],
        volumes: [''],
        environment: [''],
        command: ''
      });
    } catch (error) {
      setError('Failed to create container');
    }
  };

  const handlePullImage = async () => {
    if (!pullImageName) {
      setError('Image name is required');
      return;
    }

    try {
      await sendCommand('docker', 'pullImage', { imageName: pullImageName });
    } catch (error) {
      setError('Failed to pull image');
    }
  };

  const handleBuildImage = async () => {
    if (!buildConfig.imageName) {
      setError('Image name is required');
      return;
    }

    try {
      await sendCommand('docker', 'buildImage', {
        imageName: buildConfig.imageName,
        dockerfilePath: buildConfig.dockerfilePath || undefined,
        buildContext: buildConfig.buildContext,
        buildArgs: buildConfig.buildArgs.filter(arg => arg.trim())
      });
    } catch (error) {
      setError('Failed to build image');
    }
  };

  const addArrayField = (field: keyof typeof newContainer, setter: React.Dispatch<React.SetStateAction<typeof newContainer>>) => {
    setter(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }));
  };

  const updateArrayField = (field: keyof typeof newContainer, index: number, value: string, setter: React.Dispatch<React.SetStateAction<typeof newContainer>>) => {
    setter(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }));
  };

  const removeArrayField = (field: keyof typeof newContainer, index: number, setter: React.Dispatch<React.SetStateAction<typeof newContainer>>) => {
    setter(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  // Show loading state while connecting
  if (wsStatus === 'connecting' || wsStatus === 'disconnected') {
    return (
      <div className="docker-control-page">
        <div className="page-header">
          <div className="header-left">
            <FaDocker className="page-icon" />
            <div>
              <h1>Docker Desktop Control</h1>
              <p>Container management and orchestration platform</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
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

  // Show error state if connection failed
  if (wsStatus === 'failed') {
    return (
      <div className="docker-control-page">
        <div className="page-header">
          <div className="header-left">
            <FaDocker className="page-icon" />
            <div>
              <h1>Docker Desktop Control</h1>
              <p>Connection failed</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>
        <div className="error-message">
          <p>Failed to connect to desktop controller. Please ensure the Universal Desktop Controller is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="docker-control-page">
      <div className="page-header">
        <div className="header-left">
          <FaDocker className="page-icon" />
          <div>
            <h1>Docker Desktop Control</h1>
            <p>Container management and orchestration platform</p>
          </div>
        </div>
        <button onClick={onClose} className="close-button">
          <FaTimes />
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Docker:</span>
          <span className={`status-value ${status?.dockerInstalled ? 'active' : 'inactive'}`}>
            {status?.dockerInstalled ? 'Installed' : 'Not Found'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Docker Desktop:</span>
          <span className={`status-value ${status?.dockerDesktopInstalled ? 'active' : 'inactive'}`}>
            {status?.dockerDesktopInstalled ? 'Available' : 'Not Found'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Containers:</span>
          <span className="status-value">{containers.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Images:</span>
          <span className="status-value">{images.length}</span>
        </div>
      </div>

      <div className="quick-actions">
        <button className="action-button" onClick={handleLaunchDocker}>
          <FaPlay />
          <span>Launch Docker</span>
        </button>
        <button className="action-button" onClick={() => setShowCreateContainer(true)}>
          <FaPlus />
          <span>Create Container</span>
        </button>
        <button className="action-button" onClick={() => setShowPullImage(true)}>
          <FaDownload />
          <span>Pull Image</span>
        </button>
        <button className="action-button" onClick={() => setShowBuildImage(true)}>
          <FaHammer />
          <span>Build Image</span>
        </button>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'containers' ? 'active' : ''}`}
          onClick={() => setActiveTab('containers')}
        >
          <FaBoxes /> Containers ({containers.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          <FaLayerGroup /> Images ({images.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'networks' ? 'active' : ''}`}
          onClick={() => setActiveTab('networks')}
        >
          <FaNetworkWired /> Networks ({networks.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'volumes' ? 'active' : ''}`}
          onClick={() => setActiveTab('volumes')}
        >
          <FaDatabase /> Volumes ({volumes.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'containers' && (
          <div className="containers-tab">
            {containers.length === 0 ? (
              <div className="empty-state">
                <FaBoxes className="empty-icon" />
                <p>No containers found</p>
                <p>Create a new container to get started with Docker development.</p>
              </div>
            ) : (
              <div className="containers-list">
                {containers.map((container) => (
                  <div key={container.id} className="container-item">
                    <div className="container-info">
                      <h4>{container.names}</h4>
                      <p><strong>Image:</strong> {container.image}</p>
                      <p><strong>Status:</strong> <span className={`status ${container.status.includes('Up') ? 'running' : 'stopped'}`}>{container.status}</span></p>
                      <p><strong>Ports:</strong> {container.ports}</p>
                      <p><strong>Created:</strong> {container.created}</p>
                    </div>
                    <div className="container-actions">
                      {container.status.includes('Up') ? (
                        <button onClick={() => handleContainerAction('stopContainer', container.id)} className="action-btn stop">
                          <FaStop /> Stop
                        </button>
                      ) : (
                        <button onClick={() => handleContainerAction('startContainer', container.id)} className="action-btn start">
                          <FaPlay /> Start
                        </button>
                      )}
                      <button onClick={() => handleContainerAction('restartContainer', container.id)} className="action-btn restart">
                        <FaPause /> Restart
                      </button>
                      <button onClick={() => handleViewLogs(container)} className="action-btn logs">
                        <FaEye /> Logs
                      </button>
                      <button onClick={() => handleContainerAction('removeContainer', container.id)} className="action-btn remove">
                        <FaTrash /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <div className="images-tab">
            {images.length === 0 ? (
              <div className="empty-state">
                <FaLayerGroup className="empty-icon" />
                <p>No images found</p>
                <p>Pull an image from a registry or build one from a Dockerfile.</p>
              </div>
            ) : (
              <div className="images-list">
                {images.map((image) => (
                  <div key={image.id} className="image-item">
                    <div className="image-info">
                      <h4>{image.repository}:{image.tag}</h4>
                      <p><strong>Image ID:</strong> {image.id}</p>
                      <p><strong>Created:</strong> {image.created}</p>
                      <p><strong>Size:</strong> {image.size}</p>
                    </div>
                    <div className="image-actions">
                      <button onClick={() => handleContainerAction('removeImage', image.id)} className="action-btn remove">
                        <FaTrash /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'networks' && (
          <div className="networks-tab">
            {networks.length === 0 ? (
              <div className="empty-state">
                <FaNetworkWired className="empty-icon" />
                <p>No networks found</p>
                <p>Docker networks will appear here when available.</p>
              </div>
            ) : (
              <div className="networks-list">
                {networks.map((network) => (
                  <div key={network.id} className="network-item">
                    <div className="network-info">
                      <h4>{network.name}</h4>
                      <p><strong>Driver:</strong> {network.driver}</p>
                      <p><strong>Scope:</strong> {network.scope}</p>
                      <p><strong>Network ID:</strong> {network.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'volumes' && (
          <div className="volumes-tab">
            {volumes.length === 0 ? (
              <div className="empty-state">
                <FaDatabase className="empty-icon" />
                <p>No volumes found</p>
                <p>Docker volumes will appear here when created.</p>
              </div>
            ) : (
              <div className="volumes-list">
                {volumes.map((volume) => (
                  <div key={volume.name} className="volume-item">
                    <div className="volume-info">
                      <h4>{volume.name}</h4>
                      <p><strong>Driver:</strong> {volume.driver}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Container Modal */}
      {showCreateContainer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Container</h3>
              <button onClick={() => setShowCreateContainer(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Image Name</label>
                <input
                  type="text"
                  value={newContainer.image}
                  onChange={(e) => setNewContainer({ ...newContainer, image: e.target.value })}
                  placeholder="e.g., nginx:alpine"
                />
              </div>
              <div className="form-group">
                <label>Container Name (optional)</label>
                <input
                  type="text"
                  value={newContainer.name}
                  onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                  placeholder="e.g., my-nginx-container"
                />
              </div>
              <div className="form-group">
                <label>Port Mappings</label>
                {newContainer.ports.map((port, index) => (
                  <div key={index} className="array-field">
                    <input
                      type="text"
                      value={port}
                      onChange={(e) => updateArrayField('ports', index, e.target.value, setNewContainer)}
                      placeholder="e.g., 8080:80"
                    />
                    {newContainer.ports.length > 1 && (
                      <button onClick={() => removeArrayField('ports', index, setNewContainer)}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addArrayField('ports', setNewContainer)} className="add-field">+ Add Port</button>
              </div>
              <div className="form-group">
                <label>Volume Mounts</label>
                {newContainer.volumes.map((volume, index) => (
                  <div key={index} className="array-field">
                    <input
                      type="text"
                      value={volume}
                      onChange={(e) => updateArrayField('volumes', index, e.target.value, setNewContainer)}
                      placeholder="e.g., ./data:/app/data"
                    />
                    {newContainer.volumes.length > 1 && (
                      <button onClick={() => removeArrayField('volumes', index, setNewContainer)}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addArrayField('volumes', setNewContainer)} className="add-field">+ Add Volume</button>
              </div>
              <div className="form-group">
                <label>Environment Variables</label>
                {newContainer.environment.map((env, index) => (
                  <div key={index} className="array-field">
                    <input
                      type="text"
                      value={env}
                      onChange={(e) => updateArrayField('environment', index, e.target.value, setNewContainer)}
                      placeholder="e.g., NODE_ENV=production"
                    />
                    {newContainer.environment.length > 1 && (
                      <button onClick={() => removeArrayField('environment', index, setNewContainer)}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addArrayField('environment', setNewContainer)} className="add-field">+ Add Environment Variable</button>
              </div>
              <div className="form-group">
                <label>Command (optional)</label>
                <input
                  type="text"
                  value={newContainer.command}
                  onChange={(e) => setNewContainer({ ...newContainer, command: e.target.value })}
                  placeholder="e.g., npm start"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateContainer(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleCreateContainer} className="primary-button">
                Create Container
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull Image Modal */}
      {showPullImage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Pull Docker Image</h3>
              <button onClick={() => setShowPullImage(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Image Name</label>
                <input
                  type="text"
                  value={pullImageName}
                  onChange={(e) => setPullImageName(e.target.value)}
                  placeholder="e.g., nginx:alpine, node:18, postgres:13"
                />
                <small>Enter the image name and tag to pull from the registry</small>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPullImage(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handlePullImage} className="primary-button">
                Pull Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Build Image Modal */}
      {showBuildImage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Build Docker Image</h3>
              <button onClick={() => setShowBuildImage(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Image Name</label>
                <input
                  type="text"
                  value={buildConfig.imageName}
                  onChange={(e) => setBuildConfig({ ...buildConfig, imageName: e.target.value })}
                  placeholder="e.g., my-app:latest"
                />
              </div>
              <div className="form-group">
                <label>Dockerfile Path (optional)</label>
                <input
                  type="text"
                  value={buildConfig.dockerfilePath}
                  onChange={(e) => setBuildConfig({ ...buildConfig, dockerfilePath: e.target.value })}
                  placeholder="e.g., ./Dockerfile"
                />
                <small>Leave empty to use default Dockerfile in build context</small>
              </div>
              <div className="form-group">
                <label>Build Context</label>
                <input
                  type="text"
                  value={buildConfig.buildContext}
                  onChange={(e) => setBuildConfig({ ...buildConfig, buildContext: e.target.value })}
                  placeholder="."
                />
                <small>Directory containing the Dockerfile and build files</small>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowBuildImage(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleBuildImage} className="primary-button">
                Build Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container Logs Modal */}
      {showContainerLogs && selectedContainer && (
        <div className="modal-overlay">
          <div className="modal-content logs-modal">
            <div className="modal-header">
              <h3>Container Logs - {selectedContainer.names}</h3>
              <button onClick={() => setShowContainerLogs(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <pre className="logs-content">{containerLogs}</pre>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowContainerLogs(false)} className="secondary-button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerControlPage;