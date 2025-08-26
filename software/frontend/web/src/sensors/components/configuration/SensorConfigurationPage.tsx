import React, { useState, useEffect } from 'react';
import { FiWifi, FiCpu, FiServer, FiPlus, FiCheck, FiX, FiRefreshCw, FiMinus, FiMaximize2, FiActivity } from 'react-icons/fi';
import ESP32ConfigModal from './ESP32ConfigModal';
import ArduinoConfigModal from './ArduinoConfigModal';
import DAQConfigModal from './DAQConfigModal';
import { arduinoUDCService } from '../../services/arduinoUDCService';
import { daqService } from '../../services/daqService';
import { useUDCWebSocket } from '../../../hooks/useUDCWebSocket';

interface ConnectionDevice {
  id: string;
  name: string;
  type: 'esp32' | 'arduino' | 'daq';
  status: 'connected' | 'disconnected' | 'connecting';
  protocol: string;
  address?: string;
  lastSeen?: string;
  capabilities?: string[];
}

const SensorConfigurationPage: React.FC = () => {
  const [devices, setDevices] = useState<ConnectionDevice[]>([]);
  const [daqDevices, setDaqDevices] = useState<any[]>([]);
  const { status, wsStatus, sendCommand } = useUDCWebSocket();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'esp32' | 'arduino' | 'daq' | null>(null);
  
  // Section collapse states - all collapsed except first
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    esp32: false,
    arduino: true,
    daq: true
  });

  useEffect(() => {
    // Set up Arduino service to use UDC sendCommand
    arduinoUDCService.setMessageHandler(sendCommand);

    // Subscribe to Arduino sensor data
    const unsubscribeArduino = arduinoUDCService.subscribe((data) => {
      console.log('[SensorConfig] Arduino data:', data);
    });

    // Subscribe to DAQ data updates
    const unsubscribeDAQ = daqService.subscribe((data) => {
      console.log('[SensorConfig] DAQ data:', data);
      if (data.type === 'device_list') {
        setDaqDevices(data.devices);
      }
    });

    // Load initial DAQ devices
    daqService.getDevices().then(setDaqDevices);

    return () => {
      unsubscribeArduino();
      unsubscribeDAQ();
    };
  }, [sendCommand]);

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <FiCheck className="w-4 h-4" />;
      case 'connecting': return <FiRefreshCw className="w-4 h-4 animate-spin" />;
      case 'disconnected': return <FiX className="w-4 h-4" />;
      default: return null;
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'esp32': return <FiWifi className="w-5 h-5" />;
      case 'arduino': return <FiCpu className="w-5 h-5" />;
      case 'daq': return <FiServer className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <div className="bg-gray-900 min-h-full">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Sensor Configuration</h2>
          <p className="text-gray-400">Connect and manage your hardware devices</p>
        </div>

        {/* Device Type Sections */}
        <div className="space-y-8">
          {/* ESP32 Devices */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-750 transition-colors"
              onClick={() => toggleSection('esp32')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiWifi className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      ESP32 Devices
                      {collapsedSections.esp32 && devices.filter(d => d.type === 'esp32').length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400">
                          ({devices.filter(d => d.type === 'esp32').length})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">WiFi-enabled microcontrollers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedType('esp32');
                      setShowAddModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add ESP32
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection('esp32');
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                  >
                    {collapsedSections.esp32 ? <FiMaximize2 className="w-5 h-5" /> : <FiMinus className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {!collapsedSections.esp32 && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.filter(d => d.type === 'esp32').map(device => (
                <div key={device.id} className="bg-gray-700 rounded-lg p-4 relative">
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${device.name}?`)) {
                        setDevices(devices.filter(d => d.id !== device.id));
                      }
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors p-1"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${getStatusColor(device.status)}`}>
                        {getStatusIcon(device.status)}
                        <span className="text-sm capitalize">{device.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <h4 className="font-medium text-white">{device.name}</h4>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Protocol:</span>
                      <span className="text-gray-300">{device.protocol}</span>
                    </div>
                    {device.address && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-gray-300">{device.address}</span>
                      </div>
                    )}
                    {device.capabilities && (
                      <div className="mt-3">
                        <span className="text-gray-400 block mb-1">Capabilities:</span>
                        <div className="flex flex-wrap gap-1">
                          {device.capabilities.map((cap, idx) => (
                            <span key={idx} className="bg-gray-600 px-2 py-1 rounded text-xs text-gray-300">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm transition-colors">
                      Configure
                    </button>
                    {device.status === 'disconnected' ? (
                      <button 
                        onClick={() => {
                          // TODO: Implement connection logic
                          setDevices(devices.map(d => 
                            d.id === device.id 
                              ? { ...d, status: 'connecting' }
                              : d
                          ));
                          // Simulate connection
                          setTimeout(() => {
                            setDevices(devices.map(d => 
                              d.id === device.id 
                                ? { ...d, status: 'connected' }
                                : d
                            ));
                          }, 2000);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
                      >
                        Connect
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          // Disconnect the device (keep it in the list)
                          setDevices(devices.map(d => 
                            d.id === device.id 
                              ? { ...d, status: 'disconnected' }
                              : d
                          ));
                        }}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-3 rounded text-sm transition-colors"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {devices.filter(d => d.type === 'esp32').length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <FiWifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No ESP32 devices configured</p>
                  <p className="text-sm mt-1">Click "Add ESP32" to get started</p>
                </div>
              )}
                </div>
              </div>
            )}
          </div>

          {/* Arduino/Controllers */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-750 transition-colors"
              onClick={() => toggleSection('arduino')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiCpu className="w-6 h-6 text-green-400" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Arduino & Controllers
                      {collapsedSections.arduino && devices.filter(d => d.type === 'arduino').length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400">
                          ({devices.filter(d => d.type === 'arduino').length})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">USB-connected microcontrollers via UDC</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedType('arduino');
                      setShowAddModal(true);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add Controller
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection('arduino');
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                  >
                    {collapsedSections.arduino ? <FiMaximize2 className="w-5 h-5" /> : <FiMinus className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {!collapsedSections.arduino && (
              <div className="px-6 pb-6">
                {/* UDC Connection Status */}
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <span className="text-gray-400">UDC Status:</span>
                  <div className={`flex items-center gap-1 ${
                    wsStatus === 'connected' && status.plugins.length > 0 ? 'text-green-400' :
                    wsStatus === 'connected' ? 'text-yellow-400' :
                    wsStatus === 'connecting' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {wsStatus === 'connected' && status.plugins.length > 0 && <FiCheck className="w-3 h-3" />}
                    {wsStatus === 'connected' && status.plugins.length === 0 && <FiRefreshCw className="w-3 h-3" />}
                    {wsStatus === 'connecting' && <FiRefreshCw className="w-3 h-3 animate-spin" />}
                    {wsStatus === 'disconnected' && <FiX className="w-3 h-3" />}
                    <span>
                      {wsStatus === 'connected' && status.plugins.length > 0 ? 'Connected' :
                       wsStatus === 'connected' && status.plugins.length === 0 ? 'Connected (No UDC)' :
                       wsStatus === 'connecting' ? 'Connecting' :
                       'Disconnected'}
                    </span>
                  </div>
                  {wsStatus === 'connected' && status.plugins.length === 0 && (
                    <span className="text-gray-500 text-xs ml-2">
                      (Universal Desktop Controller not detected)
                    </span>
                  )}
                  {wsStatus === 'disconnected' && (
                    <span className="text-gray-500 text-xs ml-2">
                      (Cannot connect to WIT backend)
                    </span>
                  )}
                  {status.plugins.length > 0 && (
                    <span className="text-gray-500 text-xs ml-2">
                      ({status.plugins.filter(p => p.id === 'arduino-ide').length > 0 ? 'Arduino plugin loaded' : 'Arduino plugin not loaded'})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {devices.filter(d => d.type === 'arduino').map(device => (
                    <div key={device.id} className="bg-gray-700 rounded-lg p-4 relative">
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${device.name}?`)) {
                            arduinoUDCService.removeDevice(device.id);
                            setDevices(devices.filter(d => d.id !== device.id));
                          }
                        }}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors p-1"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${getStatusColor(device.status)}`}>
                            {getStatusIcon(device.status)}
                            <span className="text-sm capitalize">{device.status}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <h4 className="font-medium text-white">{device.name}</h4>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Port:</span>
                          <span className="text-gray-300">{device.address || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Board:</span>
                          <span className="text-gray-300 text-xs">
                            {device.protocol === 'arduino:avr:uno' ? 'Uno' :
                             device.protocol === 'arduino:avr:mega' ? 'Mega' :
                             device.protocol === 'arduino:avr:nano' ? 'Nano' :
                             'Arduino'}
                          </span>
                        </div>
                        {device.capabilities && device.capabilities.length > 0 && (
                          <div className="mt-3">
                            <span className="text-gray-400 block mb-1">Sensors:</span>
                            <div className="flex flex-wrap gap-1">
                              {device.capabilities.map((cap, idx) => (
                                <span key={idx} className="bg-gray-600 px-2 py-1 rounded text-xs text-gray-300">
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button 
                          onClick={() => {
                            // Open serial monitor in new modal
                          }}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                        >
                          <FiActivity className="w-3 h-3" />
                          Monitor
                        </button>
                        {device.status === 'disconnected' ? (
                          <button 
                            onClick={async () => {
                              arduinoUDCService.connectDevice({
                                name: device.name,
                                port: device.address || '',
                                baudRate: 9600,
                                board: device.protocol || 'arduino:avr:uno',
                                sensors: device.capabilities || []
                              });
                              setDevices(devices.map(d => 
                                d.id === device.id 
                                  ? { ...d, status: 'connecting' }
                                  : d
                              ));
                              setTimeout(() => {
                                setDevices(devices.map(d => 
                                  d.id === device.id 
                                    ? { ...d, status: 'connected' }
                                    : d
                                ));
                              }, 2000);
                            }}
                            disabled={wsStatus !== 'connected' || status.plugins.length === 0}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-1 px-3 rounded text-sm transition-colors"
                          >
                            Connect
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              arduinoUDCService.disconnectDevice(device.id);
                              setDevices(devices.map(d => 
                                d.id === device.id 
                                  ? { ...d, status: 'disconnected' }
                                  : d
                              ));
                            }}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-3 rounded text-sm transition-colors"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {devices.filter(d => d.type === 'arduino').length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <FiCpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No Arduino devices configured</p>
                      <p className="text-sm mt-1">Connect via Universal Desktop Controller</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Professional DAQs */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-750 transition-colors"
              onClick={() => toggleSection('daq')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiServer className="w-6 h-6 text-purple-400" />
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Professional DAQs
                      {collapsedSections.daq && devices.filter(d => d.type === 'daq').length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-400">
                          ({devices.filter(d => d.type === 'daq').length})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">Industrial data acquisition systems</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedType('daq');
                      setShowAddModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <FiPlus className="w-4 h-4" />
                    Add DAQ
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection('daq');
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                  >
                    {collapsedSections.daq ? <FiMaximize2 className="w-5 h-5" /> : <FiMinus className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {!collapsedSections.daq && (
              <div className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daqDevices.map(device => (
                    <div key={device.id} className="bg-gray-700 rounded-lg p-4 relative">
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${device.name || device.id}?`)) {
                            daqService.disconnectDevice(device.id);
                            setDaqDevices(daqDevices.filter(d => d.id !== device.id));
                          }
                        }}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-400 transition-colors p-1"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${getStatusColor(device.connected ? 'connected' : 'disconnected')}`}>
                            {getStatusIcon(device.connected ? 'connected' : 'disconnected')}
                            <span className="text-sm">{device.connected ? 'Connected' : 'Disconnected'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <h4 className="font-medium text-white">{device.name || device.id}</h4>
                        <p className="text-sm text-gray-400">{device.protocol?.toUpperCase()} • {device.host}:{device.port}</p>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Protocol:</span>
                          <span className="text-gray-300 capitalize">{device.protocol?.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Channels:</span>
                          <span className="text-gray-300">{device.channels}</span>
                        </div>
                        {device.lastData && (
                          <div className="mt-3">
                            <span className="text-gray-400 block mb-1">Latest Data:</span>
                            <div className="bg-gray-600 rounded p-2 text-xs">
                              {Object.entries(device.lastData.channels).slice(0, 3).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-300">{key}:</span>
                                  <span className="text-white">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button 
                          onClick={async () => {
                            const data = await daqService.readDeviceData(device.id);
                            console.log('DAQ data:', data);
                          }}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm transition-colors flex items-center justify-center gap-1"
                        >
                          <FiActivity className="w-3 h-3" />
                          Read
                        </button>
                        {!device.connected ? (
                          <button 
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
                            disabled
                          >
                            Connect
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              daqService.disconnectDevice(device.id);
                              setDaqDevices(daqDevices.map(d => 
                                d.id === device.id 
                                  ? { ...d, connected: false }
                                  : d
                              ));
                            }}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-3 rounded text-sm transition-colors"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {daqDevices.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <FiServer className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No DAQ systems configured</p>
                      <p className="text-sm mt-1">Support for Modbus, OPC UA, and more</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Start Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-blue-400 mb-2">ESP32 Setup</h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Flash ESP32 with WIT firmware</li>
                <li>Configure WiFi credentials</li>
                <li>Add device using IP address</li>
                <li>Select sensor capabilities</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-green-400 mb-2">Arduino Setup</h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Install Universal Desktop Controller</li>
                <li>Connect Arduino via USB</li>
                <li>UDC will auto-detect device</li>
                <li>Configure in WIT interface</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-purple-400 mb-2">DAQ Setup</h4>
              <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                <li>Ensure DAQ is network accessible</li>
                <li>Select protocol (Modbus/OPC UA)</li>
                <li>Enter connection details</li>
                <li>Map sensor channels</li>
              </ol>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ESP32 Configuration Modal */}
      {showAddModal && selectedType === 'esp32' && (
        <ESP32ConfigModal
          isOpen={true}
          onClose={() => {
            setShowAddModal(false);
            setSelectedType(null);
          }}
          onConnect={(config) => {
            // TODO: Implement actual connection logic
            console.log('Connecting ESP32:', config);
            const newDevice: ConnectionDevice = {
              id: `esp32-${Date.now()}`,
              name: config.name,
              type: 'esp32',
              status: 'connecting',
              protocol: config.protocol === 'websocket' ? 'WebSocket' : 'MQTT',
              address: config.ip,
              capabilities: ['temperature', 'humidity']
            };
            setDevices([...devices, newDevice]);
            setShowAddModal(false);
            setSelectedType(null);
          }}
        />
      )}

      {/* Arduino Configuration Modal */}
      {showAddModal && selectedType === 'arduino' && (
        <ArduinoConfigModal
          isOpen={true}
          onClose={() => {
            setShowAddModal(false);
            setSelectedType(null);
          }}
          onConnect={async (config) => {
            const newDevice = await arduinoUDCService.connectDevice(config);
            const connectionDevice: ConnectionDevice = {
              id: newDevice.id,
              name: newDevice.name,
              type: 'arduino',
              status: newDevice.status,
              protocol: newDevice.board,
              address: newDevice.port,
              capabilities: newDevice.sensors
            };
            setDevices([...devices, connectionDevice]);
            setShowAddModal(false);
            setSelectedType(null);
          }}
        />
      )}

      {/* DAQ Configuration Modal */}
      {showAddModal && selectedType === 'daq' && (
        <DAQConfigModal
          isOpen={true}
          onClose={() => {
            setShowAddModal(false);
            setSelectedType(null);
          }}
          onConnect={async (config) => {
            try {
              await daqService.connectDevice(config);
              // Refresh device list
              const devices = await daqService.getDevices();
              setDaqDevices(devices);
              setShowAddModal(false);
              setSelectedType(null);
            } catch (error) {
              console.error('Failed to connect DAQ:', error);
              alert('Failed to connect to DAQ device');
            }
          }}
        />
      )}
    </div>
  );
};

export default SensorConfigurationPage;