import React, { useRef, useEffect, useState } from 'react';
import './Simple3DViewer.css';
import { FaCube, FaExpand, FaCompress, FaSync, FaUpload } from 'react-icons/fa';

interface Simple3DViewerProps {
  modelUrl?: string;
  onClose?: () => void;
}

const Simple3DViewer: React.FC<Simple3DViewerProps> = ({ modelUrl, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  useEffect(() => {
    // Initialize 3D scene
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple 3D cube rendering (placeholder for actual 3D library)
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Center point
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const size = 100;

      // Simple wireframe cube
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 2;

      // Draw a rotating cube (simplified)
      const angle = rotation.y;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Front face
      ctx.beginPath();
      ctx.moveTo(centerX - size * cos, centerY - size);
      ctx.lineTo(centerX + size * cos, centerY - size);
      ctx.lineTo(centerX + size * cos, centerY + size);
      ctx.lineTo(centerX - size * cos, centerY + size);
      ctx.closePath();
      ctx.stroke();

      // Back face (with perspective)
      const perspective = 0.7;
      ctx.beginPath();
      ctx.moveTo(centerX - size * cos * perspective + 30 * sin, centerY - size * perspective);
      ctx.lineTo(centerX + size * cos * perspective + 30 * sin, centerY - size * perspective);
      ctx.lineTo(centerX + size * cos * perspective + 30 * sin, centerY + size * perspective);
      ctx.lineTo(centerX - size * cos * perspective + 30 * sin, centerY + size * perspective);
      ctx.closePath();
      ctx.stroke();

      // Connect faces
      ctx.beginPath();
      ctx.moveTo(centerX - size * cos, centerY - size);
      ctx.lineTo(centerX - size * cos * perspective + 30 * sin, centerY - size * perspective);
      ctx.moveTo(centerX + size * cos, centerY - size);
      ctx.lineTo(centerX + size * cos * perspective + 30 * sin, centerY - size * perspective);
      ctx.moveTo(centerX + size * cos, centerY + size);
      ctx.lineTo(centerX + size * cos * perspective + 30 * sin, centerY + size * perspective);
      ctx.moveTo(centerX - size * cos, centerY + size);
      ctx.lineTo(centerX - size * cos * perspective + 30 * sin, centerY + size * perspective);
      ctx.stroke();

      // Add text
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('3D Model Viewer (Demo)', centerX, canvas.height - 20);
    };

    const animate = () => {
      if (!isDragging) {
        setRotation(prev => ({
          ...prev,
          y: prev.y + 0.01
        }));
      }
      render();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [rotation, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;

    setRotation(prev => ({
      ...prev,
      y: prev.y + deltaX * 0.01,
      x: prev.x + deltaY * 0.01
    }));

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const resetView = () => {
    setRotation({ x: 0, y: 0, z: 0 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle file upload (STL, OBJ, etc.)
      console.log('File uploaded:', file.name);
      // In a real implementation, parse and render the 3D file
    }
  };

  return (
    <div className={`simple-3d-viewer ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <label className="upload-button">
            <input
              type="file"
              accept=".stl,.obj,.3mf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <FaUpload />
            <span>Upload Model</span>
          </label>
        </div>
        <div className="toolbar-center">
          <span className="model-name">{modelUrl || 'Demo Cube'}</span>
        </div>
        <div className="toolbar-right">
          <button onClick={resetView} title="Reset View">
            <FaSync />
          </button>
          <button onClick={toggleFullscreen} title="Toggle Fullscreen">
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      <div className="viewer-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        />
      </div>

      <div className="viewer-controls">
        <div className="control-group">
          <label>Rotation X: {rotation.x.toFixed(2)}</label>
          <input
            type="range"
            min="-3.14"
            max="3.14"
            step="0.01"
            value={rotation.x}
            onChange={(e) => setRotation({ ...rotation, x: parseFloat(e.target.value) })}
          />
        </div>
        <div className="control-group">
          <label>Rotation Y: {rotation.y.toFixed(2)}</label>
          <input
            type="range"
            min="-3.14"
            max="3.14"
            step="0.01"
            value={rotation.y}
            onChange={(e) => setRotation({ ...rotation, y: parseFloat(e.target.value) })}
          />
        </div>
        <div className="control-group">
          <label>Rotation Z: {rotation.z.toFixed(2)}</label>
          <input
            type="range"
            min="-3.14"
            max="3.14"
            step="0.01"
            value={rotation.z}
            onChange={(e) => setRotation({ ...rotation, z: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div className="viewer-info">
        <p>Click and drag to rotate • Use sliders for precise control • Upload STL/OBJ files</p>
      </div>
    </div>
  );
};

export default Simple3DViewer;