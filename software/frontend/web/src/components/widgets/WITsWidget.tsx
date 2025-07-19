// src/components/widgets/WITsWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaMicrophone, FaCircle } from 'react-icons/fa';

interface WITsWidgetProps {
  onRemove: () => void;
}

const WITsWidget: React.FC<WITsWidgetProps> = ({ onRemove }) => {
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
    <div className="widget-container group h-full">
      <div className="h-full bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-black bg-opacity-30 p-4 relative">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-xl font-bold">W.I.T.s Assistant</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
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
              onClick={(e) => {
                e.stopPropagation();
                handleMicClick();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isListening 
                  ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/50' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50'
              }`}
            >
              {isListening ? (
                <FaCircle className="text-white text-4xl animate-pulse" />
              ) : (
                <FaMicrophone className="text-white text-4xl" />
              )}
            </button>
          </div>
        </div>

        {/* Status Text */}
        <div className="p-4 text-center">
          <p className="text-white text-lg font-medium">
            {isListening ? 'Listening...' : 'Click to activate voice control'}
          </p>
          <p className="text-gray-300 text-sm mt-1">
            {isListening ? 'Say "Hey WIT" followed by your command' : 'Voice commands for your workshop'}
          </p>
        </div>

        {/* Command Input */}
        <div className="p-4 border-t border-white border-opacity-20">
          <input
            type="text"
            placeholder="Type a command..."
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-4 py-2 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:bg-opacity-20 focus:border-opacity-40 transition-all"
          />
        </div>
      </div>
    </div>
  );
};

export default WITsWidget;