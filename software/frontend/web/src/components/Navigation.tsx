// src/components/Navigation.tsx
import React from 'react';
import { FiHome, FiCpu, FiFolder, FiActivity, FiTerminal } from 'react-icons/fi';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiHome },
    { id: 'machines', label: 'Machines', icon: FiCpu },
    { id: 'projects', label: 'Projects', icon: FiFolder },
    { id: 'sensors', label: 'Sensors', icon: FiActivity },
    { id: 'wit', label: 'W.I.T.', icon: FiTerminal }
  ];

  return (
    <nav className="bg-gray-900 text-white p-4 border-b border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold">W.I.T. Terminal</h1>
          <div className="flex space-x-2">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                    currentPage === item.id 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-gray-800 text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;