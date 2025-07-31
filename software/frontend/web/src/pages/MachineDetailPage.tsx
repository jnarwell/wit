// src/pages/MachineDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaEdit, FaSave, FaWifi, FaUsb, FaBluetooth, FaEthernet, FaVideo, FaMicrophone } from 'react-icons/fa';

interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  connectionType: 'usb' | 'network' | 'serial' | 'bluetooth' | 'network-prusalink' | 'network-octoprint';
  connectionDetails: string;
  manufacturer: string;
  model?: string;
  notes?: string;
  dateAdded: string;
  // Auth properties
  username?: string;
  password?: string;
  apiKey?: string;
  // Audio/Video properties
  audioDevices?: {
    enabled: boolean;
    deviceId?: string;
    deviceName?: string;
    streamUrl?: string;
  };
  videoDevices?: {
    enabled: boolean;
    deviceId?: string;
    deviceName?: string;
    streamUrl?: string;
    streamType?: 'webcam' | 'rtsp' | 'http' | 'custom';
  };
}

interface MachineDetailPageProps {
  machineId: string;
  onClose: () => void;
}

const MachineDetailPage: React.FC<MachineDetailPageProps> = ({ machineId, onClose }) => {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMachine, setEditedMachine] = useState<Machine | null>(null);

  useEffect(() => {
    // Load machine from localStorage
    const savedMachines = localStorage.getItem('wit-machines');
    if (savedMachines) {
      const machines: Machine[] = JSON.parse(savedMachines);
      const foundMachine = machines.find(m => m.id === machineId);
      if (foundMachine) {
        setMachine(foundMachine);
        setEditedMachine(foundMachine);
      }
    }
  }, [machineId]);

  const handleSave = () => {
    if (!editedMachine) return;

    // Update in localStorage
    const savedMachines = localStorage.getItem('wit-machines');
    if (savedMachines) {
      const machines: Machine[] = JSON.parse(savedMachines);
      const index = machines.findIndex(m => m.id === machineId);
      if (index !== -1) {
        machines[index] = editedMachine;
        localStorage.setItem('wit-machines', JSON.stringify(machines));
        setMachine(editedMachine);
        setIsEditing(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedMachine(machine);
    setIsEditing(false);
  };

  const getConnectionIcon = () => {
    switch (machine?.connectionType) {
      case 'usb': return <FaUsb className="w-5 h-5" />;
      case 'network':
      case 'network-prusalink':
      case 'network-octoprint':
        return <FaWifi className="w-5 h-5" />;
      case 'bluetooth': return <FaBluetooth className="w-5 h-5" />;
      case 'serial': return <FaEthernet className="w-5 h-5" />;
      default: return <FaWifi className="w-5 h-5" />;
    }
  };

  const getConnectionTypeName = (type: string) => {
    switch (type) {
      case 'network-prusalink': return 'Network (PrusaLink)';
      case 'network-octoprint': return 'Network (OctoPrint)';
      case 'usb': return 'USB';
      case 'serial': return 'Serial';
      case 'bluetooth': return 'Bluetooth';
      default: return type.toUpperCase();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'text-green-500';
      case 'yellow': return 'text-yellow-500';
      case 'red': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatTypeName = (type: string) => {
    return type
      .split('-')
      .map(word => {
        if (word === '3d') return '3D';
        if (word === 'cnc') return 'CNC';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  if (!machine || !editedMachine) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Machine not found</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Machine Details</h1>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                <FaEdit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  <FaSave className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
            >
              <FaTimes className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Main Info Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedMachine.name}
                  onChange={(e) => setEditedMachine({ ...editedMachine, name: e.target.value })}
                  className="text-3xl font-bold bg-gray-700 text-white rounded px-3 py-1 w-full"
                />
              ) : (
                <h2 className="text-3xl font-bold text-white">{machine.name}</h2>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-gray-400">Type:</span>
                <span className="text-white font-medium">{formatTypeName(machine.type)}</span>
                <span className="text-gray-400 ml-4">Status:</span>
                <span className={`font-medium ${getStatusColor(machine.status)}`}>
                  {machine.status.charAt(0).toUpperCase() + machine.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="text-gray-400">
              ID: {machine.id}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {machine.metrics.map((metric, index) => (
              <div key={index} className="bg-gray-700 rounded p-3">
                <div className="text-gray-400 text-sm">{metric.label}</div>
                <div className="text-white text-lg font-medium mt-1">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Connection Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
            {getConnectionIcon()}
            Connection Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Connection Type</label>
                {isEditing ? (
                  <select
                    value={editedMachine.connectionType}
                    onChange={(e) => setEditedMachine({ 
                      ...editedMachine, 
                      connectionType: e.target.value as any,
                      // Reset auth fields when changing connection type
                      username: e.target.value === 'network-prusalink' ? 'maker' : undefined,
                      password: e.target.value === 'network-prusalink' ? '' : undefined,
                      apiKey: e.target.value === 'network-octoprint' ? '' : undefined
                    })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  >
                    <option value="usb">USB</option>
                    <option value="network-prusalink">Network (PrusaLink)</option>
                    <option value="network-octoprint">Network (OctoPrint)</option>
                    <option value="serial">Serial</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                ) : (
                  <div className="text-white">{getConnectionTypeName(machine.connectionType)}</div>
                )}
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  {machine.connectionType.includes('network') ? 'IP Address/URL' : 'Port/Address'}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedMachine.connectionDetails}
                    onChange={(e) => setEditedMachine({ ...editedMachine, connectionDetails: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  />
                ) : (
                  <div className="text-white font-mono">{machine.connectionDetails || 'Not configured'}</div>
                )}
              </div>
            </div>

            {/* PrusaLink Authentication */}
            {machine.connectionType === 'network-prusalink' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Username</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedMachine.username || 'maker'}
                      onChange={(e) => setEditedMachine({ ...editedMachine, username: e.target.value })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                  ) : (
                    <div className="text-white">{machine.username || 'maker'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Password</label>
                  {isEditing ? (
                    <input
                      type="password"
                      value={editedMachine.password || ''}
                      onChange={(e) => setEditedMachine({ ...editedMachine, password: e.target.value })}
                      placeholder="Enter PrusaLink password"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                  ) : (
                    <div className="text-white">{'•'.repeat(machine.password?.length || 8)}</div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Find in printer: Settings → Network → PrusaLink
                  </p>
                </div>
              </div>
            )}

            {/* OctoPrint API Key */}
            {machine.connectionType === 'network-octoprint' && (
              <div className="mt-4">
                <label className="block text-gray-400 text-sm mb-1">API Key</label>
                {isEditing ? (
                  <input
                    type="password"
                    value={editedMachine.apiKey || ''}
                    onChange={(e) => setEditedMachine({ ...editedMachine, apiKey: e.target.value })}
                    placeholder="Enter OctoPrint API key"
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  />
                ) : (
                  <div className="text-white font-mono">
                    {machine.apiKey ? `${machine.apiKey.substring(0, 8)}...` : 'Not configured'}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Get from OctoPrint Settings → API
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Manufacturer Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Equipment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Manufacturer</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedMachine.manufacturer}
                  onChange={(e) => setEditedMachine({ ...editedMachine, manufacturer: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div className="text-white">{machine.manufacturer}</div>
              )}
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Model</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedMachine.model || ''}
                  onChange={(e) => setEditedMachine({ ...editedMachine, model: e.target.value })}
                  placeholder="Optional"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div className="text-white">{machine.model || 'Not specified'}</div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-gray-400 text-sm mb-1">Date Added</label>
            <div className="text-white">
              {new Date(machine.dateAdded).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* Audio/Video Devices */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Audio/Video Devices</h3>
          
          {/* Audio Device Configuration */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <FaMicrophone className="text-green-500" />
              <h4 className="text-lg font-medium text-white">Audio Device</h4>
              {isEditing && (
                <label className="flex items-center gap-2 ml-auto">
                  <input
                    type="checkbox"
                    checked={editedMachine.audioDevices?.enabled || false}
                    onChange={(e) => setEditedMachine({
                      ...editedMachine,
                      audioDevices: {
                        ...editedMachine.audioDevices,
                        enabled: e.target.checked
                      }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-400">Enable Audio</span>
                </label>
              )}
            </div>
            
            {(isEditing || machine.audioDevices?.enabled) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Audio Device</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedMachine.audioDevices?.deviceName || ''}
                      onChange={(e) => setEditedMachine({
                        ...editedMachine,
                        audioDevices: {
                          ...editedMachine.audioDevices,
                          deviceName: e.target.value
                        }
                      })}
                      placeholder="e.g., Machine Microphone"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                      disabled={!editedMachine.audioDevices?.enabled}
                    />
                  ) : (
                    <div className="text-white">{machine.audioDevices?.deviceName || 'Not configured'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Stream URL (Optional)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedMachine.audioDevices?.streamUrl || ''}
                      onChange={(e) => setEditedMachine({
                        ...editedMachine,
                        audioDevices: {
                          ...editedMachine.audioDevices,
                          streamUrl: e.target.value
                        }
                      })}
                      placeholder="e.g., http://192.168.1.100:8080/audio"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                      disabled={!editedMachine.audioDevices?.enabled}
                    />
                  ) : (
                    <div className="text-white font-mono text-sm">{machine.audioDevices?.streamUrl || 'Local device'}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Video Device Configuration */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <FaVideo className="text-purple-500" />
              <h4 className="text-lg font-medium text-white">Video Device</h4>
              {isEditing && (
                <label className="flex items-center gap-2 ml-auto">
                  <input
                    type="checkbox"
                    checked={editedMachine.videoDevices?.enabled || false}
                    onChange={(e) => setEditedMachine({
                      ...editedMachine,
                      videoDevices: {
                        ...editedMachine.videoDevices,
                        enabled: e.target.checked
                      }
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-400">Enable Video</span>
                </label>
              )}
            </div>
            
            {(isEditing || machine.videoDevices?.enabled) && (
              <div className="space-y-4 pl-7">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Video Device</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedMachine.videoDevices?.deviceName || ''}
                        onChange={(e) => setEditedMachine({
                          ...editedMachine,
                          videoDevices: {
                            ...editedMachine.videoDevices,
                            deviceName: e.target.value
                          }
                        })}
                        placeholder="e.g., Machine Camera"
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                        disabled={!editedMachine.videoDevices?.enabled}
                      />
                    ) : (
                      <div className="text-white">{machine.videoDevices?.deviceName || 'Not configured'}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Stream Type</label>
                    {isEditing ? (
                      <select
                        value={editedMachine.videoDevices?.streamType || 'webcam'}
                        onChange={(e) => setEditedMachine({
                          ...editedMachine,
                          videoDevices: {
                            ...editedMachine.videoDevices,
                            streamType: e.target.value as any
                          }
                        })}
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                        disabled={!editedMachine.videoDevices?.enabled}
                      >
                        <option value="webcam">Webcam</option>
                        <option value="rtsp">RTSP Stream</option>
                        <option value="http">HTTP Stream</option>
                        <option value="custom">Custom Stream</option>
                      </select>
                    ) : (
                      <div className="text-white">{machine.videoDevices?.streamType || 'webcam'}</div>
                    )}
                  </div>
                </div>
                
                {editedMachine.videoDevices?.streamType !== 'webcam' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Stream URL</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedMachine.videoDevices?.streamUrl || ''}
                        onChange={(e) => setEditedMachine({
                          ...editedMachine,
                          videoDevices: {
                            ...editedMachine.videoDevices,
                            streamUrl: e.target.value
                          }
                        })}
                        placeholder={
                          editedMachine.videoDevices?.streamType === 'rtsp' 
                            ? 'rtsp://192.168.1.100:554/stream1'
                            : 'http://192.168.1.100:8080/video'
                        }
                        className="w-full bg-gray-700 text-white rounded px-3 py-2"
                        disabled={!editedMachine.videoDevices?.enabled}
                      />
                    ) : (
                      <div className="text-white font-mono text-sm">{machine.videoDevices?.streamUrl || 'Not configured'}</div>
                    )}
                  </div>
                )}
                
                {!isEditing && machine.videoDevices?.enabled && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        // Open audio widget with this machine's audio
                        if (window.__witNavigate) {
                          window.__witNavigate('dashboard');
                          // TODO: Add audio widget with this machine's settings
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-2"
                    >
                      <FaMicrophone /> Open Audio
                    </button>
                    <button
                      onClick={() => {
                        // Open video widget with this machine's video
                        if (window.__witNavigate) {
                          window.__witNavigate('dashboard');
                          // TODO: Add video widget with this machine's settings
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-2"
                    >
                      <FaVideo /> Open Video
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Notes</h3>
          {isEditing ? (
            <textarea
              value={editedMachine.notes || ''}
              onChange={(e) => setEditedMachine({ ...editedMachine, notes: e.target.value })}
              placeholder="Add any additional notes or configuration details..."
              className="w-full bg-gray-700 text-white rounded px-3 py-2 h-32 resize-none"
            />
          ) : (
            <div className="text-gray-300 whitespace-pre-wrap">
              {machine.notes || 'No notes added yet.'}
            </div>
          )}
        </div>

        {/* Status Configuration */}
        {isEditing && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-medium text-white mb-4">Status Configuration</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="status"
                  value="green"
                  checked={editedMachine.status === 'green'}
                  onChange={(e) => setEditedMachine({ ...editedMachine, status: 'green' })}
                  className="w-4 h-4"
                />
                <span className="text-green-500 font-medium">Online / Operational</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="status"
                  value="yellow"
                  checked={editedMachine.status === 'yellow'}
                  onChange={(e) => setEditedMachine({ ...editedMachine, status: 'yellow' })}
                  className="w-4 h-4"
                />
                <span className="text-yellow-500 font-medium">Warning / Maintenance Needed</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="status"
                  value="red"
                  checked={editedMachine.status === 'red'}
                  onChange={(e) => setEditedMachine({ ...editedMachine, status: 'red' })}
                  className="w-4 h-4"
                />
                <span className="text-red-500 font-medium">Offline / Error</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineDetailPage;