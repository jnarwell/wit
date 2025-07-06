import React, { useState } from 'react';
import { FaTimes, FaMicrophone } from 'react-icons/fa';

interface VoiceControlWidgetProps {
  onRemove?: () => void;
}

const VoiceControlWidget: React.FC<VoiceControlWidgetProps> = ({ onRemove }) => {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Voice Control</h3>
        {onRemove && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 hover:bg-red-600 text-white p-2 rounded-md"
            style={{ touchAction: 'none' }}
          >
            <FaTimes className="text-sm" />
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <button
          onClick={() => setIsListening(!isListening)}
          onMouseDown={(e) => e.stopPropagation()}
          className={`p-6 rounded-full transition-all ${
            isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          <FaMicrophone className={`text-3xl ${isListening ? 'text-white' : 'text-gray-600'}`} />
        </button>
        <p className="text-gray-600 mt-4 mb-4">Click mic or type command</p>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Enter command..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default VoiceControlWidget;