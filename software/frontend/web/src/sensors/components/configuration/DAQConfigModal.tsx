import React, { useState, useEffect } from 'react';
import { FiServer, FiX, FiInfo, FiPlus, FiTrash, FiSettings } from 'react-icons/fi';

interface DAQConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: DAQConfig) => void;
}

interface DAQConfig {
  name: string;
  protocol: 'modbus_tcp' | 'opcua' | 'raw_tcp' | 'http_rest';
  host: string;
  port: number;
  pollInterval: number;
  channels: DAQChannel[];
}

interface DAQChannel {
  name: string;
  address?: number;
  nodeId?: string;
  registerType?: 'holding' | 'input';
  dataType: 'int16' | 'int32' | 'float32';
  scale: number;
  offset: number;
  unit: string;
}

const DAQConfigModal: React.FC<DAQConfigModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [config, setConfig] = useState<DAQConfig>({
    name: '',
    protocol: 'modbus_tcp',
    host: '',
    port: 502,
    pollInterval: 1,
    channels: []
  });

  const [showChannelConfig, setShowChannelConfig] = useState(false);
  const [editingChannel, setEditingChannel] = useState<DAQChannel>({
    name: '',
    address: 0,
    registerType: 'holding',
    dataType: 'float32',
    scale: 1,
    offset: 0,
    unit: ''
  });

  const protocolPorts = {
    modbus_tcp: 502,
    opcua: 4840,
    raw_tcp: 9999,
    http_rest: 80
  };

  useEffect(() => {
    // Update port when protocol changes
    setConfig(prev => ({
      ...prev,
      port: protocolPorts[prev.protocol]
    }));
  }, [config.protocol]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(config);
  };

  const addChannel = () => {
    if (editingChannel.name) {
      setConfig(prev => ({
        ...prev,
        channels: [...prev.channels, { ...editingChannel }]
      }));
      
      // Reset form
      setEditingChannel({
        name: '',
        address: 0,
        registerType: 'holding',
        dataType: 'float32',
        scale: 1,
        offset: 0,
        unit: ''
      });
    }
  };

  const removeChannel = (index: number) => {
    setConfig(prev => ({
      ...prev,
      channels: prev.channels.filter((_, i) => i !== index)
    }));
  };

  const getProtocolName = (protocol: string) => {
    const names = {
      modbus_tcp: 'Modbus TCP',
      opcua: 'OPC UA',
      raw_tcp: 'Raw TCP',
      http_rest: 'HTTP REST'
    };
    return names[protocol as keyof typeof names] || protocol;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FiServer className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Connect DAQ System</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Device Name */}
            <div>
              <label className="block text-gray-300 mb-2">Device Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Main DAQ System"
                required
              />
            </div>

            {/* Protocol Selection */}
            <div>
              <label className="block text-gray-300 mb-2">Protocol</label>
              <div className="grid grid-cols-2 gap-3">
                {['modbus_tcp', 'opcua', 'raw_tcp', 'http_rest'].map(protocol => (
                  <button
                    key={protocol}
                    type="button"
                    onClick={() => setConfig({ ...config, protocol: protocol as any })}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      config.protocol === protocol
                        ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-medium">{getProtocolName(protocol)}</div>
                    <div className="text-sm opacity-80 mt-1">
                      {protocol === 'modbus_tcp' && 'PLCs, RTUs, Industrial sensors'}
                      {protocol === 'opcua' && 'Modern industrial systems'}
                      {protocol === 'raw_tcp' && 'Custom protocols'}
                      {protocol === 'http_rest' && 'Web-based DAQs'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-gray-300 mb-2">Host / IP Address</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Port</label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            {/* Poll Interval */}
            <div>
              <label className="block text-gray-300 mb-2">Poll Interval (seconds)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={config.pollInterval}
                onChange={(e) => setConfig({ ...config, pollInterval: parseFloat(e.target.value) })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Channel Configuration */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Channels</h3>
                <button
                  type="button"
                  onClick={() => setShowChannelConfig(!showChannelConfig)}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-2 text-sm"
                >
                  <FiSettings className="w-4 h-4" />
                  {showChannelConfig ? 'Hide' : 'Configure'}
                </button>
              </div>

              {showChannelConfig && (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Channel Name</label>
                      <input
                        type="text"
                        value={editingChannel.name}
                        onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                        placeholder="Temperature"
                      />
                    </div>
                    
                    {config.protocol === 'modbus_tcp' && (
                      <>
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Register Address</label>
                          <input
                            type="number"
                            value={editingChannel.address}
                            onChange={(e) => setEditingChannel({ ...editingChannel, address: parseInt(e.target.value) })}
                            className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                            placeholder="40001"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Register Type</label>
                          <select
                            value={editingChannel.registerType}
                            onChange={(e) => setEditingChannel({ ...editingChannel, registerType: e.target.value as any })}
                            className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                          >
                            <option value="holding">Holding</option>
                            <option value="input">Input</option>
                          </select>
                        </div>
                      </>
                    )}
                    
                    {config.protocol === 'opcua' && (
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">Node ID</label>
                        <input
                          type="text"
                          value={editingChannel.nodeId}
                          onChange={(e) => setEditingChannel({ ...editingChannel, nodeId: e.target.value })}
                          className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                          placeholder="ns=2;s=Channel1"
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Data Type</label>
                      <select
                        value={editingChannel.dataType}
                        onChange={(e) => setEditingChannel({ ...editingChannel, dataType: e.target.value as any })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                      >
                        <option value="int16">Int16</option>
                        <option value="int32">Int32</option>
                        <option value="float32">Float32</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Scale</label>
                      <input
                        type="number"
                        step="any"
                        value={editingChannel.scale}
                        onChange={(e) => setEditingChannel({ ...editingChannel, scale: parseFloat(e.target.value) })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Offset</label>
                      <input
                        type="number"
                        step="any"
                        value={editingChannel.offset}
                        onChange={(e) => setEditingChannel({ ...editingChannel, offset: parseFloat(e.target.value) })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Unit</label>
                      <input
                        type="text"
                        value={editingChannel.unit}
                        onChange={(e) => setEditingChannel({ ...editingChannel, unit: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-1 text-sm"
                        placeholder="°C"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={addChannel}
                    disabled={!editingChannel.name}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Channel
                  </button>
                </div>
              )}

              {/* Channel List */}
              <div className="space-y-2">
                {config.channels.map((channel, index) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{channel.name}</div>
                      <div className="text-sm text-gray-400">
                        {channel.dataType} • Scale: {channel.scale} • Offset: {channel.offset}
                        {channel.unit && ` • ${channel.unit}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChannel(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <FiTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {config.channels.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No channels configured. Add channels to read data.
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-300">
                  <p>
                    {config.protocol === 'modbus_tcp' && 'Connect to Modbus TCP devices like PLCs, RTUs, and industrial sensors.'}
                    {config.protocol === 'opcua' && 'OPC UA provides secure, reliable communication with modern industrial systems.'}
                    {config.protocol === 'raw_tcp' && 'Use raw TCP for custom protocols. Configure data format in advanced settings.'}
                    {config.protocol === 'http_rest' && 'Connect to web-based DAQ systems with REST APIs.'}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!config.name || !config.host}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Connect DAQ
          </button>
        </div>
      </div>
    </div>
  );
};

export default DAQConfigModal;