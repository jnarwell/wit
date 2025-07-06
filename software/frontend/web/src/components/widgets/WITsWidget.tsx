// src/components/widgets/WITsWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaMicrophone, FaCircle } from 'react-icons/fa';

interface WITsWidgetProps {
  onRemove: () => void;
  style: React.CSSProperties;
}

const WITsWidget: React.FC<WITsWidgetProps> = ({ onRemove, style }) => {
  const [isListening, setIsListening] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  // Simulate voice modulation
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setAmplitude(Math.random() * 0.5 + 0.5); // Random amplitude between 0.5 and 1
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAmplitude(0);
    }
  }, [isListening]);

  const handleMicClick = () => {
    setIsListening(!isListening);
    // TODO: Implement actual voice recording
  };

  return (
    <div style={style} className="widget-container group">
      <div className="h-full bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-black bg-opacity-30 p-4 relative">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-xl font-bold">W.I.T.s Assistant</h3>
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={18} />
            </button>
          </div>
        </div>

        {/* Interactive Circle */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative">
            {/* Outer rings for animation */}
            {isListening && (
              <>
                <div 
                  className="absolute inset-0 rounded-full border-2 border-white opacity-20 animate-ping"
                  style={{ 
                    transform: `scale(${1 + amplitude * 0.3})`,
                    transition: 'transform 0.1s ease-out'
                  }}
                />
                <div 
                  className="absolute inset-0 rounded-full border-2 border-white opacity-10 animate-ping"
                  style={{ 
                    animationDelay: '0.2s',
                    transform: `scale(${1 + amplitude * 0.5})`,
                    transition: 'transform 0.1s ease-out'
                  }}
                />
              </>
            )}

            {/* Main circle */}
            <button
              onClick={handleMicClick}
              className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isListening 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/50' 
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/50'
              } shadow-2xl`}
              style={{
                transform: isListening ? `scale(${1 + amplitude * 0.1})` : 'scale(1)',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <FaMicrophone size={40} className="text-white" />
            </button>

            {/* Status indicator */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-2 bg-black bg-opacity-50 rounded-full px-3 py-1">
                <FaCircle 
                  size={8} 
                  className={isListening ? 'text-red-500 animate-pulse' : 'text-gray-400'} 
                />
                <span className="text-white text-sm">
                  {isListening ? 'Listening...' : 'Click to speak'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="p-4 text-center">
          <p className="text-gray-300 text-sm">
            {isListening 
              ? 'Speak your command...' 
              : 'Ready to assist with your workshop needs'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WITsWidget;