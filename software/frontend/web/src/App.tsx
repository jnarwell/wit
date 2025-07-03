import React, { useState, useEffect } from 'react';
import './App.css';

// API base URL
const API_URL = 'http://localhost:8000';

interface SystemStatus {
  status: string;
  timestamp: string;
  services: {
    voice: boolean;
    vision: boolean;
    equipment: boolean;
  };
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy';
  current_job?: string;
}

function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'voice' | 'settings'>('dashboard');

  // Check backend connection
  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    try {
      // Make sure URL doesn't have trailing slash or :1
      const healthUrl = `${API_URL}/health`;
      console.log('Checking backend at:', healthUrl);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSystemStatus({
          status: data.status,
          timestamp: data.timestamp,
          services: {
            voice: true,
            vision: true,
            equipment: true
          }
        });
        setError(null);
      } else {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      setError('Cannot connect to backend. Make sure it\'s running on port 8000');
      setSystemStatus(null);
    }
  };

  // Mock equipment data for now
  useEffect(() => {
    if (systemStatus) {
      // Mock equipment until backend endpoint is ready
      setEquipment([
        { id: '1', name: 'Prusa MK3S', type: '3D Printer', status: 'online' },
        { id: '2', name: 'CNC Router', type: 'CNC Machine', status: 'offline' },
        { id: '3', name: 'Laser Cutter', type: 'Laser', status: 'online', current_job: 'Acrylic Panel Cut' }
      ]);
    }
  }, [systemStatus]);

  // Voice control simulation
  const toggleVoice = () => {
    if (!voiceActive) {
      setVoiceActive(true);
      setLastCommand('Listening...');
      // Simulate voice recognition
      setTimeout(() => {
        setLastCommand('Start the 3D printer');
        setVoiceActive(false);
      }, 3000);
    } else {
      setVoiceActive(false);
      setLastCommand('');
    }
  };

  const renderDashboard = () => (
    <div className="dashboard">
      <div className="status-grid">
        <div className="status-card">
          <h3>System Health</h3>
          <div className={`status-indicator ${systemStatus ? 'online' : 'offline'}`}>
            {systemStatus ? 'ONLINE' : 'OFFLINE'}
          </div>
          {systemStatus && <p className="timestamp">Last update: {new Date(systemStatus.timestamp).toLocaleTimeString()}</p>}
        </div>
        
        <div className="status-card">
          <h3>Active Equipment</h3>
          <div className="equipment-summary">
            <p>{equipment.filter(e => e.status === 'online').length} / {equipment.length} Online</p>
          </div>
        </div>

        <div className="status-card">
          <h3>Voice Control</h3>
          <div className={`voice-status ${voiceActive ? 'active' : 'inactive'}`}>
            {voiceActive ? 'LISTENING' : 'INACTIVE'}
          </div>
        </div>

        <div className="status-card">
          <h3>Safety Status</h3>
          <div className="safety-status safe">
            ALL CLEAR
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <ul>
          <li>🟢 System started - {new Date().toLocaleTimeString()}</li>
          <li>🔧 Prusa MK3S connected</li>
          <li>🎯 Laser Cutter job started</li>
        </ul>
      </div>
    </div>
  );

  const renderEquipment = () => (
    <div className="equipment-view">
      <h2>Workshop Equipment</h2>
      <div className="equipment-grid">
        {equipment.map(eq => (
          <div key={eq.id} className={`equipment-card ${eq.status}`}>
            <div className="equipment-header">
              <h3>{eq.name}</h3>
              <span className={`status-badge ${eq.status}`}>{eq.status.toUpperCase()}</span>
            </div>
            <p className="equipment-type">{eq.type}</p>
            {eq.current_job && (
              <div className="current-job">
                <p>Current Job:</p>
                <p className="job-name">{eq.current_job}</p>
              </div>
            )}
            <div className="equipment-actions">
              <button className="control-btn" disabled={eq.status === 'offline'}>
                Control
              </button>
              <button className="details-btn">Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderVoiceControl = () => (
    <div className="voice-control-view">
      <h2>Voice Control Center</h2>
      <div className="voice-main">
        <button 
          className={`voice-button ${voiceActive ? 'active' : ''}`}
          onClick={toggleVoice}
          disabled={!systemStatus}
        >
          <span className="mic-icon">{voiceActive ? '🎤' : '🎙️'}</span>
          <span className="voice-text">
            {voiceActive ? 'Listening...' : 'Click to Start Voice Control'}
          </span>
        </button>
        
        {lastCommand && (
          <div className="command-display">
            <h4>Last Command:</h4>
            <p>{lastCommand}</p>
          </div>
        )}

        <div className="voice-commands">
          <h4>Available Commands:</h4>
          <ul>
            <li>"Start the [equipment name]"</li>
            <li>"Stop all equipment"</li>
            <li>"What's the status?"</li>
            <li>"Emergency stop"</li>
            <li>"Show temperature"</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="settings-view">
      <h2>Settings</h2>
      <div className="settings-sections">
        <div className="settings-section">
          <h3>Network Configuration</h3>
          <p>Backend URL: {API_URL}</p>
          <p>WebSocket: Disconnected</p>
        </div>
        
        <div className="settings-section">
          <h3>Voice Settings</h3>
          <label>
            <input type="checkbox" defaultChecked /> Enable wake word detection
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Voice confirmations
          </label>
        </div>

        <div className="settings-section">
          <h3>Safety Settings</h3>
          <label>
            <input type="checkbox" defaultChecked /> Emergency stop enabled
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Vision monitoring
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>W.I.T. Terminal</h1>
        <p>Workshop Integrated Terminal Control Center</p>
      </header>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <nav className="main-nav">
        <button 
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${activeTab === 'equipment' ? 'active' : ''}`}
          onClick={() => setActiveTab('equipment')}
        >
          Equipment
        </button>
        <button 
          className={`nav-btn ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          Voice Control
        </button>
        <button 
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="App-main">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'equipment' && renderEquipment()}
        {activeTab === 'voice' && renderVoiceControl()}
        {activeTab === 'settings' && renderSettings()}
      </main>

      <footer className="App-footer">
        <div className="quick-actions">
          <button 
            className="emergency-stop"
            onClick={() => alert('Emergency Stop Activated!')}
          >
            🛑 EMERGENCY STOP
          </button>
        </div>
        <div className="footer-links">
          <a href={`${API_URL}/docs`} target="_blank" rel="noopener noreferrer">API Docs</a>
          <a href={`${API_URL}/dashboard/`} target="_blank" rel="noopener noreferrer">Simple Dashboard</a>
        </div>
      </footer>
    </div>
  );
}

export default App;