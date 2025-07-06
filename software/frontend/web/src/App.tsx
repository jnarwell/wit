// src/App.tsx
import React, { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MachinesPage from './pages/MachinesPage';
import ProjectsPage from './pages/ProjectsPage';
import SensorsPage from './pages/SensorsPage';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'machines':
        return <MachinesPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'sensors':
        return <SensorsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-grow overflow-hidden">
        {renderPage()}
      </div>
    </div>
  );
}

export default App;