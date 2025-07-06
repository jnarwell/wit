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
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-2xl font-bold">W.I.T. Dashboard</h1>
        <div className="flex gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;