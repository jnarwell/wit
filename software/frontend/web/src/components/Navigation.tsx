// src/components/Navigation.tsx
import React from 'react';
import { FaHome, FaCogs, FaProjectDiagram, FaChartLine } from 'react-icons/fa';

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const navItems = [
    { id: 'dashboard', label: 'HOME', icon: FaHome },
    { id: 'machines', label: 'MACHINES', icon: FaCogs },
    { id: 'projects', label: 'PROJECTS', icon: FaProjectDiagram },
    { id: 'sensors', label: 'SENSORS', icon: FaChartLine },
  ];

  return (
    <nav className="bg-gray-800 text-white h-16 flex-shrink-0">
      <div className="h-full container mx-auto px-4 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">W.I.T. Dashboard</h1>
        <div className="flex gap-1 md:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md transition-colors text-sm md:text-base ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                <Icon className="text-sm md:text-base" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;