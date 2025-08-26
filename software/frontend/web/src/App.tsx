// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import MachinesPageWithSubpages from './pages/MachinesPageWithSubpages';
import ProjectsPage from './pages/ProjectsPage';
import SensorsPageWithSubpages from './pages/SensorsPageWithSubpages';
import MachineDetailPage from './pages/MachineDetailPage';
import SensorDetailPage from './pages/SensorDetailPage';
import ProjectDetailPageNew from './pages/ProjectDetailPageNew';
import ProjectDetailPageTabbed from './pages/ProjectDetailPageTabbed';
import LoginPage from './pages/LoginPage';
import CreateUserPage from './pages/CreateUserPage';
import SignupPage from './pages/SignupPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import SettingsPage from './pages/SettingsPage';
import Terminal from './components/Terminal';
import './components/Terminal.css';
import WITPage from './pages/WITPage';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import SoftwareIntegrationsPage from './pages/SoftwareIntegrationsPage';
import ApplicationControlPage from './pages/ApplicationControlPage';
import SlicerControlPage from './pages/SlicerControlPage';
import MATLABControlPage from './pages/MATLABControlPage';
import KiCadControlPage from './pages/KiCadControlPage';
import LabVIEWControlPage from './pages/LabVIEWControlPage';
import NodeREDControlPage from './pages/NodeREDControlPage';
import OpenSCADControlPage from './pages/OpenSCADControlPage';
import VSCodeControlPage from './pages/VSCodeControlPage';
import DockerControlPage from './pages/DockerControlPage';
import BlenderControlPage from './pages/BlenderControlPage';
import FreeCADControlPage from './pages/FreeCADControlPage';
import FileBrowserPage from './pages/FileBrowserPage';
import FunctionPage from './components/FunctionPage';

type Page = 'dashboard' | 'machines' | 'projects' | 'sensors' | 'wit' | 'settings' | 'software' | 'function' |
           'machine-detail' | 'sensor-detail' | 'project-detail' | 'software-detail';

interface DetailPageState {
  id: string;
  previousPage: Page;
}

interface WitState {
  terminalId?: string;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Load saved page from localStorage
    const savedPage = localStorage.getItem('wit-current-page');
    if (savedPage) {
      // Validate that it's a valid page
      const validPages = ['dashboard', 'machines', 'projects', 'sensors', 'wit', 'settings', 'software',
                         'machine-detail', 'sensor-detail', 'project-detail', 'software-detail'];
      if (validPages.includes(savedPage)) {
        console.log('[App] Restoring page:', savedPage);
        return savedPage as Page;
      }
    }
    console.log('[App] No saved page, defaulting to dashboard');
    return 'dashboard';
  });
  const [witState, setWitState] = useState<WitState>({});
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
      // Special handling for WIT terminal navigation
      if (page === 'wit') {
        setCurrentPage('wit');
        setWitState({ terminalId: id });
        setDetailPageState(null);
        return;
      }
      
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
        setWitState({}); // Clear WIT state when navigating away
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
    // Special handling for WIT terminal navigation
    if (page === 'wit' && id) {
      // Update the URL hash to include terminal ID
      window.location.hash = `/wit/${id}`;
      return;
    }
    
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
      setWitState({}); // Clear WIT state when navigating away
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
        return <MachinesPageWithSubpages onNavigateToDetail={(id) => handleNavigate('machine', id)} />;
      case 'projects':
        return <ProjectsPage onNavigateToDetail={(id) => handleNavigate('project', id)} />;
      case 'sensors':
        return <SensorsPageWithSubpages onNavigateToDetail={(id) => handleNavigate('sensor', id)} />;
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
        return <WITPage terminalId={witState.terminalId} />;
      case 'settings':
        return <SettingsPage />;
      case 'software':
        return <SoftwareIntegrationsPage onNavigateToDetail={(id) => handleNavigate('software', id)} />;
      case 'software-detail':
        return detailPageState ? (
          detailPageState.id === 'unified-slicer' ? (
            <SlicerControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'matlab' ? (
            <MATLABControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'kicad' ? (
            <KiCadControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'labview' ? (
            <LabVIEWControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'node-red' ? (
            <NodeREDControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'openscad' ? (
            <OpenSCADControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'vscode' ? (
            <VSCodeControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'docker' ? (
            <DockerControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'blender' ? (
            <BlenderControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'freecad' ? (
            <FreeCADControlPage onClose={handleDetailClose} />
          ) : detailPageState.id === 'file-browser' ? (
            <FileBrowserPage onNavigateBack={handleDetailClose} />
          ) : (
            <ApplicationControlPage 
              pluginId={detailPageState.id}
              onClose={handleDetailClose}
            />
          )
        ) : null;
      case 'function':
        return <FunctionPage />;
      default:
        return <Dashboard />;
    }
  };

  // Don't show navigation bar on detail pages
  const showNavigation = !['machine-detail', 'sensor-detail', 'project-detail', 'software-detail'].includes(currentPage);

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
      <ThemeProvider>
        <AuthProvider>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage redirectTo="/dashboard" />} />
          <Route path="/create-user" element={<CreateUserPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/*" element={<AppContent />} />
          <Route path="/machines/*" element={<AppContent />} />
          <Route path="/sensors/*" element={<AppContent />} />
          <Route path="/wit/*" element={<AppContent />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;