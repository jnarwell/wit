// src/components/widgets/SpecificWidget.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaCog, FaProjectDiagram, FaMicrochip, FaThermometerHalf, FaHome, FaPrint, FaPowerOff, FaCheck, FaPause, FaExclamationTriangle, FaCube, FaPlay } from 'react-icons/fa';

interface SpecificWidgetProps {
  type: 'project' | 'machine' | 'sensor';
  data?: any;
  onRemove: () => void;
  onNavigate?: () => void;
  style?: React.CSSProperties;
}

const SpecificWidget: React.FC<SpecificWidgetProps> = ({ type, data, onRemove, onNavigate, style }) => {
  // State for temperature editing
  const [editingTemp, setEditingTemp] = useState<'nozzle' | 'bed' | null>(null);
  const [tempValue, setTempValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showTempMessage, setShowTempMessage] = useState(false);
  const [showBridgeInstructions, setShowBridgeInstructions] = useState(false);

  // Default data if none provided
  const widgetData = data || {
    id: '001',
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Alpha`,
    type: type === 'project' ? 'software' : type === 'machine' ? '3d-printer' : 'temperature',
    status: 'green' as const,
    metrics: [
      { label: 'Status', value: 'Idle' },
      { label: 'Nozzle', value: '0°C' },
      { label: 'Bed', value: '0°C' }
    ]
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingTemp && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTemp]);

  const getIcon = () => {
    switch (type) {
      case 'project': return <FaProjectDiagram className="w-5 h-5" />;
      case 'machine': 
        // Check if it's a microcontroller
        if (widgetData.type && (
          widgetData.type.includes('arduino') || 
          widgetData.type.includes('esp') || 
          widgetData.type.includes('raspberry-pi')
        )) {
          return <FaMicrochip className="w-5 h-5" />;
        }
        return <FaCog className="w-5 h-5" />;
      case 'sensor': return <FaMicrochip className="w-5 h-5" />;
    }
  };

  // Get status icon based on actual printer state
  const getStatusIcon = () => {
    const statusMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'status');
    const statusValue = statusMetric?.value?.toLowerCase() || '';
    
    if (statusValue.includes('printing') || statusValue.includes('busy')) {
      return <FaPrint className="w-3 h-3 animate-pulse" />;
    } else if (statusValue.includes('ready') || statusValue.includes('idle') || statusValue.includes('operational')) {
      return <FaCheck className="w-3 h-3" />;
    } else if (statusValue.includes('paused') || statusValue.includes('attention')) {
      return <FaPause className="w-3 h-3" />;
    } else if (statusValue.includes('error') || statusValue.includes('offline')) {
      return <FaExclamationTriangle className="w-3 h-3" />;
    }
    return null;
  };

  // Get status color based on printer state
  const getStatusColor = () => {
    const statusMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'status');
    const statusValue = statusMetric?.value?.toLowerCase() || '';
    
    // Use actual printer states for color determination
    if (statusValue.includes('error') || statusValue.includes('offline') || statusValue.includes('disconnected')) {
      return 'bg-red-500';
    } else if (statusValue.includes('printing') || statusValue.includes('busy') || statusValue.includes('paused') || statusValue.includes('attention')) {
      return 'bg-yellow-500';
    } else if (statusValue.includes('ready') || statusValue.includes('idle') || statusValue.includes('operational')) {
      return 'bg-green-500';
    }
    
    // Fall back to the status color from data
    switch (widgetData.status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusGlow = () => {
    const statusMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'status');
    const statusValue = statusMetric?.value?.toLowerCase() || '';
    
    if (statusValue.includes('error') || statusValue.includes('offline')) {
      return 'shadow-red-500/50';
    } else if (statusValue.includes('printing') || statusValue.includes('busy')) {
      return 'shadow-yellow-500/50';
    } else if (statusValue.includes('ready') || statusValue.includes('idle')) {
      return 'shadow-green-500/50';
    }
    
    // Fall back to the status color from data
    switch (widgetData.status) {
      case 'green': return 'shadow-green-500/50';
      case 'yellow': return 'shadow-yellow-500/50';
      case 'red': return 'shadow-red-500/50';
      default: return '';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'project': return 'from-blue-600 to-blue-700';
      case 'machine': return 'from-purple-600 to-purple-700';
      case 'sensor': return 'from-teal-600 to-teal-700';
    }
  };

  // Format type display name
  const formatTypeName = (rawType: string) => {
    if (!rawType) return 'Unknown';
    
    // Handle hyphenated types (e.g., '3d-printer' -> '3D Printer')
    return rawType
      .split('-')
      .map(word => {
        if (word === '3d') return '3D';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  // Get metric color based on content
  const getMetricValueColor = (metric: { label: string; value: string }) => {
    const label = metric.label.toLowerCase();
    const value = metric.value;
    
    // Temperature coloring
    if (label === 'nozzle' || label === 'bed') {
      const temp = parseFloat(value);
      if (temp > 180) {
        return 'text-red-400';
      } else if (temp > 100) {
        return 'text-orange-400';
      } else if (temp > 50) {
        return 'text-yellow-400';
      }
    }
    
    return 'text-white';
  };

  // Get status display text
  const getStatusDisplayText = () => {
    const statusMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'status');
    return statusMetric?.value || 'Unknown';
  };

  // Get temperature metrics for machines
  const getTemperatureMetrics = () => {
    if (type !== 'machine') return [];
    
    const nozzleMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'nozzle');
    const bedMetric = widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'bed');
    
    const temps = [];
    if (nozzleMetric) temps.push(nozzleMetric);
    if (bedMetric) temps.push(bedMetric);
    
    return temps;
  };

  // Handle temperature click
  const handleTempClick = (e: React.MouseEvent, tempType: 'nozzle' | 'bed', currentValue: string) => {
    e.stopPropagation();
    
    // Check if temperature control is supported
    const hasCapabilities = widgetData.capabilities?.temperature_control;
    const hasBridge = widgetData.bridge_connected;
    const isLimited = widgetData.control_mode === 'limited';
    
    // If no temperature control capability and no bridge, show instructions
    if (!hasCapabilities && !hasBridge) {
      // Only show bridge instructions for limited connections (not cloud/full)
      if (isLimited) {
        setShowBridgeInstructions(true);
      } else {
        setShowTempMessage(true);
      }
      return;
    }
    
    setEditingTemp(tempType);
    // Extract numeric value from string like "25.0°C" or "200°C → 210°C"
    let numericValue = 0;
    if (currentValue.includes('→')) {
      // Extract target temperature if heating
      const parts = currentValue.split('→');
      numericValue = parseFloat(parts[1]);
    } else {
      numericValue = parseFloat(currentValue);
    }
    setTempValue(isNaN(numericValue) ? '0' : numericValue.toString());
  };

  // Handle temperature input change
  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setTempValue(value);
    }
  };

  // Handle temperature submission
const handleTempSubmit = async () => {
  if (editingTemp && tempValue !== '') {
    const temp = parseFloat(tempValue);
    const maxTemp = editingTemp === 'nozzle' ? 250 : 80;
    
    if (temp >= 0 && temp <= maxTemp) {
      console.log(`Setting ${editingTemp} temperature to ${temp}°C for ${widgetData.name}`);
      
      try {
        // Get auth token from localStorage
        let token = null;
        const authData = localStorage.getItem('wit-auth');
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            token = parsed.access_token || parsed.token;
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }
        
        const headers: any = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Use PrusaConnect-style commands API with CORRECT kwargs
        const commandBody = {
          command: editingTemp === 'nozzle' ? 'SET_NOZZLE_TEMPERATURE' : 'SET_HEATBED_TEMPERATURE',
          kwargs: editingTemp === 'nozzle' 
            ? { nozzle_temperature: temp }
            : { bed_temperature: temp }
        };
        
        console.log('Sending command:', commandBody);
        
        // Try commands endpoint
        const response = await fetch(`http://localhost:8000/api/v1/equipment/printers/${widgetData.id}/commands`, {
          method: 'POST',
          headers,
          body: JSON.stringify(commandBody)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Temperature command sent successfully:', result);
          
          // Show whether bridge was used
          if (result.bridge_used !== undefined) {
            console.log(`Command sent via ${result.bridge_used ? 'BRIDGE' : 'SIMULATION'}`);
          }
          
          // Show success feedback
          setEditingTemp(null);
          setTempValue('');
          
          // Optional: Show a success message
          // You could add a toast notification here
          
        } else {
          const errorText = await response.text();
          console.error('Failed to send command:', errorText);
          
          // Only show error for non-501 status codes
          if (response.status !== 501) {
            alert(`Failed to set temperature: ${response.status}`);
          }
        }
      } catch (error) {
        console.error('Error setting temperature:', error);
        alert('Failed to connect to printer. Make sure the backend is running.');
      }
    } else {
      alert(`Temperature must be between 0 and ${maxTemp}°C`);
    }
  } else {
    setEditingTemp(null);
    setTempValue('');
  }
};

  // Handle temperature input key press
  const handleTempKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTempSubmit();
    } else if (e.key === 'Escape') {
      setEditingTemp(null);
      setTempValue('');
    }
  };

  // Handle control button clicks
