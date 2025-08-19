import React, { useState, useEffect } from 'react';
import { FiCpu, FiUpload, FiPlay, FiTerminal, FiFolder, FiRefreshCw } from 'react-icons/fi';
import './ArduinoControl.css';

interface ArduinoBoard {
  path: string;
  manufacturer: string;
  serialNumber?: string;
}

interface ArduinoSketch {
  name: string;
  path: string;
  modified: string;
}

const ArduinoControl: React.FC = () => {
  const [boards, setBoards] = useState<ArduinoBoard[]>([]);
  const [sketches, setSketches] = useState<ArduinoSketch[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedSketch, setSelectedSketch] = useState<string>('');
  const [serialOutput, setSerialOutput] = useState<string[]>([]);
  const [isSerialOpen, setIsSerialOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Connect to WebSocket for Arduino plugin communication
    connectToArduinoPlugin();
    
    // Initial data fetch
    fetchBoards();
    fetchSketches();
    
    return () => {
      // Cleanup
      disconnectArduinoPlugin();
    };
  }, []);

  const connectToArduinoPlugin = () => {
    // This would connect to the UDC WebSocket
    // For now, using mock data
    console.log('Connecting to Arduino plugin...');
  };

  const disconnectArduinoPlugin = () => {
    console.log('Disconnecting from Arduino plugin...');
  };

  const fetchBoards = async () => {
    // Mock data for demonstration
    setBoards([
      { path: '/dev/tty.usbmodem14201', manufacturer: 'Arduino LLC' },
      { path: '/dev/tty.usbserial-1420', manufacturer: 'FTDI' }
    ]);
  };

  const fetchSketches = async () => {
    // Mock data for demonstration
    setSketches([
      { name: 'Blink', path: '~/Documents/Arduino/Blink', modified: new Date().toISOString() },
      { name: 'SerialTest', path: '~/Documents/Arduino/SerialTest', modified: new Date().toISOString() }
    ]);
  };

  const handleLaunchIDE = () => {
    console.log('Launching Arduino IDE...');
    // Send message to UDC to launch Arduino
  };

  const handleCompile = async () => {
    if (!selectedSketch) {
      alert('Please select a sketch first');
      return;
    }
    
    setIsCompiling(true);
    console.log('Compiling sketch:', selectedSketch);
    
    // Simulate compilation
    setTimeout(() => {
      setIsCompiling(false);
      setSerialOutput(prev => [...prev, `✓ Compilation complete for ${selectedSketch}`]);
    }, 2000);
  };

  const handleUpload = async () => {
    if (!selectedSketch || !selectedBoard) {
      alert('Please select both a sketch and a board');
      return;
    }
    
    setIsUploading(true);
    console.log('Uploading sketch:', selectedSketch, 'to board:', selectedBoard);
    
    // Simulate upload
    setTimeout(() => {
      setIsUploading(false);
      setSerialOutput(prev => [...prev, `✓ Upload complete to ${selectedBoard}`]);
    }, 3000);
  };

  const handleSerialToggle = () => {
    if (isSerialOpen) {
      console.log('Closing serial monitor...');
      setIsSerialOpen(false);
    } else {
      if (!selectedBoard) {
        alert('Please select a board first');
        return;
      }
      console.log('Opening serial monitor for:', selectedBoard);
      setIsSerialOpen(true);
      setSerialOutput(prev => [...prev, `Serial monitor opened on ${selectedBoard}`]);
    }
  };

  const handleCreateSketch = () => {
    const name = prompt('Enter sketch name:');
    if (name) {
      console.log('Creating new sketch:', name);
      // Send create sketch command
      fetchSketches(); // Refresh list
    }
  };

  return (
    <div className="arduino-control">
      <div className="arduino-header">
        <h2><FiCpu className="icon" /> Arduino IDE Control</h2>
        <button className="btn-primary" onClick={handleLaunchIDE}>
          Launch Arduino IDE
        </button>
      </div>

      <div className="arduino-content">
        <div className="arduino-sidebar">
          <div className="section">
            <h3>Boards</h3>
            <button className="btn-icon" onClick={fetchBoards} title="Refresh boards">
              <FiRefreshCw />
            </button>
          </div>
          <select 
            value={selectedBoard} 
            onChange={(e) => setSelectedBoard(e.target.value)}
            className="board-select"
          >
            <option value="">Select a board...</option>
            {boards.map(board => (
              <option key={board.path} value={board.path}>
                {board.manufacturer} - {board.path}
              </option>
            ))}
          </select>

          <div className="section">
            <h3>Sketches</h3>
            <button className="btn-icon" onClick={handleCreateSketch} title="New sketch">
              <FiFolder />
            </button>
          </div>
          <div className="sketch-list">
            {sketches.map(sketch => (
              <div 
                key={sketch.path}
                className={`sketch-item ${selectedSketch === sketch.name ? 'selected' : ''}`}
                onClick={() => setSelectedSketch(sketch.name)}
              >
                <FiFolder className="sketch-icon" />
                <span>{sketch.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="arduino-main">
          <div className="control-bar">
            <button 
              className="btn-action compile"
              onClick={handleCompile}
              disabled={!selectedSketch || isCompiling}
            >
              <FiPlay />
              {isCompiling ? 'Compiling...' : 'Compile'}
            </button>
            
            <button 
              className="btn-action upload"
              onClick={handleUpload}
              disabled={!selectedSketch || !selectedBoard || isUploading}
            >
              <FiUpload />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            
            <button 
              className={`btn-action serial ${isSerialOpen ? 'active' : ''}`}
              onClick={handleSerialToggle}
              disabled={!selectedBoard}
            >
              <FiTerminal />
              {isSerialOpen ? 'Close Serial' : 'Open Serial'}
            </button>
          </div>

          <div className="serial-monitor">
            <h3>Serial Monitor</h3>
            <div className="serial-output">
              {serialOutput.map((line, index) => (
                <div key={index} className="serial-line">{line}</div>
              ))}
              {serialOutput.length === 0 && (
                <div className="serial-placeholder">
                  Serial output will appear here...
                </div>
              )}
            </div>
            {isSerialOpen && (
              <input 
                type="text" 
                className="serial-input"
                placeholder="Send data to Arduino..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget.value;
                    console.log('Sending:', input);
                    setSerialOutput(prev => [...prev, `> ${input}`]);
                    e.currentTarget.value = '';
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArduinoControl;