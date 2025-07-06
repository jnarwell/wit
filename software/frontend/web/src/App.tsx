import React, { useState, useEffect } from 'react';
import './App.css';

interface Machine {
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
}

interface Project {
  name: string;
  status: string;
}

interface Activity {
  time: string;
  action: string;
  status: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('HOME');
  const [voiceInput, setVoiceInput] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Overflow prevention
  useEffect(() => {
    const preventOverflow = () => {
      // Ensure html and body stay contained
      document.documentElement.style.cssText = 'overflow: hidden !important; width: 100vw !important;';
      document.body.style.cssText = 'overflow: hidden !important; width: 100vw !important;';
      
      // Hide any injected elements
      const bodyChildren = Array.from(document.body.children);
      bodyChildren.forEach(child => {
        if (child.id !== 'root' && 
            child.tagName !== 'SCRIPT' && 
            child.tagName !== 'NOSCRIPT') {
          (child as HTMLElement).style.cssText = 
            'display: none !important; position: absolute !important; left: -99999px !important;';
        }
      });
    };

    // Run prevention
    preventOverflow();
    const interval = setInterval(preventOverflow, 1000);

    // Monitor for DOM changes
    const observer = new MutationObserver(preventOverflow);
    observer.observe(document.body, { childList: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  // Sample data
  const projects: Project[] = [
    { name: 'KEYBOARD_BUILD', status: 'ACTIVE' },
    { name: 'ROBOT_ARM', status: 'PLANNING' },
  ];

  const machines: Machine[] = [
    { name: 'PRUSA_MK3S', status: 'ONLINE' },
    { name: 'CNC_ROUTER', status: 'OFFLINE' },
    { name: 'LASER_CUTTER', status: 'BUSY' },
    { name: 'RESIN_PRINTER', status: 'ONLINE' },
    { name: 'VINYL_CUTTER', status: 'ONLINE' },
  ];

  const recentActivity: Activity[] = [
    { time: '14:23:45', action: 'System initialized', status: 'Complete' },
    { time: '14:22:10', action: 'Print job started', status: 'In Progress' },
    { time: '14:20:33', action: 'CNC maintenance', status: 'Scheduled' },
  ];

  // Handlers
  const handleVoiceCommand = () => {
    if (voiceInput.trim()) {
      console.log('Voice command:', voiceInput);
      setVoiceInput('');
    }
  };

  const handleRecordToggle = () => {
    setIsRecording(!isRecording);
    console.log(isRecording ? 'Stopped recording' : 'Started recording');
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span role="img" aria-label="Robot">🤖</span>
            <span>W.I.T. TERMINAL</span>
          </div>
          
          <nav className="nav-tabs" role="navigation">
            {['HOME', 'MACHINES', 'SENSORS', 'PROJECTS'].map((tab) => (
              <button
                key={tab}
                className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'HOME' && (
          <>
            {/* Project Status */}
            <section className="block">
              <div className="block-header">
                <span>📁</span>
                <h2 className="block-title">PROJECT STATUS</h2>
              </div>
              
              <ul className="item-list">
                {projects.map((project, idx) => (
                  <li key={idx} className="list-item">
                    <span className="text-truncate">{project.name}</span>
                    <span className="status">{project.status}</span>
                  </li>
                ))}
              </ul>
              
              <button 
                className="btn mt-4" 
                type="button"
                onClick={() => setActiveTab('PROJECTS')}
              >
                VIEW ALL PROJECT STATUS →
              </button>
            </section>

            {/* Voice Interface */}
            <section className="block">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '700' }}>
                W.I.T.
              </h2>
              
              <div className="voice-section">
                <div className="voice-text">
                  <div>INTERACTIVE</div>
                  <div>VOICE</div>
                  <div>CIRCLE</div>
                </div>
                
                <div className="input-group">
                  <button 
                    className={`btn icon-btn ${isRecording ? 'recording' : ''}`}
                    type="button"
                    onClick={handleRecordToggle}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                  <input 
                    type="text" 
                    className="input"
                    placeholder="SPEAK OR TYPE COMMAND"
                    value={voiceInput}
                    onChange={(e) => setVoiceInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleVoiceCommand();
                      }
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Machine Status */}
            <section className="block">
              <div className="block-header">
                <span>⚙️</span>
                <h2 className="block-title">MACHINE STATUS</h2>
              </div>
              
              <div className="status-grid">
                {machines.map((machine, idx) => (
                  <div key={idx} className="status-item">
                    <span className="text-truncate">{machine.name}</span>
                    <span className={`status status-${machine.status.toLowerCase()}`}>
                      {machine.status}
                    </span>
                  </div>
                ))}
              </div>
              
              <button 
                className="btn mt-4" 
                type="button"
                onClick={() => setActiveTab('MACHINES')}
              >
                VIEW ALL MACHINE STATUS →
              </button>
            </section>

            {/* Recent Activity */}
            <section className="block">
              <div className="block-header">
                <h2 className="block-title">RECENT ACTIVITY</h2>
              </div>
              
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>TIME</th>
                      <th>ACTION</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity, idx) => (
                      <tr key={idx}>
                        <td className="text-mono">{activity.time}</td>
                        <td className="text-truncate">{activity.action}</td>
                        <td>{activity.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === 'MACHINES' && (
          <section className="block">
            <div className="block-header">
              <span>⚙️</span>
              <h2 className="block-title">ALL MACHINES</h2>
            </div>
            <div className="empty-state">
              <div className="empty-state-icon">🔧</div>
              <p className="empty-state-text">Machine management interface coming soon</p>
            </div>
          </section>
        )}

        {activeTab === 'SENSORS' && (
          <section className="block">
            <div className="block-header">
              <span>📡</span>
              <h2 className="block-title">SENSOR DATA</h2>
            </div>
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p className="empty-state-text">Sensor monitoring interface coming soon</p>
            </div>
          </section>
        )}

        {activeTab === 'PROJECTS' && (
          <section className="block">
            <div className="block-header">
              <span>📁</span>
              <h2 className="block-title">ALL PROJECTS</h2>
            </div>
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p className="empty-state-text">Project management interface coming soon</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;