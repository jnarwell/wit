// software/frontend/web/src/components/FileViewer.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './FileViewer.css';
import PdfViewer from './PdfViewer';
import './PdfViewer.css';
import { CodeViewer, getLanguageFromExtension } from './CodeViewer';
import './CodeViewer.css';
import XmlViewer from './XmlViewer';
import MarkupViewer from './MarkupViewer';
import './MarkupViewer.css';
import ImageViewer from './ImageViewer';
import ThreeDViewer from './ThreeDViewer';
import './ThreeDViewer.css';

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
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const fileViewerRef = useRef<HTMLDivElement>(null);
    const fileExtension = path.split('.').pop()?.toLowerCase();
    const fileName = path.split('/').pop() || '';
    
    // Define supported code extensions
    const codeExtensions = new Set([
        // JavaScript/TypeScript ecosystem
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte',
        // Web technologies
        'html', 'htm', 'css', 'scss', 'sass', 'less', 'styl', 'stylus',
        // Python
        'py', 'pyw', 'pyx', 'pxd', 'pxi', 'py3', 'pyi',
        // Java/JVM languages
        'java', 'class', 'jar', 'scala', 'sc', 'kt', 'kts', 'groovy', 'gradle', 'clj', 'cljs', 'cljc',
        // C/C++
        'c', 'cpp', 'cc', 'cxx', 'c++', 'h', 'hpp', 'hh', 'hxx', 'h++', 'ino', 'tpp', 'txx',
        // C# and .NET
        'cs', 'csx', 'vb', 'fs', 'fsi', 'fsx', 'fsscript',
        // Go
        'go', 'mod', 'sum',
        // Rust
        'rs', 'rlib',
        // Ruby
        'rb', 'rbw', 'rake', 'gemspec', 'podspec', 'thor', 'irb', 'ru',
        // PHP
        'php', 'php3', 'php4', 'php5', 'php7', 'phps', 'phtml', 'pht',
        // Swift/Objective-C
        'swift', 'm', 'mm', 'objc', 'objcpp',
        // Shell scripts
        'sh', 'bash', 'zsh', 'fish', 'ksh', 'csh', 'tcsh', 'command', 'ps1', 'psm1', 'psd1', 'bat', 'cmd',
        // Data languages
        'sql', 'mysql', 'pgsql', 'plsql', 'tsql', 'graphql', 'gql',
        // Functional languages
        'hs', 'lhs', 'elm', 'ml', 'mli', 'fs', 'fsi', 'fsx', 'erl', 'hrl', 'ex', 'exs', 'eex', 'leex',
        // Scientific/Data Science
        'r', 'R', 'rmd', 'Rmd', 'julia', 'jl', 'mat', 'm', 'ipynb',
        // Mobile development
        'dart', 'gradle', 'xaml',
        // Systems programming
        'asm', 's', 'S', 'nasm', 'nim', 'nims', 'nimble', 'v', 'vh', 'sv', 'svh', 'vhd', 'vhdl',
        // Scripting languages
        'lua', 'perl', 'pl', 'pm', 'pod', 't', 'raku', 'rakumod', 'rakudoc', 'tcl', 'tk',
        // Markup and config
        'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config', 'env', 'properties', 'props', 'prefs',
        // Build files
        'makefile', 'mk', 'mak', 'make', 'gnumakefile', 'ocamlmakefile', 'cmakelists', 'cmake', 'dockerfile', 'containerfile',
        // Package files
        'json', 'package', 'lock', 'gemfile', 'rakefile', 'guardfile', 'podfile', 'cartfile', 'pubspec',
        // Documentation
        'md', 'markdown', 'mdown', 'mkd', 'mdx', 'rmd', 'readme',
        // Version control
        'gitignore', 'gitattributes', 'gitmodules', 'dockerignore', 'npmignore', 'eslintignore', 'prettierignore',
        // Config files
        'editorconfig', 'eslintrc', 'prettierrc', 'babelrc', 'browserlistrc', 'stylelintrc',
        // Other languages
        'pas', 'pp', 'inc', 'lpr', 'dpr', 'dpk', 'ada', 'adb', 'ads', 'nim', 'cr', 'sol', 'zig', 'odin',
        // Patches and diffs
        'diff', 'patch',
        // Binary source representations
        'proto', 'thrift', 'avdl', 'avsc', 'avpr',
        // Template languages
        'ejs', 'erb', 'haml', 'pug', 'jade', 'twig', 'njk', 'liquid', 'mustache', 'hbs', 'handlebars',
        // Other common extensions
        'tf', 'tfvars', 'hcl', 'nomad', 'workflow', 'wf', 'service', 'socket', 'timer', 'target', 'mount'
    ]);
    
    // Define markup/documentation extensions
    const markupExtensions = new Set([
        'adoc', 'asciidoc', 'asc', 'rst', 'rest', 'tex', 'latex', 'org'
    ]);
    
    // Editable code/config files
    const editableCodeExtensions = new Set([
        // Config formats
        'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'config', 'env', 'properties', 'props', 'prefs',
        // Shell scripts
        'sh', 'bash', 'zsh', 'fish', 'ksh', 'csh', 'tcsh', 'command', 'ps1', 'psm1', 'psd1', 'bat', 'cmd',
        // Build and package files
        'makefile', 'mk', 'mak', 'make', 'dockerfile', 'containerfile', 'gemfile', 'rakefile', 'guardfile',
        'podfile', 'cartfile', 'pubspec', 'cmakelists', 'cmake',
        // Ignore files
        'gitignore', 'gitattributes', 'gitmodules', 'dockerignore', 'npmignore', 'eslintignore', 'prettierignore',
        // RC files
        'editorconfig', 'eslintrc', 'prettierrc', 'babelrc', 'browserlistrc', 'stylelintrc', 'bashrc', 'zshrc',
        'vimrc', 'inputrc', 'netrc', 'curlrc', 'wgetrc', 'npmrc', 'yarnrc',
        // Other config files
        'htaccess', 'htpasswd', 'gitconfig', 'ssh_config', 'sshd_config', 'hosts', 'hostname',
        'resolv', 'exports', 'profile', 'bash_profile', 'bash_aliases'
    ]);
    
    // Special case for files without extensions
    const specialFiles = [
        'dockerfile', 'containerfile', 'makefile', 'gnumakefile', 'ocamlmakefile',
        'gemfile', 'rakefile', 'guardfile', 'podfile', 'cartfile', 'cmakelists',
        'gitignore', 'gitattributes', 'gitmodules', 'gitconfig',
        'dockerignore', 'npmignore', 'eslintignore', 'prettierignore',
        'editorconfig', 'eslintrc', 'prettierrc', 'babelrc', 'browserlistrc', 'stylelintrc',
        'bashrc', 'zshrc', 'vimrc', 'inputrc', 'netrc', 'curlrc', 'wgetrc', 'npmrc', 'yarnrc',
        'profile', 'bash_profile', 'bash_aliases', 'zprofile', 'zshenv',
        'htaccess', 'htpasswd', 'hosts', 'hostname', 'resolv', 'exports',
        'procfile', 'license', 'readme', 'authors', 'contributors', 'changelog',
        'config', 'conf', 'cfg', 'ini', 'setup', 'install', 'build', 'make',
        'vagrantfile', 'brewfile', 'pipfile', 'requirements', 'package', 'yarn', 'npm'
    ];
    const isSpecialFile = specialFiles.includes(fileName.toLowerCase());
    
    // Define file type checks first
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
    
    // Make all text-based files editable
    const isEditable = fileExtension === 'md' || fileExtension === 'txt' || fileExtension === 'log' ||
                      isJson || isJsonl || isCsv || isTsv || isXml || 
                      (fileExtension && markupExtensions.has(fileExtension)) ||
                      (fileExtension && codeExtensions.has(fileExtension)) || isSpecialFile;
    
    const editableSpecialFiles = [
        'dockerfile', 'containerfile', 'makefile', 'gemfile', 'rakefile', 'guardfile', 'podfile',
        'gitignore', 'gitattributes', 'gitmodules', 'dockerignore', 'npmignore', 'eslintignore', 'prettierignore',
        'editorconfig', 'eslintrc', 'prettierrc', 'babelrc', 'browserlistrc', 'stylelintrc',
        'bashrc', 'zshrc', 'vimrc', 'inputrc', 'netrc', 'curlrc', 'wgetrc', 'npmrc', 'yarnrc',
        'profile', 'bash_profile', 'bash_aliases', 'htaccess', 'htpasswd', 'hosts',
        'procfile', 'vagrantfile', 'brewfile', 'pipfile', 'requirements'
    ];
    const isEditableCode = (fileExtension && editableCodeExtensions.has(fileExtension)) || 
                          editableSpecialFiles.includes(fileName.toLowerCase());
    
    // Image file detection
    const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif']);
    const isImage = fileExtension && imageExtensions.has(fileExtension);
    
    // 3D file detection
    const threeDExtensions = new Set([
        'stl', 'step', 'stp', 'iges', 'igs', 'obj', 'fbx', 'dae', 'gltf', 'glb', 
        '3ds', '3mf', 'ply', 'off', 'xyz', 'pcd', 'vrml', 'wrl', 'x3d',
        // CAD formats
        'sldprt', 'sldasm', 'slddrw', // SolidWorks
        'ipt', 'iam', 'idw', // Inventor
        'prt', 'asm', 'drw', // Creo/Pro-E
        'catpart', 'catproduct', 'catdrawing', // CATIA
        'dwg', 'dxf', // AutoCAD
        'f3d', 'f3z', // Fusion 360
        'skp', // SketchUp
        'blend', // Blender
        'max', // 3ds Max
        'ma', 'mb', // Maya
        'c4d', // Cinema 4D
        'lwo', 'lws', // LightWave
        'zpr', // ZBrush
        'usd', 'usda', 'usdc', 'usdz' // Universal Scene Description
    ]);
    const is3D = fileExtension && threeDExtensions.has(fileExtension);
    
    const isViewable = isEditable || isCsv || isTsv || isJson || isJsonl || isRtf || isDoc || isPdf || isCode || isXml || isMarkup || isImage || is3D;

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
            
            // Skip API call for PDF, image, and 3D files (handled separately)
            if (isPdf || isImage || is3D) {
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
                method: 'PUT',
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
        if (isFullscreen) {
            exitFullscreen();
        }
        if (saveStatus === 'unsaved') {
            if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const toggleFullscreen = () => {
        if (!isFullscreen) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
    };

    const enterFullscreen = () => {
        if (fileViewerRef.current?.requestFullscreen) {
            fileViewerRef.current.requestFullscreen();
        } else if ((fileViewerRef.current as any)?.webkitRequestFullscreen) {
            (fileViewerRef.current as any).webkitRequestFullscreen();
        } else if ((fileViewerRef.current as any)?.msRequestFullscreen) {
            (fileViewerRef.current as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
    };

    const exitFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
    };

    // Handle fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Handle escape key in fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                exitFullscreen();
            }
        };

        if (isFullscreen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

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
            return <p style={{ color: '#f0f0f0', padding: '20px' }}>Loading...</p>;
        }
        
        if (!tokens) {
            return <p style={{ color: '#f0f0f0', padding: '20px' }}>Authentication required. Please log in.</p>;
        }
        
        if (isPdf) {
            const downloadUrl = `${API_BASE_URL}/api/v1/files/download?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
            return <PdfViewer url={downloadUrl} authToken={tokens?.access_token} />;
        }
        
        if (isImage && tokens) {
            return <ImageViewer 
                path={path} 
                baseDir={baseDir} 
                projectId={projectId} 
                fileName={fileName}
                token={tokens.access_token}
            />;
        }
        
        if (is3D && tokens) {
            return <ThreeDViewer 
                path={path} 
                baseDir={baseDir} 
                projectId={projectId} 
                fileName={fileName}
                token={tokens.access_token}
            />;
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
        
        if (isJson) {
            // For JSON files, show a textarea for editing
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="json-editor"
                    spellCheck={false}
                    placeholder="Loading JSON content..."
                />
            );
        }
        
        if (isJsonl) {
            // For JSONL files, show a textarea for editing
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="jsonl-editor"
                    spellCheck={false}
                />
            );
        }
        
        if (isCsv || isTsv) {
            // For CSV/TSV files, show a textarea for editing
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="csv-editor"
                    spellCheck={false}
                />
            );
        }
        
        if (isXml) {
            // For XML files, show a textarea for editing
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="xml-editor"
                    spellCheck={false}
                />
            );
        }
        
        if (isMarkup) {
            // For markup files, show a textarea for editing
            return (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    className="markup-editor"
                    spellCheck={false}
                />
            );
        }
        
        if (isCode && !isJson) {
            const language = isSpecialFile ? fileName.toLowerCase() : getLanguageFromExtension(fileExtension || '');
            return (
                <CodeViewer
                    content={content}
                    language={language}
                    fileName={fileName}
                    isEditable={true}  // Always editable
                    onContentChange={(newContent) => {
                        setContent(newContent);
                        if (newContent !== originalContent) {
                            setSaveStatus('unsaved');
                        } else {
                            setSaveStatus('saved');
                        }
                    }}
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
        
        return <p style={{ color: '#f0f0f0', padding: '20px' }}>{content || 'No content available'}</p>;
    };

    return (
        <div className={`file-viewer ${isFullscreen ? 'file-viewer-fullscreen' : ''}`} ref={fileViewerRef}>
            <div className="file-viewer-header">
                <div className="file-info">
                    <span className="status-indicator" style={{ backgroundColor: getStatusColor() }}></span>
                    <span>{getDisplayPath()}</span>
                </div>
                <div className="file-viewer-actions">
                    {isEditable && <button onClick={handleSave} disabled={isSaving || saveStatus === 'saved'}>{isSaving ? 'Saving...' : 'Save'}</button>}
                    <button 
                        onClick={toggleFullscreen} 
                        className="fullscreen-btn"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? '⤓' : '⤢'}
                    </button>
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
