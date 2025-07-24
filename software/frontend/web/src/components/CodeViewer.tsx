import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerProps {
    content: string;
    language: string;
    fileName: string;
    isEditable?: boolean;
    onContentChange?: (content: string) => void;
}

// Map file extensions to Prism language identifiers
const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
        // JavaScript/TypeScript
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'mjs': 'javascript',
        'cjs': 'javascript',
        
        // Web
        'html': 'html',
        'htm': 'html',
        'xml': 'xml',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'vue': 'vue',
        'svelte': 'svelte',
        
        // Programming Languages
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'kts': 'kotlin',
        'r': 'r',
        'm': 'objectivec',
        'mm': 'objectivec',
        'lua': 'lua',
        'dart': 'dart',
        'scala': 'scala',
        'hs': 'haskell',
        'ex': 'elixir',
        'exs': 'elixir',
        'clj': 'clojure',
        'cljs': 'clojure',
        'fs': 'fsharp',
        'fsx': 'fsharp',
        'fsi': 'fsharp',
        'ml': 'ocaml',
        'mli': 'ocaml',
        'nim': 'nim',
        'jl': 'julia',
        'cr': 'crystal',
        'zig': 'zig',
        'v': 'v',
        'vb': 'vbnet',
        'pas': 'pascal',
        'pp': 'pascal',
        'pl': 'perl',
        'pm': 'perl',
        'groovy': 'groovy',
        'gvy': 'groovy',
        'gradle': 'groovy',
        
        // Config/Data
        'json': 'json',
        'jsonc': 'jsonc',
        'json5': 'json5',
        'yml': 'yaml',
        'yaml': 'yaml',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
        'properties': 'properties',
        'env': 'bash',
        'gitignore': 'gitignore',
        'dockerignore': 'gitignore',
        'editorconfig': 'editorconfig',
        
        // Shell/Scripts
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'ps1': 'powershell',
        'psm1': 'powershell',
        'psd1': 'powershell',
        'bat': 'batch',
        'cmd': 'batch',
        
        // Database
        'sql': 'sql',
        'mysql': 'sql',
        'pgsql': 'sql',
        'sqlite': 'sql',
        'graphql': 'graphql',
        'gql': 'graphql',
        
        // Markup/Docs
        'md': 'markdown',
        'mdx': 'markdown',
        'rst': 'rest',
        'adoc': 'asciidoc',
        'asciidoc': 'asciidoc',
        'tex': 'latex',
        'org': 'org',
        
        // Build files
        'dockerfile': 'dockerfile',
        'makefile': 'makefile',
        'mk': 'makefile',
        'make': 'makefile',
        
        // Other
        'diff': 'diff',
        'patch': 'diff',
        'po': 'gettext',
        'pot': 'gettext',
        'csv': 'csv',
        'tsv': 'csv',
    };
    
    return languageMap[extension.toLowerCase()] || 'text';
};

const CodeViewer: React.FC<CodeViewerProps> = ({ 
    content, 
    language, 
    fileName,
    isEditable = false,
    onContentChange 
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editContent, setEditContent] = React.useState(content);

    React.useEffect(() => {
        setEditContent(content);
    }, [content]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSave = () => {
        if (onContentChange) {
            onContentChange(editContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(content);
        setIsEditing(false);
    };

    if (isEditing && isEditable) {
        return (
            <div className="code-editor-container">
                <div className="code-editor-header">
                    <span className="code-filename">{fileName}</span>
                    <div className="code-editor-actions">
                        <button onClick={handleSave} className="save-btn">Save</button>
                        <button onClick={handleCancel} className="cancel-btn">Cancel</button>
                    </div>
                </div>
                <textarea
                    className="code-editor"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    spellCheck={false}
                />
            </div>
        );
    }

    return (
        <div className="code-viewer-container">
            <div className="code-viewer-header">
                <span className="code-filename">{fileName}</span>
                <span className="code-language">{language}</span>
                {isEditable && (
                    <button onClick={handleEdit} className="edit-btn">Edit</button>
                )}
            </div>
            <div className="code-viewer-content">
                <SyntaxHighlighter 
                    language={language} 
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    wrapLines={true}
                    wrapLongLines={true}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: '#1e1e1e',
                        fontSize: '14px',
                        lineHeight: '1.5',
                    }}
                >
                    {content}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

export { CodeViewer, getLanguageFromExtension };