const handleHomeClick = async (e: React.MouseEvent) => {
  e.stopPropagation();
  console.log('Home clicked for', widgetData.name);
  
  try {
    const authData = localStorage.getItem('wit-auth');
    const token = authData ? JSON.parse(authData).access_token : null;
    
    const headers: any = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`http://localhost:8000/api/v1/equipment/printers/${widgetData.id}/commands`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        command: 'HOME',
        kwargs: { axis: 'XYZ' }  // Home all axes
      })
    });
    
    if (response.ok) {
      console.log('Home command sent successfully');
      // Optional: Show feedback
    } else {
      console.error('Failed to home printer');
    }
  } catch (error) {
    console.error('Error sending home command:', error);
  }
};

  const handlePrintClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Print clicked for', widgetData.name);
    
    // Check if printer is printing/paused to show appropriate control
    const isPrinting = widgetData.state?.toLowerCase().includes('printing');
    const isPaused = widgetData.state?.toLowerCase().includes('paused');
    
    try {
      const tokens = localStorage.getItem('wit-auth-tokens');
      if (!tokens) return;
      
      const parsedTokens = JSON.parse(tokens);
      const headers = {
        'Authorization': `Bearer ${parsedTokens.access_token}`,
        'Content-Type': 'application/json',
      };
      
      let command = 'PAUSE';
      if (isPaused) {
        command = 'RESUME';
      } else if (!isPrinting && !isPaused) {
        // Not printing - could open file selector
        alert('No active print. Use your slicer to start a print.');
        return;
      }
      
      const response = await fetch(`http://localhost:8000/api/v1/equipment/printers/${widgetData.id}/commands`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          command: command,
          kwargs: {}
        })
      });
      
      if (response.ok) {
        console.log(`${command} command sent successfully`);
      }
    } catch (error) {
      console.error('Error sending print command:', error);
    }
  };

  const handlePowerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Power clicked for', widgetData.name);
    
    // For now, power button will be for emergency stop
    if (window.confirm('Are you sure you want to emergency stop the printer?')) {
      try {
        const tokens = localStorage.getItem('wit-auth-tokens');
        if (!tokens) return;
        
        const parsedTokens = JSON.parse(tokens);
        const headers = {
          'Authorization': `Bearer ${parsedTokens.access_token}`,
          'Content-Type': 'application/json',
        };
        
        const response = await fetch(`http://localhost:8000/api/v1/equipment/printers/${widgetData.id}/commands`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            command: 'EMERGENCY_STOP',
            kwargs: {}
          })
        });
        
        if (response.ok) {
          console.log('Emergency stop sent successfully');
        }
      } catch (error) {
        console.error('Error sending emergency stop:', error);
      }
    }
  };

  return (
    <div 
      className="h-full bg-gray-800 rounded-lg overflow-hidden flex flex-col group hover:ring-2 hover:ring-gray-600 transition-all cursor-pointer"
      onClick={(e) => {
        // Don't navigate if clicking the remove button or control buttons
        if (!(e.target as HTMLElement).closest('.remove-button') && 
            !(e.target as HTMLElement).closest('.control-button') &&
            !(e.target as HTMLElement).closest('.temp-control')) {
          onNavigate?.();
        }
      }}
      style={style}
    >
      {/* Header */}
      <div className={`px-4 py-3 bg-gradient-to-r ${getTypeColor()} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {getIcon()}
          <div>
            <h3 className="text-white font-medium truncate">{widgetData.name}</h3>
            <p className="text-xs text-white/70">{formatTypeName(widgetData.type)}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="remove-button p-1.5 hover:bg-white/20 rounded transition-colors"
        >
          <FaTimes className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${getStatusGlow()} shadow-lg animate-pulse`} />
            <span className="text-sm text-gray-300">{getStatusDisplayText()}</span>
          </div>
          {type === 'machine' && widgetData.metrics?.find((m: any) => m.label.toLowerCase() === 'progress') && (
            <div className="text-xs text-gray-400">
              {widgetData.metrics.find((m: any) => m.label.toLowerCase() === 'progress').value}
            </div>
          )}
        </div>
        {/* Control Mode Indicator */}
        {type === 'machine' && (
          <div className="flex items-center gap-2 mt-1">
            {widgetData.bridge_connected ? (
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400">Bridge Active</span>
              </div>
            ) : widgetData.control_mode === 'limited' ? (
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-yellow-400">Limited Control (PrusaLink)</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBridgeInstructions(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline ml-1"
                >
                  Enable Bridge
                </button>
              </div>
            ) : widgetData.control_mode === 'cloud' ? (
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-blue-400">Cloud Control (PrusaConnect)</span>
              </div>
            ) : widgetData.control_mode === 'full' ? (
              <div className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-400">Full Control</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Temperature Metrics (for machines only) */}
      {type === 'machine' && (
        <div className="flex-1 p-4 space-y-3">
          {getTemperatureMetrics().map((metric: any, index: number) => {
            const tempType = metric.label.toLowerCase() as 'nozzle' | 'bed';
            const isEditing = editingTemp === tempType;
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaThermometerHalf className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">{metric.label}</span>
                </div>
                {isEditing ? (
                  <div className="temp-control flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={tempValue}
                      onChange={handleTempChange}
                      onKeyDown={handleTempKeyPress}
                      onBlur={handleTempSubmit}
                      className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <span className="text-gray-400 text-sm">°C</span>
                  </div>
                ) : (
                  <button
  onClick={(e) => handleTempClick(e, tempType, metric.value)}
  className={`temp-control text-lg font-medium ${getMetricValueColor(metric)} ${(widgetData.capabilities?.temperature_control || widgetData.bridge_connected) ? 'hover:text-blue-400 cursor-pointer' : 'cursor-default opacity-75'} transition-colors flex items-center gap-1 group/temp`}
  title={
    widgetData.capabilities?.temperature_control || widgetData.bridge_connected
      ? `Click to set ${metric.label.toLowerCase()} temperature (max ${tempType === 'nozzle' ? '250' : '80'}°C)`
      : widgetData.control_mode === 'limited' 
        ? 'Temperature control not available - enable bridge for full control'
        : 'Temperature control not available - use printer interface'
  }
>
  {metric.value}
  {/* Show heating indicator if value contains arrow */}
  {metric.value.includes('→') && (
    <span className="text-xs text-orange-400 animate-pulse">●</span>
  )}
  {/* Show edit hint on hover only if supported */}
  {(widgetData.capabilities?.temperature_control || widgetData.bridge_connected) && (
    <span className="text-xs text-gray-500 opacity-0 group-hover/temp:opacity-100 transition-opacity ml-1">
      ✏️
    </span>
  )}
  {/* Show lock icon if not supported */}
  {!(widgetData.capabilities?.temperature_control || widgetData.bridge_connected) && (
    <span className="text-xs text-gray-500 ml-1">
      🔒
    </span>
  )}
</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showTempMessage && (
  <div className="absolute inset-0 bg-gray-800/95 flex items-center justify-center p-4 z-10">
    <div className="bg-gray-700 rounded-lg p-4 text-center max-w-sm">
      <p className="text-yellow-400 text-sm mb-2">⚠️ Temperature Control Unavailable</p>
      <p className="text-gray-300 text-xs mb-3">
        This printer doesn't support temperature control via API.
      </p>
      <p className="text-gray-400 text-xs mb-3">
        Use the printer's web interface at:
      </p>
      <a 
        href={`http://${widgetData.url || 'printer.local'}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 text-xs underline"
        onClick={(e) => e.stopPropagation()}
      >
        Open Printer Interface
      </a>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowTempMessage(false);
        }}
        className="mt-3 block w-full py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-300"
      >
        Close
      </button>
    </div>
  </div>
)}

{showBridgeInstructions && (
  <div className="absolute inset-0 bg-gray-800/95 flex items-center justify-center p-4 z-10">
    <div className="bg-gray-700 rounded-lg p-4 text-center max-w-md">
      <p className="text-yellow-400 text-sm mb-2">🌉 Enable Full Control with Bridge</p>
      <p className="text-gray-300 text-xs mb-3">
        Your printer (PrusaLink) has limited control via API. 
        The W.I.T. Bridge enables full control including temperature and movement.
      </p>
      
      <div className="bg-gray-800 rounded p-3 text-left mb-3">
        <p className="text-gray-400 text-xs font-mono mb-2">Quick Start:</p>
        <code className="text-xs text-green-400 block">
          cd scripts/application<br/>
          ./start_bridge.sh {widgetData.id} [password]
        </code>
      </div>
      
      <div className="text-left space-y-2 mb-3">
        <p className="text-xs text-gray-400">Bridge provides:</p>
        <ul className="text-xs text-gray-300 space-y-1 ml-4">
          <li>• Temperature control</li>
          <li>• Movement & homing</li>
          <li>• Direct G-code execution</li>
          <li>• Real-time status updates</li>
        </ul>
      </div>
      
      <div className="flex gap-2">
        <a 
          href="https://github.com/your-repo/wiki/bridge-setup"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
        >
          Setup Guide
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowBridgeInstructions(false);
          }}
          className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      {/* Other widget types - show default metrics */}
      {type !== 'machine' && (
        <div className="flex-1 p-4 space-y-2">
          {widgetData.metrics?.filter((m: any) => m.label.toLowerCase() !== 'status').map((metric: any, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{metric.label}</span>
              <span className="text-sm font-medium text-white">{metric.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Control Buttons (for machines only) */}
      {type === 'machine' && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleHomeClick}
              disabled={!widgetData.capabilities?.movement_control && !widgetData.bridge_connected}
              className={`control-button flex items-center justify-center gap-1 py-2 rounded text-sm transition-colors ${
                widgetData.capabilities?.movement_control || widgetData.bridge_connected
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
              title={widgetData.capabilities?.movement_control || widgetData.bridge_connected ? "Home All Axes" : "Movement control not available"}
            >
              <FaHome className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-slicer', { detail: { machine: widgetData } }))}
              className="control-button flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
              title="Open Slicer"
            >
              <FaCube className="w-4 h-4" />
              <span>Slice</span>
            </button>
            <button
              onClick={handlePrintClick}
              className={`control-button flex items-center justify-center gap-1 py-2 rounded text-sm text-white transition-colors ${
                widgetData.state?.toLowerCase().includes('paused') 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : widgetData.state?.toLowerCase().includes('printing')
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
              title={
                widgetData.state?.toLowerCase().includes('paused') 
                  ? 'Resume Print' 
                  : widgetData.state?.toLowerCase().includes('printing')
                  ? 'Pause Print'
                  : 'No Active Print'
              }
            >
              {widgetData.state?.toLowerCase().includes('paused') ? (
                <>
                  <FaPlay className="w-4 h-4" />
                  <span>Resume</span>
                </>
              ) : widgetData.state?.toLowerCase().includes('printing') ? (
                <>
                  <FaPause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <FaPrint className="w-4 h-4" />
                  <span>Print</span>
                </>
              )}
            </button>
            <button
              onClick={handlePowerClick}
              className="control-button flex items-center justify-center gap-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white transition-colors"
              title="Emergency Stop"
            >
              <FaPowerOff className="w-4 h-4" />
              <span>E-Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* View Details (visible on hover for non-machine widgets) */}
      {type !== 'machine' && (
        <div className="px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors">
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

export default SpecificWidget;