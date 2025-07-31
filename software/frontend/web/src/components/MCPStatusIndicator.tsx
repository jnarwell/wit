import React, { useState, useEffect } from 'react';
import { FaServer, FaExclamationTriangle, FaCheckCircle, FaSync } from 'react-icons/fa';

interface MCPStatus {
  connected: boolean;
  lastSync: Date | null;
  activeModels: number;
  dataTransferred: number; // in KB
  errors: number;
}

const MCPStatusIndicator: React.FC = () => {
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [status, setStatus] = useState<MCPStatus>({
    connected: false,
    lastSync: null,
    activeModels: 0,
    dataTransferred: 0,
    errors: 0,
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if MCP is enabled
    const settings = localStorage.getItem('wit-mcp-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setMcpEnabled(parsed.enabled);
      
      // Simulate status updates
      if (parsed.enabled) {
        const interval = setInterval(() => {
          setStatus(prev => ({
            connected: Math.random() > 0.1,
            lastSync: new Date(),
            activeModels: Math.floor(Math.random() * 3) + 1,
            dataTransferred: prev.dataTransferred + Math.random() * 10,
            errors: Math.random() > 0.9 ? prev.errors + 1 : prev.errors,
          }));
        }, 5000);

        return () => clearInterval(interval);
      }
    }
  }, []);

  if (!mcpEnabled) return null;

  const getStatusColor = () => {
    if (!status.connected) return 'text-red-400';
    if (status.errors > 0) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatDataSize = (kb: number) => {
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatLastSync = () => {
    if (!status.lastSync) return 'Never';
    const diff = Date.now() - status.lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all ${getStatusColor()}`}
      >
        <FaServer size={16} />
        <span className="text-sm font-medium">MCP</span>
        {status.connected && status.activeModels > 0 && (
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">
            {status.activeModels}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-4 z-50">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <FaServer />
            MCP Status
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Connection</span>
              <span className={`flex items-center gap-1 ${getStatusColor()}`}>
                {status.connected ? (
                  <>
                    <FaCheckCircle size={14} />
                    Connected
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle size={14} />
                    Disconnected
                  </>
                )}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Active Models</span>
              <span className="text-white">{status.activeModels}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Last Sync</span>
              <span className="text-white flex items-center gap-1">
                <FaSync size={12} />
                {formatLastSync()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Data Transferred</span>
              <span className="text-white">{formatDataSize(status.dataTransferred)}</span>
            </div>
            
            {status.errors > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Errors</span>
                <span className="text-yellow-400">{status.errors}</span>
              </div>
            )}
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => {
                window.location.hash = '#settings/mcp';
                setShowDetails(false);
              }}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Configure MCP Settings →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPStatusIndicator;