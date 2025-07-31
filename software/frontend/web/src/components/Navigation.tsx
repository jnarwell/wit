// src/components/Navigation.tsx
import React, { useState } from 'react';
import { FiHome, FiCpu, FiFolder, FiActivity, FiTerminal, FiUser, FiLogOut, FiChevronDown, FiSettings, FiCode } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FiHome },
    { id: 'machines', label: 'Machines', icon: FiCpu },
    { id: 'projects', label: 'Projects', icon: FiFolder },
    { id: 'sensors', label: 'Sensors', icon: FiActivity },
    { id: 'software', label: 'Software', icon: FiCode },
    { id: 'wit', label: 'W.I.T.', icon: FiTerminal }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-full">
                <FiUser className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-400">
                  {user?.is_admin ? 'Administrator' : 'Operator'}
                </p>
              </div>
              <FiChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowUserMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-20">
                <div className="p-4 border-b border-gray-700">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
                
                <div className="p-2">
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                  >
                    <FiSettings className="inline-block w-4 h-4 mr-2" />
                    Account Settings
                  </button>
                  
                  {user?.is_admin && (
                    <button
                      onClick={() => {
                        window.open('http://localhost:8080/admin.html', '_blank');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      <FiActivity className="inline-block w-4 h-4 mr-2" />
                      Admin Panel
                    </button>
                  )}
                  
                  <hr className="my-2 border-gray-700" />
                  
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 rounded transition-colors"
                  >
                    <FiLogOut className="inline-block w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;