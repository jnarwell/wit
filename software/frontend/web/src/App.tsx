// src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MachinesPage from './pages/MachinesPage';
import ProjectsPage from './pages/ProjectsPage';
import SensorsPage from './pages/SensorsPage';

type Page = 'dashboard' | 'machines' | 'projects' | 'sensors' | 'wit';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Make navigation function globally available for widgets
  useEffect(() => {
    (window as any).__witNavigate = (page: string) => {
      setCurrentPage(page as Page);
    };

    return () => {
      delete (window as any).__witNavigate;
    };
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

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
      case 'wit':
        return (
          <div className="p-8 bg-gray-800 text-white h-full">
            <h1 className="text-3xl font-bold mb-4">W.I.T. System</h1>
            <p>Workshop Integrated Terminal - System Overview</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App h-screen flex flex-col">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;