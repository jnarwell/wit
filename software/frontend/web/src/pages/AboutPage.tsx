import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AboutPage.css';

const AboutPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="about-page">
            <div className="about-container">
                <h1>About W.I.T.</h1>
                <h2>Workshop Intelligence Terminal</h2>
                
                <div className="about-content">
                    <p>
                        W.I.T. is your intelligent workshop companion, designed to streamline 
                        your making process from concept to creation.
                    </p>
                    
                    <div className="features">
                        <h3>Features</h3>
                        <ul>
                            <li>🏗️ Project Management - Track your builds from start to finish</li>
                            <li>🖨️ Equipment Control - Manage 3D printers and other workshop tools</li>
                            <li>📁 File Organization - Keep your designs and documents organized</li>
                            <li>👥 Team Collaboration - Work together on projects</li>
                            <li>📊 Task Tracking - Never lose track of what needs to be done</li>
                            <li>🔧 Material Management - Track inventory and usage</li>
                        </ul>
                    </div>
                    
                    <div className="coming-soon">
                        <h3>Coming Soon</h3>
                        <ul>
                            <li>🤖 AI Assistant - Get help with your projects</li>
                            <li>📸 Vision Integration - Document your builds visually</li>
                            <li>🎙️ Voice Commands - Control your workshop hands-free</li>
                            <li>📈 Analytics - Understand your making patterns</li>
                        </ul>
                    </div>
                </div>
                
                <button className="back-button" onClick={() => navigate('/')}>
                    Back to Home
                </button>
            </div>
        </div>
    );
};

export default AboutPage;