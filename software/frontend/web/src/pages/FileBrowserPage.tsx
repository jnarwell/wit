import React, { useState, useEffect, useCallback } from 'react';
import { FaFolder, FaFile, FaFolderOpen, FaHome, FaChevronRight, FaArrowUp, FaDownload, FaTrash, FaEdit, FaPlus, FaSearch, FaCopy, FaCut, FaPaste, FaSync, FaEye, FaFileArchive, FaUpload } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './FileBrowserPage.css';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'unknown';
  size?: number;
  modified?: string;
  created?: string;
  permissions?: any;
  isSymlink?: boolean;
  linkTarget?: string;
  mimeType?: string;
  extension?: string;
  error?: string;
}

interface RootPath {
  path: string;
  name: string;
  type: string;
  diskUsage?: {
    total: number;
    free: number;
    used: number;
    percentage: string;
  };
}

interface FileBrowserPageProps {
  onNavigateBack?: () => void;
}

const FileBrowserPage: React.FC<FileBrowserPageProps> = ({ onNavigateBack }) => {
  const { user } = useAuth();
  const { wsStatus, sendCommand } = useUDCWebSocket();
  
  // State
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [rootPaths, setRootPaths] = useState<RootPath[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [clipboard, setClipboard] = useState<{ action: 'copy' | 'cut', items: string[] } | null>(null);
  const [pluginStatus, setPluginStatus] = useState<'active' | 'inactive' | 'error'>('inactive');
  
  // File operations state
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');

  // Load root paths on mount
  useEffect(() => {
    if (wsStatus === 'connected') {
      loadRootPaths();
      checkPluginStatus();
    }
  }, [wsStatus]);

  // Check plugin status
  const checkPluginStatus = useCallback(async () => {
    try {
      const result = await sendCommand('file-browser', 'getStatus');
      if (result && result.state) {
        setPluginStatus(result.state === 'running' ? 'active' : 'inactive');
      }
    } catch (error) {
      console.error('[FileBrowser] Error checking plugin status:', error);
      setPluginStatus('error');
    }
  }, [sendCommand]);

  // Load root paths
  const loadRootPaths = useCallback(async () => {
    try {
      console.log('[FileBrowser] Loading root paths...');
      const result = await sendCommand('file-browser', 'getRoots');
      console.log('[FileBrowser] getRoots result:', result);
      if (result && Array.isArray(result)) {
        setRootPaths(result);
        // Set initial path to first root if available
        if (result.length > 0 && !currentPath) {
          setCurrentPath(result[0].path);
          loadDirectory(result[0].path);
        }
      } else {
        console.error('[FileBrowser] Invalid getRoots result:', result);
        setError('Invalid response from file browser');
      }
    } catch (error) {
      console.error('[FileBrowser] Error loading root paths:', error);
      setError('Failed to load root paths');
    }
  }, [sendCommand, currentPath]);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedItems(new Set());
    
    try {
      console.log('[FileBrowser] Loading directory:', path);
      const result = await sendCommand('file-browser', 'listDirectory', {
        path,
        showHidden
      });
      console.log('[FileBrowser] listDirectory result:', result);
      
      if (result && Array.isArray(result)) {
        setItems(result);
        setCurrentPath(path);
      } else {
        console.error('[FileBrowser] Invalid listDirectory result:', result);
        setError('Invalid response from file browser');
      }
    } catch (error) {
      console.error('[FileBrowser] Error loading directory:', error);
      setError(`Failed to load directory: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [sendCommand, showHidden]);

  // Navigate to parent directory
  const navigateUp = useCallback(() => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    loadDirectory(parentPath);
  }, [currentPath, loadDirectory]);

  // Handle item click
  const handleItemClick = useCallback((item: FileItem) => {
    if (item.type === 'directory') {
      loadDirectory(item.path);
    } else {
      // For files, just select them
      toggleSelection(item.path);
    }
  }, [loadDirectory]);

  // Toggle item selection
  const toggleSelection = useCallback((path: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Select all items
  const selectAll = useCallback(() => {
    setSelectedItems(new Set(items.map(item => item.path)));
  }, [items]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Create new folder
  const createNewFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const folderPath = currentPath === '/' 
        ? `/${newFolderName}` 
        : `${currentPath}/${newFolderName}`;
      console.log('[FileBrowser] Creating folder:', folderPath);
      
      const result = await sendCommand('file-browser', 'createDirectory', {
        path: folderPath
      });
      console.log('[FileBrowser] createDirectory result:', result);
      
      setShowNewFolderDialog(false);
      setNewFolderName('');
      loadDirectory(currentPath); // Refresh
    } catch (error) {
      console.error('[FileBrowser] Error creating folder:', error);
      setError(`Failed to create folder: ${error}`);
      // Don't close dialog on error
    }
  }, [sendCommand, currentPath, newFolderName, loadDirectory]);

  // Delete selected items
  const deleteSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;
    
    const confirmMsg = selectedItems.size === 1 
      ? 'Are you sure you want to delete this item?'
      : `Are you sure you want to delete ${selectedItems.size} items?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      for (const path of selectedItems) {
        await sendCommand('file-browser', 'delete', { path });
      }
      
      clearSelection();
      loadDirectory(currentPath); // Refresh
    } catch (error) {
      console.error('[FileBrowser] Error deleting items:', error);
      setError(`Failed to delete items: ${error}`);
    }
  }, [sendCommand, selectedItems, currentPath, loadDirectory, clearSelection]);

  // Rename item
  const renameItem = useCallback(async () => {
    if (!renameTarget || !newName.trim()) return;
    
    try {
      // Get the parent directory of the item being renamed
      const parentDir = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'));
      const newPath = `${parentDir}/${newName}`;
      
      console.log('[FileBrowser] Renaming:', renameTarget.path, 'to', newPath);
      
      await sendCommand('file-browser', 'rename', {
        oldPath: renameTarget.path,
        newPath
      });
      
      setShowRenameDialog(false);
      setRenameTarget(null);
      setNewName('');
      loadDirectory(currentPath); // Refresh
    } catch (error) {
      console.error('[FileBrowser] Error renaming item:', error);
      setError(`Failed to rename item: ${error}`);
    }
  }, [sendCommand, renameTarget, newName, currentPath, loadDirectory]);

  // Copy selected items
  const copySelected = useCallback(() => {
    if (selectedItems.size === 0) return;
    setClipboard({ action: 'copy', items: Array.from(selectedItems) });
  }, [selectedItems]);

  // Cut selected items
  const cutSelected = useCallback(() => {
    if (selectedItems.size === 0) return;
    setClipboard({ action: 'cut', items: Array.from(selectedItems) });
  }, [selectedItems]);

  // Paste items
  const pasteItems = useCallback(async () => {
    if (!clipboard || clipboard.items.length === 0) return;
    
    try {
      for (const sourcePath of clipboard.items) {
        const itemName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
        const destinationPath = `${currentPath}/${itemName}`;
        
        if (clipboard.action === 'copy') {
          await sendCommand('file-browser', 'copy', {
            source: sourcePath,
            destination: destinationPath
          });
        } else {
          await sendCommand('file-browser', 'move', {
            source: sourcePath,
            destination: destinationPath
          });
        }
      }
      
      if (clipboard.action === 'cut') {
        setClipboard(null); // Clear clipboard after cut
      }
      
      clearSelection();
      loadDirectory(currentPath); // Refresh
    } catch (error) {
      console.error('[FileBrowser] Error pasting items:', error);
      setError(`Failed to paste items: ${error}`);
    }
  }, [sendCommand, clipboard, currentPath, loadDirectory, clearSelection]);

  // Open with default application
  const openWithDefault = useCallback(async (item: FileItem) => {
    try {
      await sendCommand('file-browser', 'openWithDefault', {
        path: item.path
      });
    } catch (error) {
      console.error('[FileBrowser] Error opening file:', error);
      setError(`Failed to open file: ${error}`);
    }
  }, [sendCommand]);

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get file icon
  const getFileIcon = (item: FileItem) => {
    if (item.type === 'directory') {
      return <FaFolder className="text-yellow-500" />;
    }
    
    if (item.extension === '.zip' || item.extension === '.tar' || item.extension === '.gz') {
      return <FaFileArchive className="text-purple-500" />;
    }
    
    return <FaFile className="text-gray-500" />;
  };

  // Filter items based on search
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="file-browser-page">
      <div className="file-browser-header">
        <div className="header-top">
          <button onClick={onNavigateBack} className="back-button">
            ← Back to Integrations
          </button>
          <h1>File Browser</h1>
          <div className="plugin-status">
            <span className={`status-indicator ${pluginStatus}`}></span>
            {pluginStatus === 'active' ? 'Active' : pluginStatus === 'error' ? 'Error' : 'Inactive'}
          </div>
        </div>

        <div className="header-controls">
          <div className="path-bar">
            <button onClick={() => loadDirectory('/')} className="path-button">
              <FaHome />
            </button>
            <span className="path-separator">/</span>
            {currentPath.split('/').filter(p => p).map((segment, index, arr) => {
              const path = '/' + arr.slice(0, index + 1).join('/');
              return (
                <React.Fragment key={index}>
                  <button
                    onClick={() => loadDirectory(path)}
                    className="path-segment"
                  >
                    {segment}
                  </button>
                  {index < arr.length - 1 && <span className="path-separator">/</span>}
                </React.Fragment>
              );
            })}
          </div>

          <div className="search-bar">
            <FaSearch />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar">
          <button onClick={() => loadDirectory(currentPath)} title="Refresh">
            <FaSync />
          </button>
          <button onClick={navigateUp} title="Up" disabled={currentPath === '/'}>
            <FaArrowUp />
          </button>
          <button onClick={() => setShowNewFolderDialog(true)} title="New Folder">
            <FaPlus /> New Folder
          </button>
          
          <div className="separator" />
          
          <button onClick={selectAll} title="Select All">
            Select All
          </button>
          <button onClick={clearSelection} title="Clear Selection" disabled={selectedItems.size === 0}>
            Clear
          </button>
          
          <div className="separator" />
          
          <button onClick={copySelected} disabled={selectedItems.size === 0} title="Copy">
            <FaCopy />
          </button>
          <button onClick={cutSelected} disabled={selectedItems.size === 0} title="Cut">
            <FaCut />
          </button>
          <button onClick={pasteItems} disabled={!clipboard} title="Paste">
            <FaPaste />
          </button>
          <button onClick={deleteSelected} disabled={selectedItems.size === 0} title="Delete">
            <FaTrash />
          </button>
          
          <div className="separator" />
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show Hidden
          </label>
        </div>
      </div>

      <div className="file-browser-content">
        <div className="sidebar">
          <h3>Quick Access</h3>
          {rootPaths.map(root => (
            <button
              key={root.path}
              className={`root-path ${currentPath === root.path ? 'active' : ''}`}
              onClick={() => loadDirectory(root.path)}
            >
              <FaFolder />
              <span>{root.name}</span>
              {root.diskUsage && (
                <div className="disk-usage">
                  <div className="usage-bar">
                    <div 
                      className="usage-fill"
                      style={{ width: root.diskUsage.percentage }}
                    />
                  </div>
                  <span className="usage-text">
                    {formatSize(root.diskUsage.used)} / {formatSize(root.diskUsage.total)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="file-list">
          {loading && <div className="loading">Loading...</div>}
          {error && <div className="error">{error}</div>}
          
          {!loading && !error && (
            <table className="file-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === items.length && items.length > 0}
                      onChange={() => selectedItems.size === items.length ? clearSelection() : selectAll()}
                    />
                  </th>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr 
                    key={item.path} 
                    className={`file-row ${selectedItems.has(item.path) ? 'selected' : ''}`}
                    onDoubleClick={() => handleItemClick(item)}
                  >
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.path)}
                        onChange={() => toggleSelection(item.path)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="name-col">
                      <span className="file-icon">{getFileIcon(item)}</span>
                      <span className="file-name" onClick={() => handleItemClick(item)}>
                        {item.name}
                        {item.isSymlink && ` → ${item.linkTarget}`}
                      </span>
                    </td>
                    <td className="size-col">{formatSize(item.size)}</td>
                    <td className="date-col">{formatDate(item.modified)}</td>
                    <td className="actions-col">
                      {item.type === 'file' && (
                        <button 
                          onClick={() => openWithDefault(item)}
                          title="Open"
                          className="action-button"
                        >
                          <FaEye />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setRenameTarget(item);
                          setNewName(item.name);
                          setShowRenameDialog(true);
                        }}
                        title="Rename"
                        className="action-button"
                      >
                        <FaEdit />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {!loading && !error && filteredItems.length === 0 && (
            <div className="empty-state">
              {searchQuery ? 'No files match your search' : 'This folder is empty'}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="dialog-overlay" onClick={() => setShowNewFolderDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNewFolder()}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => setShowNewFolderDialog(false)}>Cancel</button>
              <button onClick={createNewFolder} disabled={!newFolderName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && renameTarget && (
        <div className="dialog-overlay" onClick={() => setShowRenameDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename {renameTarget.type === 'directory' ? 'Folder' : 'File'}</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renameItem()}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => setShowRenameDialog(false)}>Cancel</button>
              <button onClick={renameItem} disabled={!newName.trim()}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileBrowserPage;