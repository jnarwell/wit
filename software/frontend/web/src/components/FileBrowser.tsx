// software/frontend/web/src/components/FileBrowser.tsx
import React, { useState, useEffect, useRef } from 'react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const uploadInfoRef = useRef<{ basePath: string; baseDir: string; projectId?: string } | null>(null);

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

    const handleContextMenu = (e: React.MouseEvent, node?: FileNode, baseDir?: string, projectId?: string) => {
        e.preventDefault();
        e.stopPropagation();

        const items = [];
        const basePath = node ? (node.is_dir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))) : (baseDir === 'user' ? `storage/users/${user?.id}` : `storage/projects/${projectId}`);

        if (node) {
            items.push({ label: 'Rename', action: () => handleRename(node, baseDir, projectId) });
            items.push({ label: 'Delete', action: () => handleDelete(node, baseDir, projectId) });
        }
        
        items.push({ label: 'New File', action: () => handleCreate('file', basePath, baseDir, projectId) });
        items.push({ label: 'New Folder', action: () => handleCreate('folder', basePath, baseDir, projectId) });
        items.push({ label: 'Upload File', action: () => handleUpload('file', basePath, baseDir, projectId) });
        items.push({ label: 'Upload Folder', action: () => handleUpload('folder', basePath, baseDir, projectId) });

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
        let name = prompt(`Enter name for new ${type}:`);
        if (name) {
            if (type === 'file' && !name.includes('.')) {
                name += '.md'; // Default to markdown if no extension
            }
            const path = `${basePath}/${name}${type === 'folder' ? '/' : ''}`;
            await fetch(`${API_BASE_URL}/api/v1/files/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` },
                body: JSON.stringify({ data: { path, base_dir: baseDir, project_id: projectId } })
            });
            fetchFiles();
        }
    };

    const handleUpload = (type: 'file' | 'folder', basePath: string, baseDir: string, projectId?: string) => {
        closeContextMenu();
        uploadInfoRef.current = { basePath, baseDir, projectId };
        if (type === 'file') {
            fileInputRef.current?.click();
        } else {
            folderInputRef.current?.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadInfoRef.current) return;

        const { basePath, baseDir, projectId } = uploadInfoRef.current;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', basePath);
        formData.append('base_dir', baseDir);
        if (projectId) formData.append('project_id', projectId);

        await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            body: formData
        });
        fetchFiles();
    };

    const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !uploadInfoRef.current) return;

        const { basePath, baseDir, projectId } = uploadInfoRef.current;
        const formData = new FormData();
        
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i], files[i].webkitRelativePath);
        }
        
        formData.append('base_path', basePath);
        formData.append('base_dir', baseDir);
        if (projectId) formData.append('project_id', projectId);

        await fetch(`${API_BASE_URL}/api/v1/files/upload-folder`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            body: formData
        });
        fetchFiles();
    };

    const renderTree = (nodes: FileNode[], baseDir: string, projectId?: string) => (
        <ul>
            {nodes.map(node => (
                <li key={node.path}>
                    <span className={node.is_dir ? 'folder' : 'file'} onContextMenu={(e) => handleContextMenu(e, node, baseDir, projectId)}>{node.name}</span>
                    {node.is_dir && node.children.length > 0 && renderTree(node.children, baseDir, projectId)}
                </li>
            ))}
        </ul>
    );

    if (isLoading) return <div className="file-browser">Loading files...</div>;
    if (!user) return <div className="file-browser">User not found.</div>;

    return (
        <div className="file-browser">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelected} />
            <input type="file" ref={folderInputRef} style={{ display: 'none' }} webkitdirectory="" onChange={handleFolderSelected} />
            <div className="file-section" onContextMenu={(e) => handleContextMenu(e, undefined, 'user')}>
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
