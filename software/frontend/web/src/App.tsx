// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MachinesPage from './pages/MachinesPage';
import ProjectsPage from './pages/ProjectsPage';
import SensorsPage from './pages/SensorsPage';
import MachineDetailPage from './pages/MachineDetailPage';
import SensorDetailPage from './pages/SensorDetailPage';
import ProjectDetailPageNew from './pages/ProjectDetailPageNew';
import ProjectDetailPageTabbed from './pages/ProjectDetailPageTabbed';
import LoginPage from './pages/LoginPage';
import CreateUserPage from './pages/CreateUserPage';
import SignupPage from './pages/SignupPage';
import Terminal from './components/Terminal';
import './components/Terminal.css';

type Page = 'dashboard' | 'machines' | 'projects' | 'sensors' | 'wit' | 
           'machine-detail' | 'sensor-detail' | 'project-detail';

interface DetailPageState {
  id: string;
  previousPage: Page;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Load saved page from localStorage
    const savedPage = localStorage.getItem('wit-current-page');
    if (savedPage) {
      // Validate that it's a valid page
      const validPages = ['dashboard', 'machines', 'projects', 'sensors', 'wit', 
                         'machine-detail', 'sensor-detail', 'project-detail'];
      if (validPages.includes(savedPage)) {
        console.log('[App] Restoring page:', savedPage);
        return savedPage as Page;
      }
    }
    console.log('[App] No saved page, defaulting to dashboard');
    return 'dashboard';
  });
  const [detailPageState, setDetailPageState] = useState<DetailPageState | null>(() => {
    // Load saved detail state if we're on a detail page
    const savedPage = localStorage.getItem('wit-current-page');
    const savedDetailState = localStorage.getItem('wit-detail-state');
    
    if (savedPage?.includes('-detail') && savedDetailState) {
      try {
        const parsed = JSON.parse(savedDetailState);
        console.log('[App] Restoring detail state:', parsed);
        return parsed;
      } catch (e) {
        console.error('[App] Failed to parse detail state:', e);
      }
    }
    return null;
  });

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

  // Save current page to localStorage whenever it changes
  useEffect(() => {
    // Don't save detail pages without their state
    if (currentPage.includes('-detail') && !detailPageState) {
      return;
    }
    
    console.log('[App] Saving current page:', currentPage);
    localStorage.setItem('wit-current-page', currentPage);
  }, [currentPage, detailPageState]);

  // Save detail page state
  useEffect(() => {
    if (detailPageState) {
      console.log('[App] Saving detail state:', detailPageState);
      localStorage.setItem('wit-detail-state', JSON.stringify(detailPageState));
    } else {
      // Clear detail state if not on detail page
      localStorage.removeItem('wit-detail-state');
    }
  }, [detailPageState]);

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
      // Clear saved detail state when leaving detail pages
      localStorage.removeItem('wit-detail-state');
    }
  };

  const handleDetailClose = () => {
    if (detailPageState) {
      setCurrentPage(detailPageState.previousPage);
      setDetailPageState(null);
    }
  };

  const handleProjectNotFound = () => {
    console.warn('[App] Project not found, navigating back.');
    if (detailPageState) {
      setCurrentPage(detailPageState.previousPage);
      setDetailPageState(null);
    } else {
      // Fallback if state is inconsistent
      setCurrentPage('dashboard');
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
          <ProjectDetailPageTabbed 
            projectId={detailPageState.id} 
            onClose={handleDetailClose} 
            onNotFound={handleProjectNotFound}
          />
        ) : null;
      case 'wit':
        return <Terminal />;
      default:
        return <Dashboard />;
    }
  };

  // Don't show navigation bar on detail pages
  const showNavigation = !['machine-detail', 'sensor-detail', 'project-detail'].includes(currentPage);

  return (
    <ProtectedRoute>
      <div className="App h-screen flex flex-col">
        {showNavigation && (
          <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
        )}
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage redirectTo="/dashboard" />} />
          <Route path="/create-user" element={<CreateUserPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;