import React, { useState } from 'react';
import { FaCube, FaExpand, FaCompress, FaSync, FaUpload } from 'react-icons/fa';
import Simple3DViewer from '../tools/Simple3DViewer';

interface ThreeDViewerWidgetProps {
  widget: {
    id: string;
    size: { width: number; height: number };
    data?: any;
  };
}

const ThreeDViewerWidget: React.FC<ThreeDViewerWidgetProps> = ({ widget }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const isCompact = widget.size.width === 1 || widget.size.height === 1;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real implementation, this would load the 3D file
      setCurrentModel(file.name);
    }
  };

  if (isCompact) {
    // Compact view
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-medium flex items-center gap-2">
            <FaCube className="text-blue-400" />
            3D Viewer
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FaCube size={48} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-xs">
              {currentModel || 'No model loaded'}
            </p>
          </div>
        </div>
        <label className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded cursor-pointer text-center transition-colors">
          <input
            type="file"
            accept=".stl,.obj,.3mf"
            onChange={handleFileUpload}
            className="hidden"
          />
          Load Model
        </label>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <FaCube className="text-blue-400" />
            3D Model Viewer
          </h3>
          <div className="flex gap-2">
            <label className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded cursor-pointer transition-colors flex items-center gap-2">
              <FaUpload size={14} />
              <input
                type="file"
                accept=".stl,.obj,.3mf"
                onChange={handleFileUpload}
                className="hidden"
              />
              Upload
            </label>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          </div>
        </div>
        {currentModel && (
          <p className="text-gray-400 text-sm mt-1">Model: {currentModel}</p>
        )}
      </div>
      
      <div className="flex-1 p-4">
        <Simple3DViewer modelUrl={currentModel} />
      </div>
    </div>
  );
};

export default ThreeDViewerWidget;