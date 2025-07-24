// software/frontend/web/src/components/FileViewer.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './FileViewer.css';

const API_BASE_URL = 'http://localhost:8000';

type SaveStatus = 'unsaved' | 'saved' | 'error';

interface FileViewerProps {
    path: string;
    baseDir: string;
    projectId?: string;
    onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ path, baseDir, projectId, onClose }) => {
    const { tokens } = useAuth();
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const isMarkdown = path.endsWith('.md');

    useEffect(() => {
        const fetchContent = async () => {
            if (!tokens) return;
            setIsLoading(true);
            
            if (!isMarkdown) {
                setContent("Feature under development. Only .md files can be viewed and edited currently.");
                setIsLoading(false);
                return;
            }

            try {
                const url = `${API_BASE_URL}/api/v1/files/content?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
                if (!response.ok) throw new Error('Failed to fetch file content');
                const data = await response.json();
                setContent(data.content);
                setOriginalContent(data.content);
                setSaveStatus('saved');
            } catch (error) {
                setContent(`Error: ${error instanceof Error ? error.message : 'Could not load file.'}`);
                setSaveStatus('error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [path, baseDir, projectId, tokens, isMarkdown]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        if (e.target.value !== originalContent) {
            setSaveStatus('unsaved');
        } else {
            setSaveStatus('saved');
        }
    };

    const handleSave = useCallback(async () => {
        if (!tokens || !isMarkdown || saveStatus !== 'unsaved') return;
        setIsSaving(true);
        setSaveStatus('unsaved');
        try {
            await fetch(`${API_BASE_URL}/api/v1/files/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.access_token}` },
                body: JSON.stringify({ path, content, base_dir: baseDir, project_id: projectId })
            });
            setOriginalContent(content);
            setSaveStatus('saved');
        } catch (error) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [content, originalContent, tokens, isMarkdown, path, baseDir, projectId, saveStatus]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleSave]);

    const getStatusColor = () => {
        switch (saveStatus) {
            case 'saved': return 'green';
            case 'unsaved': return 'yellow';
            case 'error': return 'red';
        }
    };

    const handleClose = () => {
        if (saveStatus === 'unsaved') {
            if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const getDisplayPath = () => {
        const parts = path.split('/');
        if (baseDir === 'user') {
            const userDirIndex = parts.findIndex(p => p.includes('-')); // Find UUID
            if (userDirIndex !== -1) {
                return `My Files/${parts.slice(userDirIndex + 1).join('/')}`;
            }
        }
        if (baseDir === 'project') {
            const projectDirIndex = parts.findIndex(p => p.startsWith('PROJ-'));
            if (projectDirIndex !== -1) {
                return `Project Files/${parts.slice(projectDirIndex + 1).join('/')}`;
            }
        }
        return path;
    };

    return (
        <div className="file-viewer">
            <div className="file-viewer-header">
                <div className="file-info">
                    <span className="status-indicator" style={{ backgroundColor: getStatusColor() }}></span>
                    <span>{getDisplayPath()}</span>
                </div>
                <div>
                    {isMarkdown && <button onClick={handleSave} disabled={isSaving || saveStatus === 'saved'}>{isSaving ? 'Saving...' : 'Save'}</button>}
                    <button onClick={handleClose}>&times;</button>
                </div>
            </div>
            <div className="file-viewer-content">
                {isLoading ? (
                    <p>Loading...</p>
                ) : (
                    <textarea
                        value={content}
                        onChange={handleContentChange}
                        readOnly={!isMarkdown}
                    />
                )}
            </div>
        </div>
    );
};

export default FileViewer;
