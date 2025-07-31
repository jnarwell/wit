import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './HomePage.css';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [selectedOption, setSelectedOption] = useState(1);
    const terminalRef = useRef<HTMLDivElement>(null);

    const options = [
        { id: 1, label: 'Sign In', action: () => navigate('/login') },
        { id: 2, label: 'Sign Up', action: () => navigate('/signup') },
        { id: 3, label: 'Learn More', action: () => navigate('/about') }
    ];

    useEffect(() => {
        // Redirect if already authenticated
        if (isAuthenticated) {
            navigate('/dashboard');
            return;
        }
        
        // Focus on terminal for keyboard navigation
        if (terminalRef.current) {
            terminalRef.current.focus();
        }
    }, [isAuthenticated, navigate]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case '1':
                setSelectedOption(1);
                options[0].action();
                break;
            case '2':
                setSelectedOption(2);
                options[1].action();
                break;
            case '3':
                setSelectedOption(3);
                options[2].action();
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedOption(prev => prev > 1 ? prev - 1 : 3);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedOption(prev => prev < 3 ? prev + 1 : 1);
                break;
            case 'Enter':
                e.preventDefault();
                const option = options.find(opt => opt.id === selectedOption);
                if (option) option.action();
                break;
        }
    };

    const handleOptionClick = (optionId: number) => {
        setSelectedOption(optionId);
        const option = options.find(opt => opt.id === optionId);
        if (option) option.action();
    };

    return (
        <div className="home-page">
            <div 
                className="home-terminal-container"
                ref={terminalRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                <div className="home-terminal-header">
                    <div className="terminal-buttons">
                        <span className="terminal-button red"></span>
                        <span className="terminal-button yellow"></span>
                        <span className="terminal-button green"></span>
                    </div>
                    <div className="terminal-title">W.I.T. Terminal</div>
                </div>
                
                <div className="home-terminal-content">
                    <div className="home-terminal-line">
                        <span className="prompt">&gt;</span>
                        <span className="command">Hello WIT</span>
                    </div>
                    
                    <div className="home-terminal-line welcome-text">
                        <pre className="ascii-art">
{`
 __        _____ _____ 
 \\ \\      / /_ _|_   _|
  \\ \\ /\\ / / | |  | |  
   \\ V  V /  | |  | |  
    \\_/\\_/  |___| |_|  
                       
 Workshop Intelligence Terminal
`}
                        </pre>
                    </div>

                    <div className="home-terminal-line">
                        <span className="prompt">&gt;</span>
                        <span className="command">Select an option:</span>
                    </div>

                    <div className="options-container">
                        {options.map(option => (
                            <div 
                                key={option.id}
                                className={`terminal-option ${selectedOption === option.id ? 'selected' : ''}`}
                                onClick={() => handleOptionClick(option.id)}
                                onMouseEnter={() => setSelectedOption(option.id)}
                            >
                                <span className="option-number">[{option.id}]</span>
                                <span className="option-text">{option.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="home-terminal-line cursor-line">
                        <span className="prompt">&gt;</span>
                        <span className="cursor blink"></span>
                    </div>

                    <div className="terminal-hint">
                        Use number keys (1-3) or arrow keys to navigate, Enter to select
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;