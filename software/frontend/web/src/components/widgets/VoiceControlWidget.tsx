// src/components/widgets/VoiceControlWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaMicrophone, FaMicrophoneSlash, FaPaperPlane, FaVolumeUp } from 'react-icons/fa';

interface VoiceControlWidgetProps {
  onRemove?: () => void;
}

interface VoiceCommand {
  id: string;
  text: string;
  type: 'user' | 'system';
  timestamp: Date;
  status?: 'processing' | 'success' | 'error';
}

const VoiceControlWidget: React.FC<VoiceControlWidgetProps> = ({ onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [commands, setCommands] = useState<VoiceCommand[]>([
    {
      id: '1',
      text: 'System ready. Say "Hey W.I.T." to begin.',
      type: 'system',
      timestamp: new Date(Date.now() - 3600000),
      status: 'success'
    },
    {
      id: '2',
      text: 'Hey W.I.T., what\'s the status of the 3D printer?',
      type: 'user',
      timestamp: new Date(Date.now() - 3000000),
    },
    {
      id: '3',
      text: 'The Prusa MK3S+ is currently printing "Widget Assembly v2". Progress: 67%, estimated completion in 1 hour 23 minutes.',
      type: 'system',
      timestamp: new Date(Date.now() - 2950000),
      status: 'success'
    }
  ]);

  // Simulated voice detection animation
  const [voiceLevel, setVoiceLevel] = useState(0);
  
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setVoiceLevel(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVoiceLevel(0);
    }
  }, [isListening]);

  const handleVoiceToggle = () => {
    setIsListening(!isListening);
    
    if (!isListening) {
      // Simulate starting to listen
      const newCommand: VoiceCommand = {
        id: Date.now().toString(),
        text: 'Listening...',
        type: 'system',
        timestamp: new Date(),
        status: 'processing'
      };
      setCommands(prev => [...prev, newCommand]);
      
      // Simulate voice recognition after 3 seconds
      setTimeout(() => {
        setCommands(prev => prev.filter(cmd => cmd.id !== newCommand.id));
        handleTextSubmit('Turn on the laser cutter ventilation');
        setIsListening(false);
      }, 3000);
    }
  };

  const handleTextSubmit = (text?: string) => {
    const commandText = text || inputText.trim();
    if (!commandText) return;

    // Add user command
    const userCommand: VoiceCommand = {
      id: Date.now().toString(),
      text: commandText,
      type: 'user',
      timestamp: new Date()
    };
    setCommands(prev => [...prev, userCommand]);
    setInputText('');

    // Simulate processing
    setTimeout(() => {
      const responses: { [key: string]: string } = {
        'status': 'All systems operational. 3 machines active, 1 in maintenance.',
        'temperature': 'Current workshop temperature is 22.5°C, within optimal range.',
        'emergency stop': 'Emergency stop activated. All machines halted.',
        'laser': 'Laser cutter ventilation system activated. Air quality monitoring enabled.',
        'help': 'Available commands: status, temperature, start/stop [machine], emergency stop, help.'
      };

      const responseKey = Object.keys(responses).find(key => 
        commandText.toLowerCase().includes(key)
      );

      const response: VoiceCommand = {
        id: (Date.now() + 1).toString(),
        text: responses[responseKey || ''] || `Processing command: "${commandText}"`,
        type: 'system',
        timestamp: new Date(),
        status: responseKey ? 'success' : 'processing'
      };
      
      setCommands(prev => [...prev, response]);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FaVolumeUp className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Voice Control</h3>
        </div>
        {onRemove && isHovered && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove widget"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Command History - Scrollable */}
      <div className="widget-content flex-grow mb-4">
        <div className="space-y-2">
          {commands.map((command) => (
            <div
              key={command.id}
              className={`animate-fadeIn ${
                command.type === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block max-w-[80%] rounded-lg px-3 py-2 ${
                  command.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : command.status === 'error'
                    ? 'bg-red-50 text-red-800'
                    : command.status === 'processing'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="text-sm">{command.text}</p>
                <p className={`text-xs mt-1 ${
                  command.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(command.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voice Level Indicator */}
      {isListening && (
        <div className="mb-4 px-4">
          <div className="flex items-center gap-1 justify-center">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-400 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(4, (voiceLevel / 100) * 24 * Math.sin((i / 20) * Math.PI))}px`,
                  opacity: voiceLevel > i * 5 ? 1 : 0.3
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input Controls - Fixed at bottom */}
      <div className="flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={handleVoiceToggle}
            className={`p-3 rounded-full transition-all ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          
          <div className="flex-grow flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Type a command..."
              className="flex-grow px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={() => handleTextSubmit()}
              disabled={!inputText.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Send command"
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="mt-3 flex flex-wrap gap-1">
          {['Status', 'Emergency Stop', 'Help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => handleTextSubmit(cmd)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceControlWidget;