// src/pages/SensorDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaEdit, FaSave, FaMicrochip, FaWifi, FaEthernet, FaBolt } from 'react-icons/fa';

interface Sensor {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  connectionType: 'i2c' | 'spi' | 'analog' | 'digital' | 'uart' | 'wireless';
  connectionDetails: string;
  manufacturer: string;
  model?: string;
  notes?: string;
  dateAdded: string;
}

interface SensorDetailPageProps {
  sensorId: string;
  onClose: () => void;
}

const SensorDetailPage: React.FC<SensorDetailPageProps> = ({ sensorId, onClose }) => {
  const [sensor, setSensor] = useState<Sensor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSensor, setEditedSensor] = useState<Sensor | null>(null);

  useEffect(() => {
    // Load sensor from localStorage
    const savedSensors = localStorage.getItem('wit-sensors');
    if (savedSensors) {
      const sensors: Sensor[] = JSON.parse(savedSensors);
      const foundSensor = sensors.find(s => s.id === sensorId);
      if (foundSensor) {
        setSensor(foundSensor);
        setEditedSensor(foundSensor);
      }
    }
  }, [sensorId]);

  const handleSave = () => {
    if (!editedSensor) return;

    // Update in localStorage
    const savedSensors = localStorage.getItem('wit-sensors');
    if (savedSensors) {
      const sensors: Sensor[] = JSON.parse(savedSensors);
      const index = sensors.findIndex(s => s.id === sensorId);
      if (index !== -1) {
        sensors[index] = editedSensor;
        localStorage.setItem('wit-sensors', JSON.stringify(sensors));
        setSensor(editedSensor);
        setIsEditing(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedSensor(sensor);
    setIsEditing(false);
  };

  const getConnectionIcon = () => {
    switch (sensor?.connectionType) {
      case 'i2c':
      case 'spi':
        return <FaMicrochip className="w-5 h-5" />;
      case 'wireless':
        return <FaWifi className="w-5 h-5" />;
      case 'uart':
        return <FaEthernet className="w-5 h-5" />;
      default:
        return <FaBolt className="w-5 h-5" />;
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
    if (type === 'air-quality') return 'Air Quality';
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getConnectionTypeName = (type: string) => {
    const names: Record<string, string> = {
      'i2c': 'I²C',
      'spi': 'SPI',
      'analog': 'Analog',
      'digital': 'Digital',
      'uart': 'UART',
      'wireless': 'Wireless'
    };
    return names[type] || type.toUpperCase();
  };

  if (!sensor || !editedSensor) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Sensor not found</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Sensor Details</h1>
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
                  value={editedSensor.name}
                  onChange={(e) => setEditedSensor({ ...editedSensor, name: e.target.value })}
                  className="text-3xl font-bold bg-gray-700 text-white rounded px-3 py-1 w-full"
                />
              ) : (
                <h2 className="text-3xl font-bold text-white">{sensor.name}</h2>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-gray-400">Type:</span>
                <span className="text-white font-medium">{formatTypeName(sensor.type)}</span>
                <span className="text-gray-400 ml-4">Status:</span>
                <span className={`font-medium ${getStatusColor(sensor.status)}`}>
                  {sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="text-gray-400">
              ID: {sensor.id}
            </div>
          </div>

          {/* Current Readings Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {sensor.metrics.map((metric, index) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Connection Type</label>
              {isEditing ? (
                <select
                  value={editedSensor.connectionType}
                  onChange={(e) => setEditedSensor({ ...editedSensor, connectionType: e.target.value as any })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="i2c">I²C</option>
                  <option value="spi">SPI</option>
                  <option value="analog">Analog</option>
                  <option value="digital">Digital</option>
                  <option value="uart">UART</option>
                  <option value="wireless">Wireless</option>
                </select>
              ) : (
                <div className="text-white">{getConnectionTypeName(sensor.connectionType)}</div>
              )}
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">
                {sensor.connectionType === 'i2c' ? 'I²C Address' :
                 sensor.connectionType === 'spi' ? 'SPI Bus/CS Pin' :
                 sensor.connectionType === 'analog' ? 'Analog Pin' :
                 sensor.connectionType === 'digital' ? 'Digital Pin' :
                 sensor.connectionType === 'uart' ? 'UART Port' :
                 'Connection Details'}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSensor.connectionDetails}
                  onChange={(e) => setEditedSensor({ ...editedSensor, connectionDetails: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 font-mono"
                />
              ) : (
                <div className="text-white font-mono">{sensor.connectionDetails || 'Not configured'}</div>
              )}
            </div>
          </div>
        </div>

        {/* Sensor Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Sensor Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Manufacturer</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSensor.manufacturer}
                  onChange={(e) => setEditedSensor({ ...editedSensor, manufacturer: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div className="text-white">{sensor.manufacturer}</div>
              )}
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Model</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSensor.model || ''}
                  onChange={(e) => setEditedSensor({ ...editedSensor, model: e.target.value })}
                  placeholder="e.g., DHT22, BMP280"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              ) : (
                <div className="text-white">{sensor.model || 'Not specified'}</div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-gray-400 text-sm mb-1">Date Added</label>
            <div className="text-white">
              {new Date(sensor.dateAdded).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* Calibration / Notes */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-medium text-white mb-4">Calibration Notes</h3>
          {isEditing ? (
            <textarea
              value={editedSensor.notes || ''}
              onChange={(e) => setEditedSensor({ ...editedSensor, notes: e.target.value })}
              placeholder="Add calibration details, offset values, or other notes..."
              className="w-full bg-gray-700 text-white rounded px-3 py-2 h-32 resize-none"
            />
          ) : (
            <div className="text-gray-300 whitespace-pre-wrap">
              {sensor.notes || 'No calibration notes added yet.'}
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
                  checked={editedSensor.status === 'green'}
                  onChange={(e) => setEditedSensor({ ...editedSensor, status: 'green' })}
                  className="w-4 h-4"
                />
                <span className="text-green-500 font-medium">Active / Good Readings</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="status"
                  value="yellow"
                  checked={editedSensor.status === 'yellow'}
                  onChange={(e) => setEditedSensor({ ...editedSensor, status: 'yellow' })}
                  className="w-4 h-4"
                />
                <span className="text-yellow-500 font-medium">Warning / Calibration Needed</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="status"
                  value="red"
                  checked={editedSensor.status === 'red'}
                  onChange={(e) => setEditedSensor({ ...editedSensor, status: 'red' })}
                  className="w-4 h-4"
                />
                <span className="text-red-500 font-medium">Error / No Readings</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorDetailPage;