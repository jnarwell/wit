// src/components/widgets/FileExplorerWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaFile, FaFolder, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import FileViewer from '../FileViewer';
import './FileExplorerWidget.css';

const API_BASE_URL = 'http://localhost:8000';

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

interface FileExplorerWidgetProps {
  onRemove: () => void;
}

interface ViewingFile {
  path: string;
  baseDir: string;
}

const FileExplorerWidget: React.FC<FileExplorerWidgetProps> = ({ onRemove }) => {
  const { tokens, user } = useAuth();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<ViewingFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
    fetchFiles();
    
    // Set up WebSocket for file updates
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    
    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/api/v1/files/ws/files');
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'refresh_files') {
              fetchFiles();
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
      }
    };
    
    if (tokens) {
      connectWebSocket();
    }
    
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [tokens, user]);
  
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
  
  const handleFileClick = (node: FileNode) => {
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
        baseDir: 'user'
      });
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
                handleFileClick(node);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {node.is_dir && (
                <span className="folder-icon">
                  {expandedFolders.has(node.path) ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
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
  
  if (selectedFile) {
    return (
      <div className="file-explorer-widget viewing-file h-full">
        <FileViewer
          path={selectedFile.path}
          baseDir={selectedFile.baseDir}
          onClose={() => setSelectedFile(null)}
        />
      </div>
    );
  }
  
  return (
    <div className="file-explorer-widget group">
      <div className="widget-header">
        <h3 className="widget-title">File Explorer</h3>
        <button
          onClick={onRemove}
          className="remove-button opacity-0 group-hover:opacity-100"
        >
          <FaTimes size={14} />
        </button>
      </div>
      
      <div className="widget-content" onMouseDown={(e) => e.stopPropagation()}>
        {isLoading ? (
          <div className="loading">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="empty-state">No files yet</div>
        ) : (
          renderFileTree(files)
        )}
      </div>
    </div>
  );
};

export default FileExplorerWidget;