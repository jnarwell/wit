// software/frontend/web/src/components/ProjectFileBrowser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FileViewer from './FileViewer';
import ContextMenu from './ContextMenu';
import './ProjectFileBrowser.css';

const API_BASE_URL = 'http://localhost:8000';

interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FileNode[];
    size?: number;
    modified?: string;
}

interface ContextMenuState {
    x: number;
    y: number;
    items: { label: string; action: () => void; icon?: string; }[];
}

interface ProjectFileBrowserProps {
    projectId: string;
    baseDir?: 'project' | 'user';
    onFileSelect?: (path: string) => void;
}

const ProjectFileBrowser: React.FC<ProjectFileBrowserProps> = ({ 
    projectId, 
    baseDir = 'project',
    onFileSelect 
}) => {
    const { tokens, user } = useAuth();
    const [files, setFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [viewerFile, setViewerFile] = useState<{ path: string; baseDir: string; projectId: string } | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const uploadInfoRef = useRef<{ basePath: string } | null>(null);
    const browserRef = useRef<HTMLDivElement>(null);

    const fetchFiles = async () => {
        if (!tokens || !projectId) return;
        setIsLoading(true);
        try {
            const endpoint = baseDir === 'project' 
                ? `${API_BASE_URL}/api/v1/files/project/${projectId}`
                : `${API_BASE_URL}/api/v1/files/user`;
                
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                setFiles(Array.isArray(data) ? data : [data]);
            }
        } catch (error) {
            console.error("Failed to fetch files:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();

        // WebSocket for real-time updates
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connectWebSocket = () => {
            try {
                ws = new WebSocket(`ws://localhost:8000/api/v1/files/ws/project/${projectId}`);
                
                ws.onopen = () => {
                    console.log('Project file WebSocket connected');
                };
                
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
                
                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
                
                ws.onclose = () => {
                    console.log('WebSocket closed, attempting reconnect in 5 seconds...');
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
    }, [tokens, projectId]);

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
            setSelectedFile(node.path);
            setViewerFile({ path: node.path, baseDir, projectId });
            onFileSelect?.(node.path);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, node?: FileNode) => {
        e.preventDefault();
        e.stopPropagation();

        const items = [];
        const basePath = node ? (node.is_dir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))) : '';

        if (node && !node.is_dir) {
            items.push({ 
                label: 'Open', 
                action: () => handleFileClick(node),
                icon: '📄'
            });
            items.push({ 
                label: 'Open in New Tab', 
                action: () => window.open(`/file/${node.path}`, '_blank'),
                icon: '🔗'
            });
            items.push({ label: 'separator', action: () => {} });
        }

        if (node) {
            items.push({ 
                label: 'Rename', 
                action: () => handleRename(node),
                icon: '✏️'
            });
            items.push({ 
                label: 'Delete', 
                action: () => handleDelete(node),
                icon: '🗑️'
            });
            items.push({ label: 'separator', action: () => {} });
        }
        
        items.push({ 
            label: 'New File', 
            action: () => handleCreate('file', basePath),
            icon: '📄'
        });
        items.push({ 
            label: 'New Folder', 
            action: () => handleCreate('folder', basePath),
            icon: '📁'
        });
        items.push({ label: 'separator', action: () => {} });
        items.push({ 
            label: 'Upload File', 
            action: () => handleUpload('file', basePath),
            icon: '⬆️'
        });
        items.push({ 
            label: 'Upload Folder', 
            action: () => handleUpload('folder', basePath),
            icon: '📁⬆️'
        });

        if (node && !node.is_dir) {
            items.push({ label: 'separator', action: () => {} });
            items.push({ 
                label: 'Download', 
                action: () => handleDownload(node),
                icon: '⬇️'
            });
        }

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleRename = async (node: FileNode) => {
        closeContextMenu();
        const newName = prompt("Enter new name:", node.name);
        if (newName && newName !== node.name) {
            const newPath = node.path.substring(0, node.path.lastIndexOf('/') + 1) + newName;
            try {
                await fetch(`${API_BASE_URL}/api/v1/files/rename`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${tokens?.access_token}` 
                    },
                    body: JSON.stringify({ 
                        path: node.path, 
                        new_path: newPath, 
                        base_dir: baseDir, 
                        project_id: projectId 
                    })
                });
                fetchFiles();
            } catch (error) {
                console.error('Failed to rename:', error);
                alert('Failed to rename file/folder');
            }
        }
    };

    const handleDelete = async (node: FileNode) => {
        closeContextMenu();
        if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
            try {
                await fetch(`${API_BASE_URL}/api/v1/files/delete`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${tokens?.access_token}` 
                    },
                    body: JSON.stringify({ 
                        path: node.path, 
                        base_dir: baseDir, 
                        project_id: projectId 
                    })
                });
                fetchFiles();
                if (viewerFile?.path === node.path) {
                    setViewerFile(null);
                }
            } catch (error) {
                console.error('Failed to delete:', error);
                alert('Failed to delete file/folder');
            }
        }
    };

    const handleCreate = async (type: 'file' | 'folder', basePath: string) => {
        closeContextMenu();
        let name = prompt(`Enter name for new ${type}:`);
        if (name) {
            if (type === 'file' && !name.includes('.')) {
                const ext = prompt('Enter file extension (e.g., txt, md, js):', 'txt');
                name += `.${ext}`;
            }
            const path = basePath ? `${basePath}/${name}` : name;
            try {
                await fetch(`${API_BASE_URL}/api/v1/files/create`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${tokens?.access_token}` 
                    },
                    body: JSON.stringify({ 
                        path: path + (type === 'folder' ? '/' : ''), 
                        base_dir: baseDir, 
                        project_id: projectId 
                    })
                });
                fetchFiles();
            } catch (error) {
                console.error('Failed to create:', error);
                alert(`Failed to create ${type}`);
            }
        }
    };

    const handleUpload = (type: 'file' | 'folder', basePath: string) => {
        closeContextMenu();
        uploadInfoRef.current = { basePath };
        if (type === 'file') {
            fileInputRef.current?.click();
        } else {
            folderInputRef.current?.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !uploadInfoRef.current || !tokens) return;

        const { basePath } = uploadInfoRef.current;
        const formData = new FormData();
        
        for (let i = 0; i < files.length; i++) {
            formData.append('file', files[i]);
        }
        
        formData.append('path', basePath);
        formData.append('base_dir', baseDir);
        formData.append('project_id', projectId);

        try {
            await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokens.access_token}` },
                body: formData
            });
            fetchFiles();
        } catch (error) {
            console.error('Failed to upload:', error);
            alert('Failed to upload file(s)');
        }
        
        e.target.value = ''; // Reset input
    };

    const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !uploadInfoRef.current || !tokens) return;

        const { basePath } = uploadInfoRef.current;
        const formData = new FormData();
        
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i], files[i].webkitRelativePath);
        }
        
        formData.append('base_path', basePath);
        formData.append('base_dir', baseDir);
        formData.append('project_id', projectId);

        try {
            await fetch(`${API_BASE_URL}/api/v1/files/upload-folder`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokens.access_token}` },
                body: formData
            });
            fetchFiles();
        } catch (error) {
            console.error('Failed to upload folder:', error);
            alert('Failed to upload folder');
        }
        
        e.target.value = ''; // Reset input
    };

    const handleDownload = async (node: FileNode) => {
        closeContextMenu();
        const url = `${API_BASE_URL}/api/v1/files/download?path=${encodeURIComponent(node.path)}&base_dir=${baseDir}&project_id=${projectId}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = node.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDragOver = (e: React.DragEvent, path?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(path || 'root');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);
    };

    const handleDrop = async (e: React.DragEvent, targetPath?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const formData = new FormData();
        files.forEach(file => formData.append('file', file));
        formData.append('path', targetPath || '');
        formData.append('base_dir', baseDir);
        formData.append('project_id', projectId);

        try {
            await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokens?.access_token}` },
                body: formData
            });
            fetchFiles();
        } catch (error) {
            console.error('Failed to upload via drag:', error);
            alert('Failed to upload files');
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString();
    };

    const renderTree = (nodes: FileNode[], level = 0) => (
        <ul className="file-tree" style={{ paddingLeft: level > 0 ? '20px' : '0' }}>
            {nodes.map(node => {
                const isExpanded = expandedFolders.has(node.path);
                const isSelected = selectedFile === node.path;
                
                return (
                    <li 
                        key={node.path} 
                        className={`file-node ${dragOver === node.path ? 'drag-over' : ''}`}
                        onDragOver={(e) => node.is_dir && handleDragOver(e, node.path)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => node.is_dir && handleDrop(e, node.path)}
                    >
                        <div 
                            className={`file-item ${node.is_dir ? 'folder' : 'file'} ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleFileClick(node)}
                            onContextMenu={(e) => handleContextMenu(e, node)}
                        >
                            <span className="file-icon">
                                {node.is_dir ? (isExpanded ? '📂' : '📁') : '📄'}
                            </span>
                            <span className="file-name">{node.name}</span>
                            {!node.is_dir && (
                                <span className="file-info">
                                    <span className="file-size">{formatFileSize(node.size)}</span>
                                    <span className="file-date">{formatDate(node.modified)}</span>
                                </span>
                            )}
                        </div>
                        {node.is_dir && isExpanded && node.children.length > 0 && (
                            renderTree(node.children, level + 1)
                        )}
                    </li>
                );
            })}
        </ul>
    );

    return (
        <div className="project-file-browser" ref={browserRef}>
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelected}
                multiple 
            />
            <input 
                type="file" 
                ref={folderInputRef} 
                style={{ display: 'none' }} 
                webkitdirectory="" 
                onChange={handleFolderSelected} 
            />
            
            <div className="browser-container">
                <div 
                    className="file-tree-container"
                    onContextMenu={(e) => handleContextMenu(e)}
                    onDragOver={(e) => handleDragOver(e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e)}
                >
                    <div className="browser-header">
                        <h3>📁 Project Files</h3>
                        <div className="browser-actions">
                            <button 
                                onClick={() => handleCreate('file', '')} 
                                title="New File"
                                className="action-btn"
                            >
                                📄+
                            </button>
                            <button 
                                onClick={() => handleCreate('folder', '')} 
                                title="New Folder"
                                className="action-btn"
                            >
                                📁+
                            </button>
                            <button 
                                onClick={() => handleUpload('file', '')} 
                                title="Upload File"
                                className="action-btn"
                            >
                                ⬆️
                            </button>
                            <button 
                                onClick={fetchFiles} 
                                title="Refresh"
                                className="action-btn"
                            >
                                🔄
                            </button>
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="loading">Loading files...</div>
                    ) : files.length === 0 ? (
                        <div className="empty-state">
                            <p>No files yet</p>
                            <p className="hint">Right-click or use buttons above to add files</p>
                        </div>
                    ) : (
                        renderTree(files)
                    )}
                </div>
                
                {viewerFile && (
                    <div className="file-viewer-container">
                        <FileViewer
                            path={viewerFile.path}
                            baseDir={viewerFile.baseDir}
                            projectId={viewerFile.projectId}
                            onClose={() => setViewerFile(null)}
                        />
                    </div>
                )}
            </div>
            
            {contextMenu && (
                <ContextMenu 
                    {...contextMenu} 
                    onClose={closeContextMenu} 
                />
            )}
        </div>
    );
};

export default ProjectFileBrowser;