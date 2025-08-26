// src/pages/SensorsPageWithSubpages.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiGrid, FiActivity, FiClock, FiBell, FiSettings } from 'react-icons/fi';
import PageLayout from '../components/PageLayout';
import { SubpageConfig } from '../components/SubpageNavigation';
import SensorsPage from './SensorsPage';
import SensorConfigurationPage from '../sensors/components/configuration/SensorConfigurationPage';

interface SensorsPageWithSubpagesProps {
  onNavigateToDetail?: (id: string) => void;
}

const SensorsPageWithSubpages: React.FC<SensorsPageWithSubpagesProps> = ({ onNavigateToDetail }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine current subpage from URL
  const pathParts = location.pathname.split('/');
  const subpageFromUrl = pathParts[2] || 'overview';
  
  const [currentSubpage, setCurrentSubpage] = useState(subpageFromUrl);

  // Define subpages configuration
  const sensorSubpages: SubpageConfig[] = [
    { id: 'overview', label: 'Overview', icon: <FiGrid /> },
    { id: 'live-data', label: 'Live Data', icon: <FiActivity /> },
    { id: 'history', label: 'History', icon: <FiClock /> },
    { id: 'alerts', label: 'Alerts', icon: <FiBell /> },
    { id: 'configuration', label: 'Configuration', icon: <FiSettings /> }
  ];

  // Update URL when subpage changes
  const handleSubpageChange = (pageId: string) => {
    setCurrentSubpage(pageId);
    if (pageId === 'overview') {
      navigate('/sensors');
    } else {
      navigate(`/sensors/${pageId}`);
    }
  };

  // Sync state with URL changes
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const subpageFromUrl = pathParts[2] || 'overview';
    setCurrentSubpage(subpageFromUrl);
  }, [location.pathname]);

  // Render content based on current subpage
  const renderSubpageContent = () => {
    switch (currentSubpage) {
      case 'overview':
        return <SensorsPage onNavigateToDetail={onNavigateToDetail} />;
      
      case 'live-data':
        return (
          <div className="h-full bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Live Sensor Data</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400">Real-time sensor data streams will be displayed here.</p>
                <p className="text-gray-500 mt-2">This feature allows you to monitor sensor readings in real-time with live graphs and alerts.</p>
              </div>
            </div>
          </div>
        );
      
      case 'history':
        return (
          <div className="h-full bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Sensor History</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400">Historical sensor data and trends will be displayed here.</p>
                <p className="text-gray-500 mt-2">View and analyze past sensor readings with customizable time ranges and export options.</p>
              </div>
            </div>
          </div>
        );
      
      case 'alerts':
        return (
          <div className="h-full bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Sensor Alerts</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400">Configure and manage sensor alerts here.</p>
                <p className="text-gray-500 mt-2">Set up threshold alerts, notification preferences, and alert history.</p>
              </div>
            </div>
          </div>
        );
      
      case 'configuration':
        return <SensorConfigurationPage />;
      
      default:
        return (
          <div className="h-full bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400">Page not found</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <PageLayout
      subpages={sensorSubpages}
      activeSubpage={currentSubpage}
      onSubpageChange={handleSubpageChange}
    >
      {renderSubpageContent()}
    </PageLayout>
  );
};

export default SensorsPageWithSubpages;