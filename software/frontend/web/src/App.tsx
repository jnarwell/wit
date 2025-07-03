import React, { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState<string>('Connecting...');
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Try connecting to backend
    const connectToBackend = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/system/health', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors', // Explicitly set CORS mode
        });

        if (response.ok) {
          const data = await response.json();
          setApiHealth(data);
          setStatus('Connected to W.I.T. Backend ✅');
          setError('');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (err) {
        console.error('Connection error:', err);
        setStatus('Failed to connect to backend ❌');
        setError('Make sure the backend is running on http://localhost:8000');
      }
    };

    connectToBackend();
    
    // Retry every 5 seconds if disconnected
    const interval = setInterval(() => {
      if (!apiHealth) {
        connectToBackend();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [apiHealth]);

  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#0f0f0f',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>
        W.I.T. Terminal Web Interface
      </h1>
      
      <div style={{
        padding: '20px',
        backgroundColor: status.includes('✅') ? '#065f46' : '#7f1d1d',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <p style={{ fontSize: '1.2rem', margin: 0 }}>
          Status: {status}
        </p>
        {error && (
          <p style={{ fontSize: '0.9rem', margin: '10px 0 0 0', opacity: 0.8 }}>
            {error}
          </p>
        )}
      </div>
      
      {apiHealth && (
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: '#1f2937', 
          borderRadius: '10px',
          border: '1px solid #374151'
        }}>
          <h3>Backend Health:</h3>
          <pre style={{ color: '#10b981', overflow: 'auto' }}>
            {JSON.stringify(apiHealth, null, 2)}
          </pre>
        </div>
      )}

      {!apiHealth && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#1f2937',
          borderRadius: '10px',
          border: '1px solid #374151'
        }}>
          <h3>Troubleshooting:</h3>
          <ol style={{ lineHeight: '2' }}>
            <li>Make sure the backend is running: <code>python3 minimal_backend.py</code></li>
            <li>Check that it's accessible at: <a href="http://localhost:8000/docs" target="_blank" style={{ color: '#60a5fa' }}>http://localhost:8000/docs</a></li>
            <li>If still having issues, check the browser console for errors</li>
          </ol>
        </div>
      )}

      <div style={{ marginTop: '40px' }}>
        <h3 style={{ marginBottom: '20px' }}>Quick Actions:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <button 
            disabled={!apiHealth}
            style={{
              padding: '15px 25px',
              backgroundColor: apiHealth ? '#3b82f6' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: apiHealth ? 'pointer' : 'not-allowed',
              opacity: apiHealth ? 1 : 0.5,
              transition: 'all 0.2s'
            }}>
            🎙️ Voice Control
          </button>
          <button 
            disabled={!apiHealth}
            style={{
              padding: '15px 25px',
              backgroundColor: apiHealth ? '#8b5cf6' : '#4b5563',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: apiHealth ? 'pointer' : 'not-allowed',
              opacity: apiHealth ? 1 : 0.5,
              transition: 'all 0.2s'
            }}>
            👁️ Vision Monitor
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;