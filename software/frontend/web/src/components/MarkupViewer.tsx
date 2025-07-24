import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MarkupViewer.css';

interface MarkupViewerProps {
    content: string;
    format: 'asciidoc' | 'rst' | 'latex' | 'org';
    fileName: string;
}

const MarkupViewer: React.FC<MarkupViewerProps> = ({ content, format, fileName }) => {
    const [viewMode, setViewMode] = useState<'formatted' | 'source'>('formatted');
    const [processedContent, setProcessedContent] = useState<string>('');

    useEffect(() => {
        // Process content based on format
        switch (format) {
            case 'asciidoc':
                setProcessedContent(processAsciiDoc(content));
                break;
            case 'rst':
                setProcessedContent(processReStructuredText(content));
                break;
            case 'latex':
                setProcessedContent(processLaTeX(content));
                break;
            case 'org':
                setProcessedContent(processOrgMode(content));
                break;
        }
    }, [content, format]);

    const processAsciiDoc = (text: string): string => {
        let html = text;
        
        // Headers
        html = html.replace(/^=====\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^====\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^===\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^==\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^=\s+(.+)$/gm, '<h1>$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Code blocks
        html = html.replace(/----\n([\s\S]*?)\n----/g, '<pre class="code-block">$1</pre>');
        html = html.replace(/```\n([\s\S]*?)\n```/g, '<pre class="code-block">$1</pre>');
        
        // Inline code
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Links
        html = html.replace(/link:(\S+)\[(.+?)\]/g, '<a href="$1">$2</a>');
        html = html.replace(/https?:\/\/\S+\[(.+?)\]/g, '<a href="$&">$1</a>');
        
        // Lists
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\. (.+)$/gm, '<li class="ordered">$1</li>');
        
        // Block quotes
        html = html.replace(/^____\n([\s\S]*?)\n____$/gm, '<blockquote>$1</blockquote>');
        
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    };

    const processReStructuredText = (text: string): string => {
        let html = text;
        
        // Headers (with underlines)
        html = html.replace(/^(.+)\n={3,}$/gm, '<h1>$1</h1>');
        html = html.replace(/^(.+)\n-{3,}$/gm, '<h2>$1</h2>');
        html = html.replace(/^(.+)\n~{3,}$/gm, '<h3>$1</h3>');
        html = html.replace(/^(.+)\n\^{3,}$/gm, '<h4>$1</h4>');
        
        // Bold and italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // Code blocks
        html = html.replace(/::\n\n([\s\S]*?)(?=\n\n)/g, '<pre class="code-block">$1</pre>');
        html = html.replace(/.. code-block::\s*\w*\n\n([\s\S]*?)(?=\n\n)/g, '<pre class="code-block">$1</pre>');
        
        // Inline code
        html = html.replace(/``(.+?)``/g, '<code>$1</code>');
        
        // Links
        html = html.replace(/`(.+?) <(.+?)>`_/g, '<a href="$2">$1</a>');
        
        // Bullet lists
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\+ (.+)$/gm, '<li>$1</li>');
        
        // Numbered lists
        html = html.replace(/^\d+\. (.+)$/gm, '<li class="ordered">$1</li>');
        
        // Block quotes
        html = html.replace(/^  (.+)$/gm, '<blockquote>$1</blockquote>');
        
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    };

    const processLaTeX = (text: string): string => {
        let html = text;
        
        // Document structure
        html = html.replace(/\\documentclass\{.+?\}/g, '');
        html = html.replace(/\\usepackage\{.+?\}/g, '');
        html = html.replace(/\\begin\{document\}/g, '');
        html = html.replace(/\\end\{document\}/g, '');
        
        // Sections
        html = html.replace(/\\section\{(.+?)\}/g, '<h1>$1</h1>');
        html = html.replace(/\\subsection\{(.+?)\}/g, '<h2>$1</h2>');
        html = html.replace(/\\subsubsection\{(.+?)\}/g, '<h3>$1</h3>');
        html = html.replace(/\\chapter\{(.+?)\}/g, '<h1 class="chapter">$1</h1>');
        
        // Text formatting
        html = html.replace(/\\textbf\{(.+?)\}/g, '<strong>$1</strong>');
        html = html.replace(/\\textit\{(.+?)\}/g, '<em>$1</em>');
        html = html.replace(/\\emph\{(.+?)\}/g, '<em>$1</em>');
        html = html.replace(/\\texttt\{(.+?)\}/g, '<code>$1</code>');
        
        // Lists
        html = html.replace(/\\begin\{itemize\}/g, '<ul>');
        html = html.replace(/\\end\{itemize\}/g, '</ul>');
        html = html.replace(/\\begin\{enumerate\}/g, '<ol>');
        html = html.replace(/\\end\{enumerate\}/g, '</ol>');
        html = html.replace(/\\item\s+(.+?)(?=\\item|<\/[uo]l>|$)/g, '<li>$1</li>');
        
        // Math (basic)
        html = html.replace(/\$(.+?)\$/g, '<span class="math">$1</span>');
        html = html.replace(/\\\[(.+?)\\\]/g, '<div class="math-block">$1</div>');
        
        // Verbatim/code
        html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre class="code-block">$1</pre>');
        html = html.replace(/\\verb\|(.+?)\|/g, '<code>$1</code>');
        
        // Quotes
        html = html.replace(/``(.+?)''/g, '"$1"');
        html = html.replace(/`(.+?)'/g, '&lsquo;$1&rsquo;');
        
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    };

    const processOrgMode = (text: string): string => {
        let html = text;
        
        // Headers
        html = html.replace(/^\*{5}\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^\*{4}\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^\*{3}\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^\*{2}\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^\*\s+(.+)$/gm, '<h1>$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
        html = html.replace(/\/(.+?)\//g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<u>$1</u>');
        html = html.replace(/\+(.+?)\+/g, '<del>$1</del>');
        
        // Code
        html = html.replace(/~(.+?)~/g, '<code>$1</code>');
        html = html.replace(/=(.+?)=/g, '<code>$1</code>');
        
        // Code blocks
        html = html.replace(/#\+BEGIN_SRC.*?\n([\s\S]*?)\n#\+END_SRC/g, '<pre class="code-block">$1</pre>');
        html = html.replace(/#\+BEGIN_EXAMPLE\n([\s\S]*?)\n#\+END_EXAMPLE/g, '<pre class="code-block">$1</pre>');
        
        // Links
        html = html.replace(/\[\[(.+?)\]\[(.+?)\]\]/g, '<a href="$1">$2</a>');
        html = html.replace(/\[\[(.+?)\]\]/g, '<a href="$1">$1</a>');
        
        // Lists
        html = html.replace(/^  \* (.+)$/gm, '<li class="indent-2">$1</li>');
        html = html.replace(/^ \* (.+)$/gm, '<li class="indent-1">$1</li>');
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^  - (.+)$/gm, '<li class="indent-2">$1</li>');
        html = html.replace(/^ - (.+)$/gm, '<li class="indent-1">$1</li>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^  \+ (.+)$/gm, '<li class="indent-2">$1</li>');
        html = html.replace(/^ \+ (.+)$/gm, '<li class="indent-1">$1</li>');
        html = html.replace(/^\+ (.+)$/gm, '<li>$1</li>');
        
        // TODO items
        html = html.replace(/^\*+\s+TODO\s+(.+)$/gm, '<div class="todo">TODO: $1</div>');
        html = html.replace(/^\*+\s+DONE\s+(.+)$/gm, '<div class="done">DONE: $1</div>');
        
        // Tables (basic)
        html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
            const cells = content.split('|').map(cell => `<td>${cell.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        });
        
        // Block quotes
        html = html.replace(/^#\+BEGIN_QUOTE\n([\s\S]*?)\n#\+END_QUOTE/g, '<blockquote>$1</blockquote>');
        
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    };

    const getLanguageForSyntax = () => {
        switch (format) {
            case 'asciidoc': return 'asciidoc';
            case 'rst': return 'rest';
            case 'latex': return 'latex';
            case 'org': return 'text';
            default: return 'text';
        }
    };

    const getFormatName = () => {
        switch (format) {
            case 'asciidoc': return 'AsciiDoc';
            case 'rst': return 'reStructuredText';
            case 'latex': return 'LaTeX';
            case 'org': return 'Org-mode';
            default: return 'Markup';
        }
    };

    return (
        <div className="markup-viewer-container">
            <div className="markup-viewer-header">
                <div className="file-info">
                    <span className="format-badge">{getFormatName()}</span>
                    <span className="filename">{fileName}</span>
                </div>
                <div className="view-toggle">
                    <button 
                        className={viewMode === 'formatted' ? 'active' : ''}
                        onClick={() => setViewMode('formatted')}
                    >
                        Formatted
                    </button>
                    <button 
                        className={viewMode === 'source' ? 'active' : ''}
                        onClick={() => setViewMode('source')}
                    >
                        Source
                    </button>
                </div>
            </div>
            <div className="markup-viewer-content">
                {viewMode === 'formatted' ? (
                    <div 
                        className="formatted-content"
                        dangerouslySetInnerHTML={{ __html: processedContent }}
                    />
                ) : (
                    <SyntaxHighlighter 
                        language={getLanguageForSyntax()}
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
                            height: '100%',
                        }}
                    >
                        {content}
                    </SyntaxHighlighter>
                )}
            </div>
        </div>
    );
};

export default MarkupViewer;