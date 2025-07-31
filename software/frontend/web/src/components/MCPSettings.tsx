import React, { useState, useEffect } from 'react';
import { FaTimes, FaServer, FaDatabase, FaCog, FaShieldAlt, FaSync, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

interface MCPSettings {
  enabled: boolean;
  serverUrl: string;
  apiKey: string;
  autoSync: boolean;
  syncInterval: number; // in minutes
  dataPermissions: {
    machines: boolean;
    projects: boolean;
    sensors: boolean;
    tasks: boolean;
    files: boolean;
    analytics: boolean;
    userProfile: boolean;
  };
  modelPermissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
    delete: boolean;
  };
  trustedModels: string[];
}

interface MCPSettingsProps {
  onClose: () => void;
}

const MCPSettingsComponent: React.FC<MCPSettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<MCPSettings>({
    enabled: false,
    serverUrl: '',
    apiKey: '',
    autoSync: false,
    syncInterval: 30,
    dataPermissions: {
      machines: false,
      projects: false,
      sensors: false,
      tasks: false,
      files: false,
      analytics: false,
      userProfile: false,
    },
    modelPermissions: {
      read: true,
      write: false,
      execute: false,
      delete: false,
    },
    trustedModels: [],
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [newTrustedModel, setNewTrustedModel] = useState('');

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('wit-mcp-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('wit-mcp-settings', JSON.stringify(settings));
    onClose();
  };

  const testConnection = async () => {
    if (!settings.serverUrl || !settings.apiKey) {
      setConnectionStatus('error');
      return;
    }

    setIsTestingConnection(true);
    // Simulate API call - in production, this would actually test the MCP server
    setTimeout(() => {
      setConnectionStatus(Math.random() > 0.3 ? 'success' : 'error');
      setIsTestingConnection(false);
    }, 1500);
  };

  const addTrustedModel = () => {
    if (newTrustedModel && !settings.trustedModels.includes(newTrustedModel)) {
      setSettings({
        ...settings,
        trustedModels: [...settings.trustedModels, newTrustedModel],
      });
      setNewTrustedModel('');
    }
  };

  const removeTrustedModel = (model: string) => {
    setSettings({
      ...settings,
      trustedModels: settings.trustedModels.filter(m => m !== model),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FaServer className="text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-white">MCP (Model Context Protocol) Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Enable MCP Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="w-5 h-5 rounded accent-blue-500"
              />
              <span className="text-lg font-medium text-white">Enable MCP Integration</span>
            </label>
            <p className="text-gray-400 text-sm mt-2 ml-8">
              Allow external AI models to access and interact with your WIT data through the Model Context Protocol
            </p>
          </div>

          {settings.enabled && (
            <>
              {/* Connection Settings */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaServer className="text-gray-400" />
                  Connection Settings
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">MCP Server URL</label>
                    <input
                      type="text"
                      value={settings.serverUrl}
                      onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                      placeholder="https://mcp.example.com"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="Enter your MCP API key"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={testConnection}
                      disabled={isTestingConnection}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                    >
                      {isTestingConnection ? (
                        <FaSync className="animate-spin" />
                      ) : connectionStatus === 'success' ? (
                        <FaCheck />
                      ) : connectionStatus === 'error' ? (
                        <FaExclamationTriangle />
                      ) : (
                        <FaServer />
                      )}
                      Test Connection
                    </button>
                    {connectionStatus === 'success' && (
                      <span className="text-green-400 text-sm">Connection successful!</span>
                    )}
                    {connectionStatus === 'error' && (
                      <span className="text-red-400 text-sm">Connection failed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Permissions */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaDatabase className="text-gray-400" />
                  Data Access Permissions
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Select which types of data external models can access
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(settings.dataPermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setSettings({
                          ...settings,
                          dataPermissions: {
                            ...settings.dataPermissions,
                            [key]: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                      <span className="text-white capitalize">{key}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Model Permissions */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaShieldAlt className="text-gray-400" />
                  Model Operation Permissions
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Define what operations external models can perform
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(settings.modelPermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setSettings({
                          ...settings,
                          modelPermissions: {
                            ...settings.modelPermissions,
                            [key]: e.target.checked,
                          },
                        })}
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                      <span className="text-white capitalize">{key} Access</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Trusted Models */}
              <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaCog className="text-gray-400" />
                  Trusted AI Models
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Add specific model identifiers that are allowed to access your data
                </p>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTrustedModel}
                    onChange={(e) => setNewTrustedModel(e.target.value)}
                    placeholder="e.g., gpt-4, claude-3, llama-2"
                    className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
                    onKeyPress={(e) => e.key === 'Enter' && addTrustedModel()}
                  />
                  <button
                    onClick={addTrustedModel}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Add Model
                  </button>
                </div>
                
                <div className="space-y-2">
                  {settings.trustedModels.length === 0 ? (
                    <p className="text-gray-500 text-sm">No trusted models added yet</p>
                  ) : (
                    settings.trustedModels.map((model) => (
                      <div key={model} className="flex items-center justify-between bg-gray-700 rounded px-3 py-2">
                        <span className="text-white">{model}</span>
                        <button
                          onClick={() => removeTrustedModel(model)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <FaTimes size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sync Settings */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaSync className="text-gray-400" />
                  Synchronization Settings
                </h3>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoSync}
                      onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    <span className="text-white">Enable Auto-Sync</span>
                  </label>
                  
                  {settings.autoSync && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Sync Interval (minutes)</label>
                      <input
                        type="number"
                        value={settings.syncInterval}
                        onChange={(e) => setSettings({ ...settings, syncInterval: parseInt(e.target.value) || 30 })}
                        min="5"
                        max="1440"
                        className="w-32 bg-gray-700 text-white rounded px-3 py-2"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            {settings.enabled ? 'MCP integration is active' : 'MCP integration is disabled'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPSettingsComponent;