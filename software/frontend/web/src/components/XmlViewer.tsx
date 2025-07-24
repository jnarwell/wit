import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface XmlViewerProps {
    content: string;
    fileName: string;
}

const formatXml = (xml: string): string => {
    try {
        const PADDING = '  ';
        let formatted = '';
        let pad = 0;
        
        // Remove existing whitespace between tags
        xml = xml.replace(/>\s*</g, '><');
        
        xml.split(/</g).forEach((node) => {
            if (node.length === 0) return;
            
            node = '<' + node;
            
            if (node.match(/^<\?/)) {
                formatted += node + '\n';
            } else if (node.match(/^<!--/)) {
                formatted += PADDING.repeat(pad) + node + '\n';
            } else if (node.match(/^<!\[CDATA\[/)) {
                formatted += PADDING.repeat(pad) + node + '\n';
            } else if (node.match(/^<\/\w/)) {
                pad--;
                formatted += PADDING.repeat(pad) + node + '\n';
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                formatted += PADDING.repeat(pad) + node + '\n';
                if (!node.match(/<.*\/>/)) {
                    pad++;
                }
            } else {
                formatted += PADDING.repeat(pad) + node + '\n';
            }
        });
        
        return formatted.trim();
    } catch (e) {
        // If formatting fails, return original
        return xml;
    }
};

const XmlViewer: React.FC<XmlViewerProps> = ({ content, fileName }) => {
    const [isFormatted, setIsFormatted] = React.useState(true);
    const formattedContent = React.useMemo(() => formatXml(content), [content]);
    
    const displayContent = isFormatted ? formattedContent : content;
    
    return (
        <div className="xml-viewer-container">
            <div className="xml-viewer-header">
                <span className="xml-filename">{fileName}</span>
                <button 
                    className="format-toggle"
                    onClick={() => setIsFormatted(!isFormatted)}
                >
                    {isFormatted ? 'Show Original' : 'Format XML'}
                </button>
            </div>
            <div className="xml-viewer-content">
                <SyntaxHighlighter 
                    language="xml" 
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
                    {displayContent}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

export default XmlViewer;