// software/frontend/web/src/components/FileBrowser.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './FileBrowser.css';
import ContextMenu from './ContextMenu';

const API_BASE_URL = 'http://localhost:8000';

interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    children: FileNode[];
}

interface ContextMenuState {
    x: number;
    y: number;
    items: { label: string; action: () => void; }[];
}

const FileBrowser: React.FC = () => {
    const { tokens, user } = useAuth();
    const [userFiles, setUserFiles] = useState<FileNode[]>([]);
    const [projectFiles, setProjectFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const fetchFiles = async () => {
        if (!tokens) return;
        setIsLoading(true);
        try {
            const [userRes, projectRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/files/user`, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }),
                fetch(`${API_BASE_URL}/api/v1/files/project/PROJ-551C12CB`, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } })
            ]);
            setUserFiles(await userRes.json());
            setProjectFiles(await projectRes.json());
        } catch (error) {
            console.error("Failed to fetch files:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [tokens]);

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

    const handleContextMenu = (e: React.MouseEvent, node?: FileNode, baseDir?: string, projectId?: string) => {
        e.preventDefault();
        e.stopPropagation();

        const items = [];
        if (node) {
            items.push({ label: 'Rename', action: () => handleRename(node, baseDir, projectId) });
            items.push({ label: 'Delete', action: () => handleDelete(node, baseDir, projectId) });
            if (node.is_dir) {
                items.push({ label: 'New File', action: () => handleCreate('file', node.path, baseDir, projectId) });
                items.push({ label: 'New Folder', action: () => handleCreate('folder', node.path, baseDir, projectId) });
            }
        } else {
            items.push({ label: 'New File', action: () => handleCreate('file', baseDir, baseDir, projectId) });
            items.push({ label: 'New Folder', action: () => handleCreate('folder', baseDir, baseDir, projectId) });
        }

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleRename = async (node: FileNode, baseDir: string, projectId?: string) => {
        closeContextMenu();
        const newName = prompt("Enter new name:", node.name);
        if (newName) {
            const newPath = node.path.substring(0, node.path.lastIndexOf('/') + 1) + newName;
            await fetch(`${API_BASE_URL}/api/v1/files/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` },
                body: JSON.stringify({ data: { path: node.path, new_path: newPath, base_dir: baseDir, project_id: projectId } })
            });
            fetchFiles();
        }
    };

    const handleDelete = async (node: FileNode, baseDir: string, projectId?: string) => {
        closeContextMenu();
        if (confirm(`Are you sure you want to delete ${node.name}?`)) {
            await fetch(`${API_BASE_URL}/api/v1/files/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` },
                body: JSON.stringify({ data: { path: node.path, base_dir: baseDir, project_id: projectId } })
            });
            fetchFiles();
        }
    };

    const handleCreate = async (type: 'file' | 'folder', basePath: string, baseDir: string, projectId?: string) => {
        closeContextMenu();
        const name = prompt(`Enter name for new ${type}:`);
        if (name) {
            const path = `${basePath}/${name}${type === 'folder' ? '/' : ''}`;
            await fetch(`${API_BASE_URL}/api/v1/files/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` },
                body: JSON.stringify({ data: { path, base_dir: baseDir, project_id: projectId } })
            });
            fetchFiles();
        }
    };

    const renderTree = (nodes: FileNode[], baseDir: string, projectId?: string) => (
        <ul>
            {nodes.map(node => (
                <li key={node.path}>
                    <div className="file-entry">
                        {node.is_dir && (
                            <span 
                                className={`arrow ${expandedFolders.has(node.path) ? 'expanded' : ''}`}
                                onClick={() => toggleFolder(node.path)}
                            >
                                &#9654;
                            </span>
                        )}
                        <span 
                            className={node.is_dir ? 'folder' : 'file'} 
                            onContextMenu={(e) => handleContextMenu(e, node, baseDir, projectId)}
                        >
                            {node.name}
                        </span>
                    </div>
                    {node.is_dir && expandedFolders.has(node.path) && node.children.length > 0 && renderTree(node.children, baseDir, projectId)}
                </li>
            ))}
        </ul>
    );

    if (isLoading) return <div className="file-browser">Loading files...</div>;
    if (!user) return <div className="file-browser">User not found.</div>;

    const userBasePath = `storage/users/${user.id}`;
    const projectBasePath = `storage/projects/PROJ-551C12CB`;

    return (
        <div className="file-browser" onContextMenu={(e) => handleContextMenu(e, undefined, 'user')}>
            <div className="file-section">
                <h3>My Files</h3>
                {renderTree(userFiles, 'user')}
            </div>
            <div className="file-section" onContextMenu={(e) => handleContextMenu(e, undefined, 'project', 'PROJ-551C12CB')}>
                <h3>Project Files</h3>
                {renderTree(projectFiles, 'project', 'PROJ-551C12CB')}
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={closeContextMenu} />}
        </div>
    );
};

export default FileBrowser;
