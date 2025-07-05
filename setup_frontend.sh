#!/bin/bash

# W.I.T. Frontend Setup Script
# Sets up and starts the frontend on port 3000

echo "🎨 W.I.T. Frontend Setup"
echo "========================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -d "software/frontend" ]; then
    echo -e "${RED}❌ Error: software/frontend directory not found${NC}"
    echo "Please run this from the wit project root"
    exit 1
fi

# Navigate to frontend directory
cd software/frontend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  No package.json found. Creating React + Vite frontend...${NC}"
    
    # Create a basic React + Vite setup
    npm create vite@latest . --template react-ts -- --yes
    
    # Install additional dependencies
    npm install axios react-router-dom socket.io-client
    npm install -D @types/react @types/react-dom tailwindcss autoprefixer postcss
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Create basic frontend structure if it doesn't exist
if [ ! -f "src/App.tsx" ] && [ ! -f "src/App.jsx" ]; then
    echo -e "${BLUE}Creating basic frontend files...${NC}"
    
    # Create src directory
    mkdir -p src/components src/services src/hooks
    
    # Create index.html
    cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>W.I.T. - Workshop Integrated Terminal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

    # Create main.tsx
    cat > src/main.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

    # Create App.tsx
    cat > src/App.tsx << 'EOF'
import { useState, useEffect } from 'react'
import { VoiceControl } from './components/VoiceControl'
import { StatusDashboard } from './components/StatusDashboard'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check API status
    fetch('http://localhost:8000/')
      .then(res => res.json())
      .then(data => {
        setApiStatus(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('API not available:', err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 W.I.T. - Workshop Integrated Terminal</h1>
        <p>Voice-Controlled Workshop Assistant</p>
      </header>
      
      <main>
        {loading ? (
          <div>Connecting to API...</div>
        ) : apiStatus ? (
          <>
            <StatusDashboard status={apiStatus} />
            <VoiceControl />
          </>
        ) : (
          <div className="error">
            ❌ Cannot connect to API. Make sure the server is running on port 8000.
          </div>
        )}
      </main>
    </div>
  )
}

export default App
EOF

    # Create VoiceControl component
    cat > src/components/VoiceControl.tsx << 'EOF'
import { useState } from 'react'

export function VoiceControl() {
  const [command, setCommand] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const sendCommand = async () => {
    if (!command.trim()) return
    
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/v1/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: command })
      })
      const data = await res.json()
      setResponse(data)
    } catch (err) {
      console.error('Error:', err)
      setResponse({ error: 'Failed to send command' })
    }
    setLoading(false)
  }

  return (
    <div className="voice-control">
      <h2>🎤 Voice Command</h2>
      <div className="command-input">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
          placeholder="Type a command (e.g., 'Start the 3D printer')"
          disabled={loading}
        />
        <button onClick={sendCommand} disabled={loading}>
          {loading ? 'Processing...' : 'Send'}
        </button>
      </div>
      
      {response && (
        <div className="response">
          <h3>Response:</h3>
          <div className="intent">Intent: {response.intent}</div>
          <div className="message">{response.response || response.error}</div>
          {response.entities && (
            <details>
              <summary>Details</summary>
              <pre>{JSON.stringify(response.entities, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
EOF

    # Create StatusDashboard component
    cat > src/components/StatusDashboard.tsx << 'EOF'
export function StatusDashboard({ status }: { status: any }) {
  return (
    <div className="status-dashboard">
      <h2>📊 API Status</h2>
      <div className="status-grid">
        <div className="status-item">
          <span>Voice API:</span>
          <span className={status.apis?.voice?.status === 'loaded' ? 'active' : 'inactive'}>
            {status.apis?.voice?.status || 'unknown'}
          </span>
        </div>
        <div className="status-item">
          <span>Memory API:</span>
          <span className={status.apis?.memory?.status === 'loaded' ? 'active' : 'inactive'}>
            {status.apis?.memory?.status || 'unknown'}
          </span>
        </div>
      </div>
    </div>
  )
}
EOF

    # Create basic CSS
    cat > src/index.css << 'EOF'
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a0a;
  color: #ffffff;
  line-height: 1.6;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
EOF

    cat > src/App.css << 'EOF'
.App {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.App-header {
  text-align: center;
  margin-bottom: 3rem;
}

.App-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.voice-control {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.command-input {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.command-input input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #333;
  border-radius: 6px;
  background: #0a0a0a;
  color: white;
  font-size: 1rem;
}

.command-input button {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.command-input button:hover:not(:disabled) {
  background: #2563eb;
}

.command-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.response {
  margin-top: 2rem;
  padding: 1rem;
  background: #0a0a0a;
  border-radius: 6px;
  border: 1px solid #333;
}

.response .intent {
  color: #8b5cf6;
  margin-bottom: 0.5rem;
}

.status-dashboard {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #0a0a0a;
  border-radius: 6px;
  border: 1px solid #333;
}

.active {
  color: #10b981;
  font-weight: bold;
}

.inactive {
  color: #ef4444;
}

.error {
  background: #ef4444;
  color: white;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
}

details {
  margin-top: 1rem;
}

details summary {
  cursor: pointer;
  color: #8b5cf6;
}

details pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #0a0a0a;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.875rem;
}
EOF

fi

# Create Tailwind config if it doesn't exist
if [ ! -f "tailwind.config.js" ]; then
    cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF
fi

# Update vite.config if needed
if [ ! -f "vite.config.ts" ] && [ ! -f "vite.config.js" ]; then
    cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    open: true
  }
})
EOF
fi

echo -e "\n${GREEN}✅ Frontend setup complete!${NC}"
echo -e "\n${BLUE}Starting frontend on port 3000...${NC}"
echo -e "${YELLOW}Make sure your API server is running on port 8000${NC}\n"

# Start the development server
npm run dev -- --port 3000 --host