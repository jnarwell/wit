// software/frontend/web/src/components/Terminal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Terminal.css';
import { useAuth } from '../contexts/AuthContext';
import FileBrowser from './FileBrowser';
import Resizer from './Resizer';

const API_BASE_URL = 'http://localhost:8000';

interface TerminalLine {
    role: 'user' | 'assistant';
    content: string;
}

const Terminal: React.FC = () => {
    const { tokens } = useAuth();
    const [history, setHistory] = useState<TerminalLine[]>(() => {
        try {
            const savedHistory = localStorage.getItem('wit-terminal-history');
            return savedHistory ? JSON.parse(savedHistory) : [{ role: 'assistant', content: 'Welcome to the W.I.T. Terminal.' }];
        } catch (error) {
            return [{ role: 'assistant', content: 'Welcome to the W.I.T. Terminal.' }];
        }
    });
    const [input, setInput] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    
    const terminalEndRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const dragInfo = useRef<{ startX: number, startWidth: number } | null>(null);

    useEffect(() => {
        localStorage.setItem('wit-terminal-history', JSON.stringify(history));
        scrollToBottom();
    }, [history]);

    const scrollToBottom = () => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const focusInput = () => {
        hiddenInputRef.current?.focus();
    };

    useEffect(() => {
        focusInput();
    }, []);

    const handleCommandSubmit = async (command: string) => {
        if (!tokens) {
            setHistory(prev => [...prev, { role: 'assistant', content: 'Error: Authentication token not found. Please log in again.' }]);
            return;
        }

        const newHistory: TerminalLine[] = [...history, { role: 'user', content: command }];
        setHistory(newHistory);
        setIsProcessing(true);

        if (command.toLowerCase() === 'clear') {
            setHistory([{ role: 'assistant', content: 'Terminal cleared.' }]);
            setIsProcessing(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/terminal/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokens.access_token}`,
                },
                body: JSON.stringify({ 
                    command,
                    history: newHistory.slice(-10)
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'API request failed');
            }
            const data = await response.json();
            setHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Could not connect to the terminal server.'}` }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        setCursorPosition(e.target.selectionStart);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) {
                handleCommandSubmit(input);
            }
            setInput('');
            setCursorPosition(0);
        }
    };

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition(e.currentTarget.selectionStart);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsResizing(true);
        dragInfo.current = {
            startX: e.clientX,
            startWidth: sidebarWidth,
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !dragInfo.current) return;

        const deltaX = e.clientX - dragInfo.current.startX;
        const newWidth = dragInfo.current.startWidth - deltaX;

        if (newWidth > 200 && newWidth < 800) { // Min and max width
            setSidebarWidth(newWidth);
        }
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
        dragInfo.current = null;
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    const renderInput = () => {
        const beforeCursor = input.slice(0, cursorPosition);
        const afterCursor = input.slice(cursorPosition);
        return (
            <>
                <span className="terminal-input-text">{beforeCursor}</span>
                {!isProcessing && <div className="terminal-cursor"></div>}
                <span className="terminal-input-text">{afterCursor}</span>
            </>
        );
    };

    return (
        <div className="terminal-container">
            <div className="terminal" onClick={focusInput}>
                <div className="terminal-output">
                    {history.map((line, index) => (
                        <div key={index} className="terminal-line">
                            {line.role === 'user' && <span className="terminal-prompt">&gt; </span>}
                            {line.content}
                        </div>
                    ))}
                    <div ref={terminalEndRef} />
                </div>
                <div className="terminal-input-line">
                    <span className="terminal-prompt">&gt;</span>
                    {renderInput()}
                </div>
                <textarea
                    ref={hiddenInputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onSelect={handleSelect}
                    className="hidden-input"
                    autoFocus
                    spellCheck="false"
                />
            </div>
            <Resizer onMouseDown={handleMouseDown} />
            <div style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}>
                <FileBrowser />
            </div>
        </div>
    );
};

export default Terminal;
