import React, { useState } from 'react';
import { FaCube, FaCog, FaPlay, FaDownload } from 'react-icons/fa';

interface SlicerWidgetProps {
  widget: {
    id: string;
    size: { width: number; height: number };
    data?: any;
  };
}

const SlicerWidget: React.FC<SlicerWidgetProps> = ({ widget }) => {
  const [layerHeight, setLayerHeight] = useState('0.2');
  const [infill, setInfill] = useState(20);
  const [support, setSupport] = useState(false);
  const [printTime, setPrintTime] = useState('2h 34m');
  const [filamentUsage, setFilamentUsage] = useState('24.5g');
  const isCompact = widget.size.width === 1 || widget.size.height === 1;

  const handleSlice = () => {
    // Simulate slicing
    setPrintTime(`${Math.floor(Math.random() * 5) + 1}h ${Math.floor(Math.random() * 60)}m`);
    setFilamentUsage(`${(Math.random() * 50 + 10).toFixed(1)}g`);
  };

  if (isCompact) {
    // Compact view
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-medium flex items-center gap-2">
            <FaCube className="text-green-400" />
            Slicer
          </h3>
          <FaCog className="text-gray-400" size={14} />
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="text-gray-400">
            <span className="text-gray-500">Layer:</span> {layerHeight}mm
          </div>
          <div className="text-gray-400">
            <span className="text-gray-500">Infill:</span> {infill}%
          </div>
          <div className="text-gray-400">
            <span className="text-gray-500">Time:</span> {printTime}
          </div>
        </div>
        <button
          onClick={handleSlice}
          className="mt-2 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded transition-colors flex items-center justify-center gap-1"
        >
          <FaPlay size={10} /> Slice
        </button>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <FaCube className="text-green-400" />
            Slicer Preview
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSlice}
              className="bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded transition-colors flex items-center gap-2"
            >
              <FaPlay size={12} /> Slice
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded transition-colors flex items-center gap-2"
            >
              <FaDownload size={12} /> Export
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Settings Panel */}
        <div className="w-1/3 p-4 border-r border-gray-700 space-y-4">
          <h4 className="text-white font-medium mb-2">Print Settings</h4>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Layer Height</label>
            <select
              value={layerHeight}
              onChange={(e) => setLayerHeight(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="0.1">0.1mm (Fine)</option>
              <option value="0.2">0.2mm (Normal)</option>
              <option value="0.3">0.3mm (Draft)</option>
            </select>
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">
              Infill Density: {infill}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={infill}
              onChange={(e) => setInfill(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="support"
              checked={support}
              onChange={(e) => setSupport(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="support" className="text-gray-400 text-sm">
              Generate Support
            </label>
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="flex-1 p-4">
          <div className="h-full bg-gray-900 rounded-lg flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FaCube size={80} className="text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Model preview will appear here</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="p-4 border-t border-gray-700 grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-400">Print Time</div>
                <div className="text-white font-medium">{printTime}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Material</div>
                <div className="text-white font-medium">{filamentUsage}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Layers</div>
                <div className="text-white font-medium">
                  {Math.floor(20 / Number(layerHeight))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlicerWidget;