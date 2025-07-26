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
        // JavaScript/TypeScript ecosystem
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'mjs': 'javascript',
        'cjs': 'javascript',
        'vue': 'vue',
        'svelte': 'svelte',
        
        // Web technologies
        'html': 'html',
        'htm': 'html',
        'xml': 'xml',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'styl': 'stylus',
        'stylus': 'stylus',
        
        // Python
        'py': 'python',
        'pyw': 'python',
        'pyx': 'python',
        'pxd': 'python',
        'pxi': 'python',
        'py3': 'python',
        'pyi': 'python',
        'ipynb': 'python',
        
        // Java/JVM languages
        'java': 'java',
        'class': 'java',
        'jar': 'java',
        'scala': 'scala',
        'sc': 'scala',
        'kt': 'kotlin',
        'kts': 'kotlin',
        'groovy': 'groovy',
        'gvy': 'groovy',
        'gradle': 'groovy',
        'clj': 'clojure',
        'cljs': 'clojure',
        'cljc': 'clojure',
        
        // C/C++
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'c++': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'hh': 'cpp',
        'hxx': 'cpp',
        'h++': 'cpp',
        'ino': 'arduino',
        'tpp': 'cpp',
        'txx': 'cpp',
        
        // C# and .NET
        'cs': 'csharp',
        'csx': 'csharp',
        'vb': 'vbnet',
        'fs': 'fsharp',
        'fsi': 'fsharp',
        'fsx': 'fsharp',
        'fsscript': 'fsharp',
        
        // Go
        'go': 'go',
        'mod': 'go',
        'sum': 'go',
        
        // Rust
        'rs': 'rust',
        'rlib': 'rust',
        
        // Ruby
        'rb': 'ruby',
        'rbw': 'ruby',
        'rake': 'ruby',
        'gemspec': 'ruby',
        'podspec': 'ruby',
        'thor': 'ruby',
        'irb': 'ruby',
        'ru': 'ruby',
        'gemfile': 'ruby',
        'rakefile': 'ruby',
        'guardfile': 'ruby',
        'podfile': 'ruby',
        
        // PHP
        'php': 'php',
        'php3': 'php',
        'php4': 'php',
        'php5': 'php',
        'php7': 'php',
        'phps': 'php',
        'phtml': 'php',
        'pht': 'php',
        
        // Swift/Objective-C
        'swift': 'swift',
        'm': 'objectivec',
        'mm': 'objectivec',
        'objc': 'objectivec',
        'objcpp': 'objectivec',
        
        // Shell scripts
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'ksh': 'bash',
        'csh': 'bash',
        'tcsh': 'bash',
        'command': 'bash',
        'bashrc': 'bash',
        'zshrc': 'bash',
        'profile': 'bash',
        'bash_profile': 'bash',
        'bash_aliases': 'bash',
        'ps1': 'powershell',
        'psm1': 'powershell',
        'psd1': 'powershell',
        'bat': 'batch',
        'cmd': 'batch',
        
        // Data languages
        'sql': 'sql',
        'mysql': 'sql',
        'pgsql': 'sql',
        'plsql': 'plsql',
        'tsql': 'sql',
        'sqlite': 'sql',
        'graphql': 'graphql',
        'gql': 'graphql',
        
        // Functional languages
        'hs': 'haskell',
        'lhs': 'haskell',
        'elm': 'elm',
        'ml': 'ocaml',
        'mli': 'ocaml',
        'erl': 'erlang',
        'hrl': 'erlang',
        'ex': 'elixir',
        'exs': 'elixir',
        'eex': 'elixir',
        'leex': 'elixir',
        
        // Scientific/Data Science
        'r': 'r',
        'R': 'r',
        'rmd': 'markdown',
        'Rmd': 'markdown',
        'julia': 'julia',
        'jl': 'julia',
        'mat': 'matlab',
        
        // Mobile development
        'dart': 'dart',
        'xaml': 'xml',
        
        // Systems programming
        'asm': 'nasm',
        's': 'nasm',
        'S': 'nasm',
        'nasm': 'nasm',
        'nim': 'nim',
        'nims': 'nim',
        'nimble': 'nim',
        'v': 'v',
        'vh': 'verilog',
        'sv': 'verilog',
        'svh': 'verilog',
        'vhd': 'vhdl',
        'vhdl': 'vhdl',
        
        // Scripting languages
        'lua': 'lua',
        'perl': 'perl',
        'pl': 'perl',
        'pm': 'perl',
        'pod': 'perl',
        't': 'perl',
        'raku': 'perl6',
        'rakumod': 'perl6',
        'rakudoc': 'perl6',
        'tcl': 'tcl',
        'tk': 'tcl',
        
        // Markup and config
        'yml': 'yaml',
        'yaml': 'yaml',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
        'config': 'ini',
        'env': 'bash',
        'properties': 'properties',
        'props': 'properties',
        'prefs': 'properties',
        
        // Build files
        'dockerfile': 'dockerfile',
        'containerfile': 'dockerfile',
        'makefile': 'makefile',
        'mk': 'makefile',
        'mak': 'makefile',
        'make': 'makefile',
        'gnumakefile': 'makefile',
        'ocamlmakefile': 'makefile',
        'cmakelists': 'cmake',
        'cmake': 'cmake',
        
        // Package files
        'json': 'json',
        'jsonc': 'jsonc',
        'json5': 'json5',
        'jsonl': 'json',
        'ndjson': 'json',
        'package': 'json',
        'lock': 'json',
        'cartfile': 'swift',
        'pubspec': 'yaml',
        
        // Documentation
        'md': 'markdown',
        'markdown': 'markdown',
        'mdown': 'markdown',
        'mkd': 'markdown',
        'mdx': 'markdown',
        'readme': 'markdown',
        
        // Markup/Docs
        'rst': 'rest',
        'rest': 'rest',
        'adoc': 'asciidoc',
        'asciidoc': 'asciidoc',
        'asc': 'asciidoc',
        'tex': 'latex',
        'latex': 'latex',
        'org': 'org',
        
        // Version control
        'gitignore': 'gitignore',
        'gitattributes': 'gitignore',
        'gitmodules': 'gitignore',
        'dockerignore': 'gitignore',
        'npmignore': 'gitignore',
        'eslintignore': 'gitignore',
        'prettierignore': 'gitignore',
        
        // Config files
        'editorconfig': 'editorconfig',
        'eslintrc': 'json',
        'prettierrc': 'json',
        'babelrc': 'json',
        'browserlistrc': 'text',
        'stylelintrc': 'json',
        'htaccess': 'apacheconf',
        'htpasswd': 'text',
        'gitconfig': 'ini',
        'ssh_config': 'text',
        'sshd_config': 'text',
        'hosts': 'text',
        'inputrc': 'bash',
        'netrc': 'text',
        'curlrc': 'text',
        'wgetrc': 'text',
        'npmrc': 'ini',
        'yarnrc': 'yaml',
        'vimrc': 'vim',
        
        // Other languages
        'pas': 'pascal',
        'pp': 'pascal',
        'inc': 'pascal',
        'lpr': 'pascal',
        'dpr': 'pascal',
        'dpk': 'pascal',
        'ada': 'ada',
        'adb': 'ada',
        'ads': 'ada',
        'cr': 'crystal',
        'sol': 'solidity',
        'zig': 'zig',
        'odin': 'text',
        
        // Patches and diffs
        'diff': 'diff',
        'patch': 'diff',
        
        // Binary source representations
        'proto': 'protobuf',
        'thrift': 'thrift',
        'avdl': 'json',
        'avsc': 'json',
        'avpr': 'json',
        
        // Template languages
        'ejs': 'ejs',
        'erb': 'erb',
        'haml': 'haml',
        'pug': 'pug',
        'jade': 'pug',
        'twig': 'twig',
        'njk': 'django',
        'liquid': 'liquid',
        'mustache': 'handlebars',
        'hbs': 'handlebars',
        'handlebars': 'handlebars',
        
        // Infrastructure as Code
        'tf': 'hcl',
        'tfvars': 'hcl',
        'hcl': 'hcl',
        'nomad': 'hcl',
        
        // System files
        'service': 'ini',
        'socket': 'ini',
        'timer': 'ini',
        'target': 'ini',
        'mount': 'ini',
        
        // Other
        'csv': 'csv',
        'tsv': 'csv',
        'po': 'gettext',
        'pot': 'gettext',
        'log': 'log',
        'txt': 'text',
        'text': 'text',
        'license': 'text',
        'authors': 'text',
        'contributors': 'text',
        'changelog': 'markdown',
        'vagrantfile': 'ruby',
        'brewfile': 'ruby',
        'pipfile': 'toml',
        'requirements': 'text',
        'procfile': 'text',
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
    // For seamless editing, always show the textarea when editable
    if (isEditable && onContentChange) {
        return (
            <div className="code-editor-container">
                <div className="code-editor-header">
                    <span className="code-filename">{fileName}</span>
                    <span className="code-language">{language}</span>
                </div>
                <textarea
                    className="code-editor seamless"
                    value={content}
                    onChange={(e) => onContentChange(e.target.value)}
                    spellCheck={false}
                    placeholder={`Enter ${language} code...`}
                />
            </div>
        );
    }

    // Read-only view with syntax highlighting
    return (
        <div className="code-viewer-container">
            <div className="code-viewer-header">
                <span className="code-filename">{fileName}</span>
                <span className="code-language">{language}</span>
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