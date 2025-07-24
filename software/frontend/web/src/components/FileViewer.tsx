// software/frontend/web/src/components/FileViewer.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './FileViewer.css';
import PdfViewer from './PdfViewer';
import './PdfViewer.css';
import { CodeViewer, getLanguageFromExtension } from './CodeViewer';
import './CodeViewer.css';
import XmlViewer from './XmlViewer';
import MarkupViewer from './MarkupViewer';
import './MarkupViewer.css';

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
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [jsonData, setJsonData] = useState<any>(null);
    const [jsonlData, setJsonlData] = useState<any[]>([]);
    
    const fileExtension = path.split('.').pop()?.toLowerCase();
    const fileName = path.split('/').pop() || '';
    
    // Define supported code extensions
    const codeExtensions = new Set([
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
        'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'r', 'm', 'lua', 'dart', 'scala',
        'hs', 'ex', 'exs', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
        'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties', 'xml',
        'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'sql', 'graphql', 'gql',
        'diff', 'patch', 'dockerfile', 'makefile', 'gitignore', 'dockerignore', 'editorconfig'
    ]);
    
    // Define markup/documentation extensions
    const markupExtensions = new Set([
        'adoc', 'asciidoc', 'asc', 'rst', 'rest', 'tex', 'latex', 'org'
    ]);
    
    // Editable code/config files
    const editableCodeExtensions = new Set([
        'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties',
        'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
        'gitignore', 'dockerignore', 'editorconfig'
    ]);
    
    // Special case for files without extensions
    const isSpecialFile = ['dockerfile', 'makefile', 'gitignore', 'dockerignore', 'editorconfig'].includes(fileName.toLowerCase());
    
    const isEditable = fileExtension === 'md' || fileExtension === 'txt' || fileExtension === 'log';
    const isEditableCode = (fileExtension && editableCodeExtensions.has(fileExtension)) || 
                          ['gitignore', 'dockerignore', 'editorconfig'].includes(fileName.toLowerCase());
    const isCsv = fileExtension === 'csv';
    const isTsv = fileExtension === 'tsv';
    const isJson = fileExtension === 'json';
    const isJsonl = fileExtension === 'jsonl' || fileExtension === 'ndjson';
    const isLog = fileExtension === 'log';
    const isRtf = fileExtension === 'rtf';
    const isDoc = fileExtension === 'doc' || fileExtension === 'docx';
    const isPdf = fileExtension === 'pdf';
    const isXml = fileExtension === 'xml';
    const isCode = (fileExtension && codeExtensions.has(fileExtension) && !isXml) || isSpecialFile;
    const isMarkup = fileExtension && markupExtensions.has(fileExtension);
    const isViewable = isEditable || isCsv || isTsv || isJson || isJsonl || isRtf || isDoc || isPdf || isCode || isXml || isMarkup;

    const parseDelimitedData = (text: string, delimiter: string) => {
        const rows: string[][] = [];
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
            if (delimiter === '\t') {
                // For TSV, simple split is usually sufficient
                rows.push(line.split('\t').map(cell => cell.trim()));
            } else {
                // For CSV, handle quoted values
                const row: string[] = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    
                    if (char === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            current += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === delimiter && !inQuotes) {
                        row.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                
                row.push(current.trim());
                rows.push(row);
            }
        }
        
        setCsvData(rows);
    };

    useEffect(() => {
        const fetchContent = async () => {
            if (!tokens) return;
            setIsLoading(true);
            
            if (!isViewable) {
                setContent(`.${fileExtension} files are not supported for viewing yet.`);
                setIsLoading(false);
                return;
            }
            
            // Skip API call for PDF files (handled separately)
            if (isPdf) {
                setIsLoading(false);
                return;
            }

            try {
                // Use parse endpoint for RTF and DOCX files
                const endpoint = (isRtf || isDoc) ? 'parse' : 'content';
                const url = `${API_BASE_URL}/api/v1/files/${endpoint}?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${tokens.access_token}` } });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to fetch file content');
                }
                const data = await response.json();
                
                setContent(data.content);
                setOriginalContent(data.content);
                
                if (isCsv) {
                    parseDelimitedData(data.content, ',');
                } else if (isTsv) {
                    parseDelimitedData(data.content, '\t');
                } else if (isJson) {
                    try {
                        setJsonData(JSON.parse(data.content));
                    } catch (e) {
                        setJsonData(null);
                        setContent(data.content); // Fall back to raw text
                    }
                } else if (isJsonl) {
                    try {
                        const lines = data.content.trim().split('\n');
                        const parsedLines = lines.map((line, index) => {
                            try {
                                return JSON.parse(line);
                            } catch (e) {
                                return { _error: `Line ${index + 1}: Invalid JSON`, _raw: line };
                            }
                        });
                        setJsonlData(parsedLines);
                    } catch (e) {
                        setJsonlData([]);
                        setContent(data.content); // Fall back to raw text
                    }
                }
                
                setSaveStatus('saved');
            } catch (error) {
                setContent(`Error: ${error instanceof Error ? error.message : 'Could not load file.'}`);
                setSaveStatus('error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, [path, baseDir, projectId, tokens, isViewable, isCsv, isTsv, isJson, isJsonl, isPdf, isRtf, isDoc, fileExtension]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        if (e.target.value !== originalContent) {
            setSaveStatus('unsaved');
        } else {
            setSaveStatus('saved');
        }
    };

    const handleSave = useCallback(async () => {
        if (!tokens || !isEditable || saveStatus !== 'unsaved') return;
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
    }, [content, originalContent, tokens, isEditable, path, baseDir, projectId, saveStatus]);

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

    const renderJsonContent = (data: any, indent: number = 0): React.ReactNode => {
        const spacing = '  '.repeat(indent);
        
        if (data === null) return <span className="json-null">null</span>;
        if (typeof data === 'boolean') return <span className="json-boolean">{data.toString()}</span>;
        if (typeof data === 'number') return <span className="json-number">{data}</span>;
        if (typeof data === 'string') return <span className="json-string">"{data}"</span>;
        
        if (Array.isArray(data)) {
            if (data.length === 0) return <span>[]</span>;
            return (
                <span>
                    [<br />
                    {data.map((item, index) => (
                        <span key={index}>
                            {spacing}  {renderJsonContent(item, indent + 1)}
                            {index < data.length - 1 ? ',' : ''}
                            <br />
                        </span>
                    ))}
                    {spacing}]
                </span>
            );
        }
        
        if (typeof data === 'object') {
            const entries = Object.entries(data);
            if (entries.length === 0) return <span>{}</span>;
            return (
                <span>
                    {'{'}<br />
                    {entries.map(([key, value], index) => (
                        <span key={key}>
                            {spacing}  <span className="json-key">"{key}"</span>: {renderJsonContent(value, indent + 1)}
                            {index < entries.length - 1 ? ',' : ''}
                            <br />
                        </span>
                    ))}
                    {spacing}{'}'}
                </span>
            );
        }
        
        return <span>{String(data)}</span>;
    };

    const renderContent = () => {
        if (isLoading) {
            return <p>Loading...</p>;
        }
        
        if (isPdf) {
            const downloadUrl = `${API_BASE_URL}/api/v1/files/download?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
            return <PdfViewer url={downloadUrl} authToken={tokens?.access_token} />;
        }
        
        if (isDoc) {
            return (
                <div className="document-content">
                    <div className="document-header">
                        <span className="document-type">{fileExtension?.toUpperCase()} Document</span>
                        <span className="document-path">{getDisplayPath()}</span>
                    </div>
                    <div className="document-text">
                        {content.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph || '\u00A0'}</p>
                        ))}
                    </div>
                </div>
            );
        }
        
        if (isRtf) {
            return (
                <div className="document-content">
                    <div className="document-header">
                        <span className="document-type">RTF Document</span>
                        <span className="document-path">{getDisplayPath()}</span>
                    </div>
                    <div className="document-text">
                        {content.split('\n').map((paragraph, index) => (
                            <p key={index}>{paragraph || '\u00A0'}</p>
                        ))}
                    </div>
                </div>
            );
        }
        
        if (isJson && jsonData) {
            return (
                <div className="json-viewer">
                    <pre>{renderJsonContent(jsonData)}</pre>
                </div>
            );
        }
        
        if (isJsonl && jsonlData.length > 0) {
            return (
                <div className="jsonl-viewer">
                    <div className="jsonl-header">
                        <span className="jsonl-type">JSONL/NDJSON Data</span>
                        <span className="jsonl-info">{jsonlData.length} records</span>
                    </div>
                    <div className="jsonl-content">
                        {jsonlData.map((item, index) => (
                            <div key={index} className="jsonl-record">
                                <div className="record-number">Record {index + 1}</div>
                                {item._error ? (
                                    <div className="record-error">
                                        <div className="error-message">{item._error}</div>
                                        <pre className="error-raw">{item._raw}</pre>
                                    </div>
                                ) : (
                                    <pre>{renderJsonContent(item)}</pre>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        if (isCsv || isTsv) {
            if (csvData.length === 0) {
                return <p>No {isCsv ? 'CSV' : 'TSV'} data to display</p>;
            }
            
            return (
                <div className="csv-wrapper">
                    <div className="table-header">
                        <span className="table-type">{isCsv ? 'CSV' : 'TSV'} Data</span>
                        <span className="table-info">{csvData.length} rows × {csvData[0]?.length || 0} columns</span>
                    </div>
                    <table className="csv-table">
                        <thead>
                            <tr>
                                {csvData[0]?.map((header, index) => (
                                    <th key={index}>
                                        {header || `Column ${index + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvData.slice(1).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} title={cell}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        
        if (isXml) {
            return <XmlViewer content={content} fileName={fileName} />;
        }
        
        if (isMarkup) {
            let format: 'asciidoc' | 'rst' | 'latex' | 'org';
            if (['adoc', 'asciidoc', 'asc'].includes(fileExtension || '')) {
                format = 'asciidoc';
            } else if (['rst', 'rest'].includes(fileExtension || '')) {
                format = 'rst';
            } else if (['tex', 'latex'].includes(fileExtension || '')) {
                format = 'latex';
            } else {
                format = 'org';
            }
            return <MarkupViewer content={content} format={format} fileName={fileName} />;
        }
        
        if (isCode && !isJson) {
            const language = isSpecialFile ? fileName.toLowerCase() : getLanguageFromExtension(fileExtension || '');
            return (
                <CodeViewer
                    content={content}
                    language={language}
                    fileName={fileName}
                    isEditable={isEditableCode}
                    onContentChange={isEditableCode ? (newContent) => {
                        setContent(newContent);
                        if (newContent !== originalContent) {
                            setSaveStatus('unsaved');
                        } else {
                            setSaveStatus('saved');
                        }
                    } : undefined}
                />
            );
        }
        
        if (isEditable) {
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className={isLog ? 'log-viewer' : ''}
                />
            );
        }
        
        return <p>{content}</p>;
    };

    return (
        <div className="file-viewer">
            <div className="file-viewer-header">
                <div className="file-info">
                    <span className="status-indicator" style={{ backgroundColor: getStatusColor() }}></span>
                    <span>{getDisplayPath()}</span>
                </div>
                <div>
                    {(isEditable || isEditableCode) && <button onClick={handleSave} disabled={isSaving || saveStatus === 'saved'}>{isSaving ? 'Saving...' : 'Save'}</button>}
                    <button onClick={handleClose}>&times;</button>
                </div>
            </div>
            <div className="file-viewer-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default FileViewer;
