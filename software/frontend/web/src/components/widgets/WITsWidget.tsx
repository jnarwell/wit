// src/components/widgets/WITsWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/Terminal.css';
import './WITsWidget.css';

const API_BASE_URL = 'http://localhost:8000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WITsWidgetProps {
  onRemove: () => void;
}

const WITsWidget: React.FC<WITsWidgetProps> = ({ onRemove }) => {
  const { tokens } = useAuth();
  const [history, setHistory] = useState<Message[]>([
    { role: 'assistant', content: 'W.I.T. Terminal v1.0' },
    { role: 'assistant', content: 'Type "help" for available commands.' }
  ]);
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const focusInput = () => {
    hiddenInputRef.current?.focus();
  };

  const handleCommandSubmit = async (command: string) => {
    if (!tokens || isProcessing || !command.trim()) return;
    
    setIsProcessing(true);
    const newHistory = [...history, { role: 'user' as const, content: command }];
    setHistory(newHistory);
    
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
      
      // Check if the response indicates that items were created/updated
      const responseText = data.response.toLowerCase();
      
      // Check for project creation/update
      if (responseText.includes('project') && (responseText.includes('created') || responseText.includes('added') || responseText.includes('updated'))) {
        // Refresh projects data
        const projectsData = await fetch(`${API_BASE_URL}/api/v1/projects`, {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (projectsData.ok) {
          const projects = await projectsData.json();
          localStorage.setItem('wit-projects', JSON.stringify(projects));
          window.dispatchEvent(new Event('projects-updated'));
        }
      }
      
      // Check for machine/equipment creation/update
      if ((responseText.includes('machine') || responseText.includes('equipment') || responseText.includes('printer')) && 
          (responseText.includes('created') || responseText.includes('added') || responseText.includes('updated'))) {
        // Refresh machines data - try to get from localStorage first since backend might not be available
        const storedMachines = localStorage.getItem('wit-machines');
        if (storedMachines) {
          window.dispatchEvent(new Event('machines-updated'));
        }
      }
      
      // Check for sensor creation/update
      if (responseText.includes('sensor') && (responseText.includes('created') || responseText.includes('added') || responseText.includes('updated'))) {
        // Refresh sensors data
        const storedSensors = localStorage.getItem('wit-sensors');
        if (storedSensors) {
          window.dispatchEvent(new Event('sensors-updated'));
        }
      }
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Could not connect to the terminal server.'}`;
      setHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
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
    <div className="widget-container group h-full">
      <div className="h-full bg-black rounded-lg shadow-lg border border-gray-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <h3 className="text-green-400 text-sm font-mono">W.I.T. Terminal</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* Terminal Body */}
        <div 
          className="flex-1 p-2 font-mono text-xs overflow-hidden flex flex-col mini-terminal"
          onClick={focusInput}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto terminal-output">
            {history.map((line, index) => (
              <div key={index} className="terminal-line">
                {line.role === 'user' && <span className="terminal-prompt text-green-400">&gt; </span>}
                <span className={line.role === 'user' ? 'text-green-400' : 'text-gray-300'}>
                  {line.content}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
          
          {/* Input Line */}
          <div className="terminal-input-line flex items-center">
            <span className="terminal-prompt text-green-400">&gt;</span>
            <div className="flex-1 relative">
              {renderInput()}
            </div>
          </div>
          
          {/* Hidden textarea for input handling */}
          <textarea
            ref={hiddenInputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            className="hidden-input"
            autoFocus
            spellCheck="false"
            style={{ position: 'absolute', left: '-9999px' }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
};

export default WITsWidget;