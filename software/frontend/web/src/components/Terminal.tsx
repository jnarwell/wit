// software/frontend/web/src/components/Terminal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Terminal.css';
import { useAuth } from '../contexts/AuthContext';
import FileBrowser from './FileBrowser';
import Resizer from './Resizer';
import FileViewer from './FileViewer';
import { FaCog, FaTimes, FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import voiceService from '../services/voiceService';

const API_BASE_URL = 'http://localhost:8000';

interface TerminalLine {
    role: 'user' | 'assistant';
    content: string;
}

interface ViewingFile {
    path: string;
    baseDir: string;
    projectId?: string;
}

interface AIAgent {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

interface TerminalSettings {
    agents: AIAgent[];
    synthesizeResults: boolean;
}

const Terminal: React.FC = () => {
    const { tokens } = useAuth();
    const [history, setHistory] = useState<TerminalLine[]>(() => {
        try {
            const savedHistory = localStorage.getItem('wit-terminal-history');
            return savedHistory ? JSON.parse(savedHistory) : [{ role: 'assistant', content: 'Welcome to the W.I.T. Terminal. Type "help" for commands or "voice on" to enable voice mode.' }];
        } catch (error) {
            return [{ role: 'assistant', content: 'Welcome to the W.I.T. Terminal. Type "help" for commands or "voice on" to enable voice mode.' }];
        }
    });
    const [input, setInput] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(window.innerWidth / 4);
    const [isResizing, setIsResizing] = useState(false);
    const [viewingFile, setViewingFile] = useState<ViewingFile | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<TerminalSettings>(() => {
        const savedSettings = localStorage.getItem('wit-terminal-settings');
        if (savedSettings) {
            try {
                return JSON.parse(savedSettings);
            } catch (e) {
                // Fall through to default
            }
        }
        return {
            agents: [
                { id: 'wit-primary', name: 'W.I.T. Primary', description: 'Main workshop assistant AI', enabled: true },
                { id: 'wit-analyst', name: 'W.I.T. Analyst', description: 'Data analysis and insights AI', enabled: false },
                { id: 'wit-engineer', name: 'W.I.T. Engineer', description: 'Technical engineering assistant', enabled: false },
                { id: 'wit-safety', name: 'W.I.T. Safety', description: 'Safety and compliance monitor', enabled: false }
            ],
            synthesizeResults: false
        };
    });
    const [voiceEnabled, setVoiceEnabled] = useState(voiceService.isEnabled());
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    
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
        
        // Setup voice service listeners
        const handleVoiceCommand = (command: string) => {
            if (command.trim()) {
                handleCommandSubmit(command);
            }
        };

        const handleInterimTranscript = (transcript: string) => {
            setVoiceTranscript(transcript);
        };

        const handleListeningStart = () => {
            setIsListening(true);
        };

        const handleListeningEnd = () => {
            setIsListening(false);
            setVoiceTranscript('');
        };

        const handleSpeechStart = () => {
            setIsSpeaking(true);
        };

        const handleSpeechEnd = () => {
            setIsSpeaking(false);
        };

        voiceService.on('command', handleVoiceCommand);
        voiceService.on('interim-transcript', handleInterimTranscript);
        voiceService.on('listening-start', handleListeningStart);
        voiceService.on('listening-end', handleListeningEnd);
        voiceService.on('speech-start', handleSpeechStart);
        voiceService.on('speech-end', handleSpeechEnd);

        return () => {
            voiceService.off('command', handleVoiceCommand);
            voiceService.off('interim-transcript', handleInterimTranscript);
            voiceService.off('listening-start', handleListeningStart);
            voiceService.off('listening-end', handleListeningEnd);
            voiceService.off('speech-start', handleSpeechStart);
            voiceService.off('speech-end', handleSpeechEnd);
        };
    }, []);

    const logMessage = async (role: 'user' | 'assistant', content: string) => {
        if (!tokens) return;
        try {
            await fetch(`${API_BASE_URL}/api/v1/log-ai-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokens.access_token}`,
                },
                body: JSON.stringify({ sender: role, message: content }),
            });
        } catch (error) {
            console.error("Failed to log message:", error);
        }
    };

    const handleCommandSubmit = async (command: string) => {
        if (!tokens) {
            const errorMessage = 'Error: Authentication token not found. Please log in again.';
            setHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
            await logMessage('assistant', errorMessage);
            return;
        }

        const newHistory: TerminalLine[] = [...history, { role: 'user', content: command }];
        setHistory(newHistory);
        await logMessage('user', command);
        setIsProcessing(true);

        if (command.toLowerCase() === 'clear') {
            const clearMessage = 'Terminal cleared.';
            setHistory([{ role: 'assistant', content: clearMessage }]);
            await logMessage('assistant', clearMessage);
            setIsProcessing(false);
            return;
        }

        // Handle voice commands
        const lowerCommand = command.toLowerCase().trim();
        if (lowerCommand === 'voice on' || lowerCommand === 'enable voice' || lowerCommand === 'start voice') {
            voiceService.start();
            setVoiceEnabled(true);
            const message = 'Voice mode activated. Say "hey wit" to wake me up, or "stop" to deactivate voice mode.';
            setHistory(prev => [...prev, { role: 'assistant', content: message }]);
            await logMessage('assistant', message);
            setIsProcessing(false);
            return;
        }
        
        if (lowerCommand === 'voice off' || lowerCommand === 'disable voice' || lowerCommand === 'stop voice') {
            voiceService.stop();
            setVoiceEnabled(false);
            const message = 'Voice mode deactivated.';
            setHistory(prev => [...prev, { role: 'assistant', content: message }]);
            await logMessage('assistant', message);
            setIsProcessing(false);
            return;
        }
        
        if (lowerCommand === 'help') {
            const helpMessage = `W.I.T. Terminal Commands:

Basic Commands:
• "clear" - Clear terminal history
• "help" - Show this help message

Voice Commands:
• "voice on" - Enable voice mode
• "voice off" - Disable voice mode  
• "voice help" - Show voice-specific help

When voice is enabled:
• Say "hey wit" to wake up when sleeping
• Say "stop" to deactivate voice mode
• Terminal will pause after 3 seconds of silence
• Terminal will sleep after 5 minutes of inactivity

Examples:
• "create a new project called workshop automation"
• "add a 3d printer to my machines"
• "show me all sensors"`;
            setHistory(prev => [...prev, { role: 'assistant', content: helpMessage }]);
            await logMessage('assistant', helpMessage);
            setIsProcessing(false);
            return;
        }
        
        if (lowerCommand === 'voice help' || lowerCommand === 'help voice') {
            const helpMessage = `Voice Commands:
• "voice on" - Enable voice mode
• "voice off" - Disable voice mode
• "hey wit" - Wake word when voice is sleeping
• "stop" - Stop listening (when spoken)
• Voice will pause after 3 seconds of silence
• Voice will sleep after 5 minutes of inactivity
• While sleeping, only the wake word "hey wit" will activate`;
            setHistory(prev => [...prev, { role: 'assistant', content: helpMessage }]);
            await logMessage('assistant', helpMessage);
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
                    history: newHistory.slice(-10),
                    agents: settings.agents.filter(a => a.enabled).map(a => a.id),
                    synthesize: settings.synthesizeResults && settings.agents.filter(a => a.enabled).length > 1
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'API request failed');
            }
            const data = await response.json();
            
            // Handle multi-agent responses (future implementation)
            const enabledAgents = settings.agents.filter(a => a.enabled);
            let responseContent = data.response;
            
            if (settings.synthesizeResults && enabledAgents.length > 1 && data.synthesized) {
                responseContent = `[Synthesized from ${enabledAgents.length} agents]\n${responseContent}`;
            } else if (enabledAgents.length > 1 && data.multiAgentResponses) {
                // Future: Show individual agent responses
                responseContent = data.response;
            }
            
            setHistory(prev => [...prev, { role: 'assistant', content: responseContent }]);
            await logMessage('assistant', responseContent);
            
            // Speak the response if voice is enabled
            if (voiceEnabled && !voiceService.isSleeping()) {
                voiceService.speak(responseContent);
            }
            
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
            await logMessage('assistant', errorMessage);
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

    const toggleAgent = (agentId: string) => {
        setSettings(prev => ({
            ...prev,
            agents: prev.agents.map(agent => 
                agent.id === agentId ? { ...agent, enabled: !agent.enabled } : agent
            )
        }));
    };

    const toggleSynthesize = () => {
        setSettings(prev => ({
            ...prev,
            synthesizeResults: !prev.synthesizeResults
        }));
    };

    return (
        <div className="terminal-container">
            <div className="terminal-main-area">
                {viewingFile && <FileViewer {...viewingFile} onClose={() => setViewingFile(null)} />}
                <div className="terminal" onClick={focusInput}>
                    {/* Terminal Controls */}
                    <div className="terminal-controls">
                        {/* Voice Indicator */}
                        {voiceEnabled && (
                            <div className="voice-indicator">
                                {isListening ? (
                                    <div className="voice-status listening">
                                        <FaMicrophone className="voice-icon pulse" />
                                        <span className="voice-text">Listening{voiceTranscript && '...'}</span>
                                    </div>
                                ) : isSpeaking ? (
                                    <div className="voice-status speaking">
                                        <FaVolumeUp className="voice-icon" />
                                        <span className="voice-text">Speaking</span>
                                    </div>
                                ) : voiceService.isSleeping() ? (
                                    <div className="voice-status sleeping">
                                        <FaMicrophoneSlash className="voice-icon" />
                                        <span className="voice-text">Say "hey wit"</span>
                                    </div>
                                ) : (
                                    <div className="voice-status ready">
                                        <FaMicrophone className="voice-icon" />
                                        <span className="voice-text">Ready</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Voice Toggle Button */}
                        <button 
                            className={`terminal-voice-button ${voiceEnabled ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (voiceEnabled) {
                                    voiceService.stop();
                                    setVoiceEnabled(false);
                                } else {
                                    voiceService.start();
                                    setVoiceEnabled(true);
                                }
                            }}
                            title={voiceEnabled ? "Disable voice mode" : "Enable voice mode"}
                        >
                            {voiceEnabled ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}
                        </button>
                        
                        {/* Settings Button */}
                        <button 
                            className="terminal-settings-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowSettings(!showSettings);
                            }}
                            title="Terminal Settings"
                        >
                            <FaCog size={20} />
                        </button>
                    </div>

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
                        {voiceTranscript && isListening ? (
                            <span className="terminal-input-text voice-transcript">{voiceTranscript}</span>
                        ) : (
                            renderInput()
                        )}
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
            </div>
            <Resizer onMouseDown={handleMouseDown} />
            <div style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}>
                <FileBrowser onFileSelect={(path, baseDir, projectId) => setViewingFile({ path, baseDir, projectId })} />
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="terminal-settings-modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="terminal-settings-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="terminal-settings-header">
                            <h2>Terminal Settings</h2>
                            <button 
                                className="terminal-settings-close"
                                onClick={() => setShowSettings(false)}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        
                        <div className="terminal-settings-content">
                            <div className="terminal-settings-section">
                                <h3>AI Agents</h3>
                                <p className="terminal-settings-description">
                                    Select which AI agents to query. When multiple agents are selected, 
                                    you can choose to synthesize their responses into a unified answer.
                                </p>
                                
                                <div className="terminal-agents-list">
                                    {settings.agents.map(agent => (
                                        <div key={agent.id} className="terminal-agent-item">
                                            <label className="terminal-agent-label">
                                                <input
                                                    type="checkbox"
                                                    checked={agent.enabled}
                                                    onChange={() => toggleAgent(agent.id)}
                                                    className="terminal-agent-checkbox"
                                                />
                                                <div className="terminal-agent-info">
                                                    <div className="terminal-agent-name">{agent.name}</div>
                                                    <div className="terminal-agent-description">{agent.description}</div>
                                                </div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="terminal-settings-section">
                                <h3>Result Synthesis</h3>
                                <label className="terminal-synthesis-label">
                                    <input
                                        type="checkbox"
                                        checked={settings.synthesizeResults}
                                        onChange={toggleSynthesize}
                                        disabled={settings.agents.filter(a => a.enabled).length <= 1}
                                        className="terminal-synthesis-checkbox"
                                    />
                                    <div className="terminal-synthesis-info">
                                        <div className="terminal-synthesis-title">
                                            Synthesize Results
                                        </div>
                                        <div className="terminal-synthesis-description">
                                            When multiple agents are selected, combine their responses into a single, unified answer.
                                            {settings.agents.filter(a => a.enabled).length <= 1 && (
                                                <span className="terminal-synthesis-note"> (Requires at least 2 agents)</span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="terminal-settings-footer">
                                <div className="terminal-settings-status">
                                    Active agents: {settings.agents.filter(a => a.enabled).length} / {settings.agents.length}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Terminal;
