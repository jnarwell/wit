// src/components/widgets/FileViewerWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaFile, FaFolder, FaEdit } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import FileViewer from '../FileViewer';
import './FileViewerWidget.css';

const API_BASE_URL = 'http://localhost:8000';

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

interface FileViewerWidgetProps {
  onRemove: () => void;
  initialFile?: {
    path: string;
    baseDir: string;
  };
}

interface SelectedFile {
  path: string;
  baseDir: string;
  name: string;
}

const FileViewerWidget: React.FC<FileViewerWidgetProps> = ({ onRemove, initialFile }) => {
  const { tokens, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(
    initialFile ? { ...initialFile, name: initialFile.path.split('/').pop() || 'File' } : null
  );
  const [showFilePicker, setShowFilePicker] = useState(!initialFile);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchFiles = async () => {
    if (!tokens || !user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/files/user`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (showFilePicker) {
      fetchFiles();
    }
  }, [showFilePicker, tokens, user]);
  
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };
  
  const handleFileSelect = (node: FileNode) => {
    if (node.is_dir) {
      toggleFolder(node.path);
    } else {
      // Extract relative path from the full path
      let relativePath = node.path;
      const userPrefix = `storage/users/${user?.id}/`;
      if (relativePath.startsWith(userPrefix)) {
        relativePath = relativePath.substring(userPrefix.length);
      }
      
      setSelectedFile({
        path: relativePath,
        baseDir: 'user',
        name: node.name
      });
      setShowFilePicker(false);
    }
  };
  
  const renderFileTree = (nodes: FileNode[], level: number = 0): JSX.Element => {
    return (
      <div className="file-tree" style={{ paddingLeft: `${level * 12}px` }}>
        {nodes.map(node => (
          <div key={node.path} className="file-node">
            <div 
              className={`file-item ${node.is_dir ? 'folder' : 'file'}`}
              onClick={(e) => {
                e.stopPropagation();
                handleFileSelect(node);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {node.is_dir && (
                <span className="folder-icon">
                  {expandedFolders.has(node.path) ? '▼' : '▶'}
                </span>
              )}
              {node.is_dir ? <FaFolder size={12} /> : <FaFile size={12} />}
              <span className="file-name">{node.name}</span>
            </div>
            {node.is_dir && expandedFolders.has(node.path) && node.children.length > 0 && 
              renderFileTree(node.children, level + 1)
            }
          </div>
        ))}
      </div>
    );
  };
  
  if (showFilePicker) {
    return (
      <div className="file-viewer-widget group">
        <div className="widget-header">
          <h3 className="widget-title">Select a File</h3>
          <button
            onClick={onRemove}
            className="remove-button opacity-0 group-hover:opacity-100"
          >
            <FaTimes size={14} />
          </button>
        </div>
        
        <div className="widget-content file-picker" onMouseDown={(e) => e.stopPropagation()}>
          {isLoading ? (
            <div className="loading">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="empty-state">No files available</div>
          ) : (
            renderFileTree(files)
          )}
        </div>
        
        {selectedFile && (
          <div className="widget-footer">
            <button 
              onClick={() => setShowFilePicker(false)}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }
  
  if (!selectedFile) {
    return (
      <div className="file-viewer-widget group">
        <div className="widget-header">
          <h3 className="widget-title">File Viewer</h3>
          <button
            onClick={onRemove}
            className="remove-button opacity-0 group-hover:opacity-100"
          >
            <FaTimes size={14} />
          </button>
        </div>
        
        <div className="widget-content empty" onMouseDown={(e) => e.stopPropagation()}>
          <div className="empty-state">
            <FaFile size={32} className="empty-icon" />
            <p>No file selected</p>
            <button 
              onClick={() => setShowFilePicker(true)}
              className="select-file-button"
            >
              Select File
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="file-viewer-widget viewing-file h-full">
      <div className="file-viewer-header">
        <h3 className="file-name">{selectedFile.name}</h3>
        <div className="file-actions">
          <button
            onClick={() => setShowFilePicker(true)}
            className="change-file-button"
            title="Change file"
          >
            <FaEdit size={14} />
          </button>
          <button
            onClick={onRemove}
            className="remove-button"
            title="Remove widget"
          >
            <FaTimes size={14} />
          </button>
        </div>
      </div>
      <div className="file-viewer-content" onMouseDown={(e) => e.stopPropagation()}>
        <FileViewer
          path={selectedFile.path}
          baseDir={selectedFile.baseDir}
          onClose={() => {}}
        />
      </div>
    </div>
  );
};

export default FileViewerWidget;