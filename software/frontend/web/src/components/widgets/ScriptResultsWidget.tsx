import React, { useState, useEffect } from 'react';
import { FaTimes, FaPython, FaPlay, FaStop, FaSync, FaTerminal } from 'react-icons/fa';

interface ScriptResultsWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    scriptPath?: string;
    scriptName?: string;
    updateInterval?: number; // in seconds
  };
}

interface ScriptResult {
  timestamp: Date;
  output: string;
  status: 'success' | 'error' | 'running';
  executionTime?: number; // in ms
}

const ScriptResultsWidget: React.FC<ScriptResultsWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [selectedScript, setSelectedScript] = useState(data?.scriptPath || '');
  const [isRunning, setIsRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(data?.updateInterval || 5); // seconds
  const [results, setResults] = useState<ScriptResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ScriptResult | null>(null);

  // Simulate script execution
  const executeScript = () => {
    setIsRunning(true);
    const startTime = Date.now();
    
    // Simulate different script outputs
    setTimeout(() => {
      const scriptOutputs = [
        {
          type: 'sensor_data',
          output: JSON.stringify({
            sensor_id: 'temp_01',
            value: (20 + Math.random() * 10).toFixed(2),
            unit: '°C',
            status: 'normal',
            timestamp: new Date().toISOString()
          }, null, 2)
        },
        {
          type: 'system_status',
          output: JSON.stringify({
            cpu_usage: (30 + Math.random() * 40).toFixed(1) + '%',
            memory_usage: (50 + Math.random() * 30).toFixed(1) + '%',
            active_processes: Math.floor(100 + Math.random() * 50),
            uptime: '5d 14h 23m'
          }, null, 2)
        },
        {
          type: 'analysis_result',
          output: `Analysis Complete:\n- Data points processed: ${Math.floor(1000 + Math.random() * 5000)}\n- Anomalies detected: ${Math.floor(Math.random() * 10)}\n- Accuracy: ${(90 + Math.random() * 9).toFixed(2)}%\n- Next run: ${new Date(Date.now() + refreshInterval * 1000).toLocaleTimeString()}`
        },
        {
          type: 'custom_metrics',
          output: `Production Metrics:\n- Units produced: ${Math.floor(100 + Math.random() * 50)}\n- Efficiency: ${(85 + Math.random() * 10).toFixed(1)}%\n- Error rate: ${(Math.random() * 2).toFixed(2)}%\n- Est. completion: ${(4 + Math.random() * 3).toFixed(1)}h`
        }
      ];

      const randomOutput = scriptOutputs[Math.floor(Math.random() * scriptOutputs.length)];
      const executionTime = Date.now() - startTime;
      
      const result: ScriptResult = {
        timestamp: new Date(),
        output: randomOutput.output,
        status: Math.random() > 0.9 ? 'error' : 'success',
        executionTime
      };

      if (result.status === 'error') {
        result.output = `Error: Script execution failed\nTraceback (most recent call last):\n  File "${selectedScript || 'script.py'}", line 42\n    data = sensor.read()\nConnectionError: Unable to connect to sensor`;
      }

      setCurrentResult(result);
      setResults(prev => [...prev.slice(-9), result]); // Keep last 10 results
      setIsRunning(false);
    }, 500 + Math.random() * 1000); // Simulate execution time
  };

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && selectedScript) {
      executeScript(); // Initial execution
      const interval = setInterval(executeScript, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, selectedScript]);

  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const formatOutput = (output: string) => {
    if (isCompact) {
      // For compact view, show only the first line or a summary
      const lines = output.split('\n');
      return lines[0].substring(0, 50) + (lines[0].length > 50 ? '...' : '');
    }
    return output;
  };

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-green-600 to-green-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <FaPython size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Script Results</span>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={isCompact ? 14 : 16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex-1 flex flex-col overflow-hidden`}>
          {/* Script Selector */}
          {!data?.scriptPath && (
            <select
              value={selectedScript}
              onChange={(e) => setSelectedScript(e.target.value)}
              className="w-full mb-3 bg-gray-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="">Select Script</option>
              <option value="/scripts/sensor_monitor.py">Sensor Monitor</option>
              <option value="/scripts/system_health.py">System Health Check</option>
              <option value="/scripts/data_analysis.py">Data Analysis</option>
              <option value="/scripts/custom_metrics.py">Custom Metrics</option>
            </select>
          )}

          {/* Script Name and Controls */}
          {(selectedScript || data?.scriptPath) && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-white`}>
                  {data?.scriptName || selectedScript.split('/').pop()}
                </h3>
                {!isCompact && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeScript()}
                      disabled={isRunning}
                      className="text-white hover:text-green-300 transition-colors disabled:opacity-50"
                      title="Run Now"
                    >
                      {isRunning ? <FaSync className="animate-spin" size={14} /> : <FaPlay size={14} />}
                    </button>
                    <button
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={`transition-colors ${autoRefresh ? 'text-green-400' : 'text-gray-400'}`}
                      title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                    >
                      <FaSync size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              {currentResult && (
                <div className={`flex items-center gap-2 mb-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-yellow-400 animate-pulse' :
                    currentResult.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="text-gray-400">
                    {isRunning ? 'Running...' : 
                     currentResult.status === 'success' ? 'Success' : 'Error'}
                  </span>
                  {!isCompact && currentResult.executionTime && (
                    <span className="text-gray-500">
                      ({currentResult.executionTime}ms)
                    </span>
                  )}
                </div>
              )}

              {/* Output Display */}
              <div className={`flex-1 bg-gray-900 rounded p-2 font-mono text-xs overflow-auto ${
                isCompact ? '' : 'min-h-0'
              }`}>
                {currentResult ? (
                  <pre className={`${
                    currentResult.status === 'error' ? 'text-red-400' : 'text-green-400'
                  } whitespace-pre-wrap`}>
                    {formatOutput(currentResult.output)}
                  </pre>
                ) : (
                  <span className="text-gray-500">Waiting for execution...</span>
                )}
              </div>

              {/* Refresh Settings for medium/large */}
              {!isCompact && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {autoRefresh ? `Auto-refresh: ${refreshInterval}s` : 'Auto-refresh: OFF'}
                  </span>
                  {currentResult && (
                    <span>
                      Last run: {currentResult.timestamp.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              {/* Execution History for large widgets */}
              {isLarge && results.length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-xs font-medium text-gray-400 mb-2">Execution History</h4>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {results.slice(-5).reverse().map((result, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          result.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <span className="text-gray-500">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="text-gray-400">
                          {result.executionTime}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptResultsWidget;