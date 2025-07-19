// src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MachinesPage from './pages/MachinesPage';
import ProjectsPage from './pages/ProjectsPage';
import SensorsPage from './pages/SensorsPage';
import MachineDetailPage from './pages/MachineDetailPage';
import SensorDetailPage from './pages/SensorDetailPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

type Page = 'dashboard' | 'machines' | 'projects' | 'sensors' | 'wit' | 
           'machine-detail' | 'sensor-detail' | 'project-detail';

interface DetailPageState {
  id: string;
  previousPage: Page;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [detailPageState, setDetailPageState] = useState<DetailPageState | null>(null);

  // Make navigation function globally available for widgets
  useEffect(() => {
    (window as any).__witNavigate = (page: string, id?: string) => {
      if (id) {
        // Navigating to a detail page
        const detailPage = `${page}-detail` as Page;
        setDetailPageState({
          id,
          previousPage: currentPage
        });
        setCurrentPage(detailPage);
      } else {
        // Regular navigation
        setCurrentPage(page as Page);
      }
    };

    return () => {
      delete (window as any).__witNavigate;
    };
  }, [currentPage]);

  const handleNavigate = (page: string, id?: string) => {
    if (id) {
      // Navigating to a detail page
      const detailPage = `${page}-detail` as Page;
      setDetailPageState({
        id,
        previousPage: currentPage
      });
      setCurrentPage(detailPage);
    } else {
      // Regular navigation
      setCurrentPage(page as Page);
      setDetailPageState(null);
    }
  };

  const handleDetailClose = () => {
    if (detailPageState) {
      setCurrentPage(detailPageState.previousPage);
      setDetailPageState(null);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'machines':
        return <MachinesPage onNavigateToDetail={(id) => handleNavigate('machine', id)} />;
      case 'projects':
        return <ProjectsPage onNavigateToDetail={(id) => handleNavigate('project', id)} />;
      case 'sensors':
        return <SensorsPage onNavigateToDetail={(id) => handleNavigate('sensor', id)} />;
      case 'machine-detail':
        return detailPageState ? (
          <MachineDetailPage 
            machineId={detailPageState.id} 
            onClose={handleDetailClose} 
          />
        ) : null;
      case 'sensor-detail':
        return detailPageState ? (
          <SensorDetailPage 
            sensorId={detailPageState.id} 
            onClose={handleDetailClose} 
          />
        ) : null;
      case 'project-detail':
        return detailPageState ? (
          <ProjectDetailPage 
            projectId={detailPageState.id} 
            onClose={handleDetailClose} 
          />
        ) : null;
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

  // Don't show navigation bar on detail pages
  const showNavigation = !['machine-detail', 'sensor-detail', 'project-detail'].includes(currentPage);

  return (
    <div className="App h-screen flex flex-col">
      {showNavigation && (
        <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      )}
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;