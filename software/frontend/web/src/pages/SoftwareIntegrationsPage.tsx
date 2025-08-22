import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlus, FaFilter, FaSortAmountDown, FaTimes, FaCode, FaCloud, FaDatabase, FaRobot, FaCubes, FaChartLine, FaMicrochip, FaCube, FaPrint, FaCheck, FaExclamationTriangle, FaClock, FaDesktop, FaCog, FaCalculator, FaProjectDiagram, FaFolder, FaDocker, FaGitAlt } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useUDCWebSocket } from '../hooks/useUDCWebSocket';
import './SoftwareIntegrationsPage.css';

const API_BASE_URL = 'http://localhost:8000';

// Interface for software integrations
interface SoftwareIntegration {
  id: string;
  name: string;
  type: 'cad' | 'simulation' | 'embedded' | 'pcb' | 'data_acquisition' | 'manufacturing' | 'api' | 'database' | 'cloud' | 'ai' | 'editor' | 'slicer' | 'vcs' | 'devops' | 'other';
  status: 'active' | 'configured' | 'inactive' | 'error' | 'pending';
  description: string;
  endpoint?: string;
  apiKey?: string;
  username?: string;
  lastSync?: string;
  config?: Record<string, any>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  comingSoon?: boolean;
  isUDCPlugin?: boolean;
  pluginId?: string;
}

interface SoftwareIntegrationsPageProps {
  onNavigateToDetail?: (id: string) => void;
}

const SOFTWARE_TYPES = {
  'cad': { label: 'CAD & Design', icon: FaCubes },
  'simulation': { label: 'Simulation & Analysis', icon: FaChartLine },
  'embedded': { label: 'Programming & Embedded', icon: FaMicrochip },
  'pcb': { label: 'PCB & Electronics', icon: FaMicrochip },
  'data_acquisition': { label: 'Data Acquisition', icon: FaChartLine },
  'manufacturing': { label: 'Manufacturing & CAM', icon: FaCubes },
  'slicer': { label: '3D Slicers', icon: FaCube },
  'printer_control': { label: 'Printer Control', icon: FaPrint },
  'editor': { label: 'Code Editors & IDEs', icon: FaCode },
  'devops': { label: 'DevOps & Containers', icon: FaDocker },
  'vcs': { label: 'Version Control', icon: FaGitAlt },
  'api': { label: 'API', icon: FaCode },
  'database': { label: 'Database', icon: FaDatabase },
  'cloud': { label: 'Cloud Service', icon: FaCloud },
  'ai': { label: 'AI Service', icon: FaRobot },
  'other': { label: 'Other', icon: FaCode },
};

const SOFTWARE_STATUS = {
  'active': { label: 'Active', color: 'bg-green-500' },
  'configured': { label: 'Configured', color: 'bg-gray-500' },
  'error': { label: 'Error', color: 'bg-red-500' },
  'pending': { label: 'Pending', color: 'bg-yellow-500' },
};

const SoftwareIntegrationsPage: React.FC<SoftwareIntegrationsPageProps> = ({ onNavigateToDetail }) => {
  const { isAuthenticated, tokens } = useAuth();
  const { status: udcStatus, wsStatus, sendCommand, refreshStatus } = useUDCWebSocket();
  const [integrations, setIntegrations] = useState<SoftwareIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [activeTab, setActiveTab] = useState('active');
  
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    type: 'api' as keyof typeof SOFTWARE_TYPES,
    description: '',
    endpoint: '',
    apiKey: '',
    username: '',
  });
  
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [configureIntegration, setConfigureIntegration] = useState<SoftwareIntegration | null>(null);
  const [pluginConfig, setPluginConfig] = useState({
    port: '',
    board: 'arduino:avr:uno',
    baudRate: 9600,
    sketchesPath: '~/Documents/Arduino'
  });

  // UDC-aware integrations
  const UDC_INTEGRATIONS: SoftwareIntegration[] = [
    {
      id: 'arduino-ide',
      name: 'Arduino IDE',
      type: 'embedded',
      status: 'configured',
      description: 'Programming environment for Arduino microcontrollers',
      isUDCPlugin: true,
      pluginId: 'arduino-ide'
    },
    {
      id: 'unified-slicer',
      name: 'Unified 3D Slicers',
      type: 'slicer',
      status: 'configured',
      description: 'Complete integration for all major 3D slicing software including PrusaSlicer, OrcaSlicer, Bambu Studio, SuperSlicer, and Cura',
      isUDCPlugin: true,
      pluginId: 'unified-slicer'
    },
    {
      id: 'matlab',
      name: 'MATLAB',
      type: 'simulation',
      status: 'configured',
      description: 'Advanced computational analysis, modeling, and simulation platform with comprehensive toolboxes',
      isUDCPlugin: true,
      pluginId: 'matlab'
    },
    {
      id: 'kicad',
      name: 'KiCad',
      type: 'pcb',
      status: 'configured',
      description: 'Open-source electronics design automation suite for schematic capture and PCB design',
      isUDCPlugin: true,
      pluginId: 'kicad'
    },
    {
      id: 'labview',
      name: 'LabVIEW',
      type: 'data_acquisition',
      status: 'configured',
      description: 'Graphical programming platform for measurement systems and data acquisition',
      isUDCPlugin: true,
      pluginId: 'labview'
    },
    {
      id: 'node-red',
      name: 'Node-RED',
      type: 'data_acquisition',
      status: 'configured',
      description: 'Flow-based visual programming for IoT automation and sensor integration',
      isUDCPlugin: true,
      pluginId: 'node-red'
    },
    {
      id: 'vscode',
      name: 'Visual Studio Code',
      type: 'editor',
      status: 'configured',
      description: 'Professional code editor with IntelliSense, debugging, and Git integration',
      isUDCPlugin: true,
      pluginId: 'vscode'
    },
    {
      id: 'docker',
      name: 'Docker Desktop',
      type: 'devops',
      status: 'configured',
      description: 'Container management, image building, and Docker Compose orchestration for development workflows',
      isUDCPlugin: true,
      pluginId: 'docker'
    },
    {
      id: 'openscad',
      name: 'OpenSCAD',
      type: 'cad',
      status: 'configured',
      description: 'The Programmers Solid 3D CAD Modeller - Create 3D models using code',
      isUDCPlugin: true,
      pluginId: 'openscad'
    },
    {
      id: 'blender',
      name: 'Blender',
      type: 'cad',
      status: 'configured',
      description: 'AI-powered 3D modeling, animation, and rendering with comprehensive Python API',
      isUDCPlugin: true,
      pluginId: 'blender'
    },
    {
      id: 'file-browser',
      name: 'File Browser',
      type: 'other',
      status: 'configured',
      description: 'Complete file system access and management - browse, read, write, and manage files across your entire system',
      isUDCPlugin: true,
      pluginId: 'file-browser'
    },
    {
      id: 'freecad',
      name: 'FreeCAD',
      type: 'cad',
      status: 'configured',
      description: 'Open-source parametric 3D modeler with Python scripting for engineering and product design',
      isUDCPlugin: true,
      pluginId: 'freecad'
    },
    {
      id: 'fusion360',
      name: 'Fusion 360',
      type: 'cad',
      status: 'configured',
      description: 'Professional CAD/CAM integration with Autodesk Fusion 360 - AI-driven parametric design, simulation, and manufacturing workflows',
      isUDCPlugin: true,
      pluginId: 'fusion360'
    },
    {
      id: 'git',
      name: 'Git Desktop',
      type: 'vcs',
      status: 'configured',
      description: 'Comprehensive Git integration for version control of CAD files, code, and project assets with visual diff capabilities',
      isUDCPlugin: true,
      pluginId: 'git'
    }
  ];

  // Predefined software integrations (coming soon)
  const COMING_SOON_SOFTWARE: SoftwareIntegration[] = [
    // CAD & Design Software
    {
      id: 'solidworks-001',
      name: 'SolidWorks',
      type: 'cad',
      status: 'pending',
      description: 'Comprehensive 3D CAD software',
      comingSoon: true
    },
    {
      id: 'onshape-001',
      name: 'OnShape',
      type: 'cad',
      status: 'pending',
      description: 'Browser-based collaborative CAD',
      comingSoon: true
    },
    {
      id: 'autocad-001',
      name: 'AutoCAD',
      type: 'cad',
      status: 'pending',
      description: '2D and 3D drafting software',
      comingSoon: true
    },
    {
      id: 'inventor-001',
      name: 'Inventor',
      type: 'cad',
      status: 'pending',
      description: "Autodesk's 3D mechanical design software",
      comingSoon: true
    },
    {
      id: 'creo-001',
      name: 'Creo',
      type: 'cad',
      status: 'pending',
      description: "PTC's parametric 3D modeling (formerly Pro/Engineer)",
      comingSoon: true
    },
    {
      id: 'catia-001',
      name: 'CATIA',
      type: 'cad',
      status: 'pending',
      description: "Dassault Systèmes' advanced CAD suite",
      comingSoon: true
    },
    {
      id: 'rhino3d-001',
      name: 'Rhino 3D',
      type: 'cad',
      status: 'pending',
      description: 'NURBS-based 3D modeling',
      comingSoon: true
    },
    
    // Simulation & Analysis
    {
      id: 'ansys-001',
      name: 'ANSYS',
      type: 'simulation',
      status: 'pending',
      description: 'Comprehensive simulation software suite',
      comingSoon: true
    },
    {
      id: 'comsol-001',
      name: 'COMSOL Multiphysics',
      type: 'simulation',
      status: 'pending',
      description: 'Finite element analysis and modeling',
      comingSoon: true
    },
    {
      id: 'abaqus-001',
      name: 'Abaqus',
      type: 'simulation',
      status: 'pending',
      description: 'Advanced finite element analysis',
      comingSoon: true
    },
    {
      id: 'nastran-001',
      name: 'NASTRAN',
      type: 'simulation',
      status: 'pending',
      description: 'Structural analysis solver',
      comingSoon: true
    },
    {
      id: 'simulink-001',
      name: 'Simulink',
      type: 'simulation',
      status: 'pending',
      description: 'MATLAB-based simulation platform',
      comingSoon: true
    },
    {
      id: 'adams-001',
      name: 'Adams',
      type: 'simulation',
      status: 'pending',
      description: 'Mechanical system simulation',
      comingSoon: true
    },
    {
      id: 'lsdyna-001',
      name: 'LS-DYNA',
      type: 'simulation',
      status: 'pending',
      description: 'Explicit finite element analysis',
      comingSoon: true
    },
    
    // Programming & Embedded Systems
    {
      id: 'platformio-001',
      name: 'PlatformIO',
      type: 'embedded',
      status: 'pending',
      description: 'Cross-platform IDE for IoT development',
      comingSoon: true
    },
    {
      id: 'mplabx-001',
      name: 'MPLAB X',
      type: 'embedded',
      status: 'pending',
      description: "Microchip's development environment",
      comingSoon: true
    },
    {
      id: 'keil-001',
      name: 'Keil',
      type: 'embedded',
      status: 'pending',
      description: 'ARM microcontroller development tools',
      comingSoon: true
    },
    {
      id: 'ccs-001',
      name: 'Code Composer Studio',
      type: 'embedded',
      status: 'pending',
      description: "Texas Instruments' IDE",
      comingSoon: true
    },
    {
      id: 'stm32cube-001',
      name: 'STM32CubeIDE',
      type: 'embedded',
      status: 'pending',
      description: 'STMicroelectronics development environment',
      comingSoon: true
    },
    
    // PCB Design & Electronics
    {
      id: 'altium-001',
      name: 'Altium Designer',
      type: 'pcb',
      status: 'pending',
      description: 'Professional PCB design software',
      comingSoon: true
    },
    {
      id: 'eagle-001',
      name: 'Eagle',
      type: 'pcb',
      status: 'pending',
      description: 'PCB design tool (now part of Fusion 360)',
      comingSoon: true
    },
    {
      id: 'proteus-001',
      name: 'Proteus',
      type: 'pcb',
      status: 'pending',
      description: 'Circuit simulation and PCB design',
      comingSoon: true
    },
    {
      id: 'ltspice-001',
      name: 'LTspice',
      type: 'pcb',
      status: 'pending',
      description: 'Circuit simulation software',
      comingSoon: true
    },
    {
      id: 'multisim-001',
      name: 'Multisim',
      type: 'pcb',
      status: 'pending',
      description: 'Circuit design and simulation',
      comingSoon: true
    },
    
    // Data Acquisition & Analysis
    {
      id: 'dewesoft-001',
      name: 'DEWESoft',
      type: 'data_acquisition',
      status: 'pending',
      description: 'Data acquisition and analysis platform',
      comingSoon: true
    },
    {
      id: 'dspace-001',
      name: 'dSPACE',
      type: 'data_acquisition',
      status: 'pending',
      description: 'Real-time simulation and testing',
      comingSoon: true
    },
    {
      id: 'ncode-001',
      name: 'HBM nCode',
      type: 'data_acquisition',
      status: 'pending',
      description: 'Durability and fatigue analysis',
      comingSoon: true
    },
    
    // Manufacturing & CAM
    {
      id: 'mastercam-001',
      name: 'Mastercam',
      type: 'manufacturing',
      status: 'pending',
      description: 'Computer-aided manufacturing software',
      comingSoon: true
    },
    {
      id: 'powermill-001',
      name: 'PowerMill',
      type: 'manufacturing',
      status: 'pending',
      description: 'Advanced CAM software',
      comingSoon: true
    },
    {
      id: 'hsmworks-001',
      name: 'HSMWorks',
      type: 'manufacturing',
      status: 'pending',
      description: 'Integrated CAM for SolidWorks',
      comingSoon: true
    },
    {
      id: 'edgecam-001',
      name: 'EdgeCAM',
      type: 'manufacturing',
      status: 'pending',
      description: 'Manufacturing software suite',
      comingSoon: true
    },
    {
      id: 'nxcam-001',
      name: 'NX CAM',
      type: 'manufacturing',
      status: 'pending',
      description: "Siemens' manufacturing solution",
      comingSoon: true
    },
    
    // Specialized Slicers (Resin)
    {
      id: 'chitubox-001',
      name: 'CHITUBOX',
      type: 'slicer',
      status: 'pending',
      description: 'Resin printer slicer with excellent support generation',
      comingSoon: true
    },
    {
      id: 'lychee-001',
      name: 'Lychee Slicer',
      type: 'slicer',
      status: 'pending',
      description: 'Professional resin slicer with AI support detection',
      comingSoon: true
    },
    
    // Printer Control Software
    {
      id: 'octoprint-001',
      name: 'OctoPrint',
      type: 'printer_control',
      status: 'pending',
      description: 'Web-based 3D printer control with extensive plugin ecosystem',
      comingSoon: true
    },
    {
      id: 'mainsail-001',
      name: 'Mainsail',
      type: 'printer_control',
      status: 'pending',
      description: 'Lightweight web interface for Klipper 3D printer firmware',
      comingSoon: true
    },
    {
      id: 'fluidd-001',
      name: 'Fluidd',
      type: 'printer_control',
      status: 'pending',
      description: 'Responsive web UI for Klipper with mobile support',
      comingSoon: true
    },
    {
      id: 'duetwebcontrol-001',
      name: 'Duet Web Control',
      type: 'printer_control',
      status: 'pending',
      description: 'Web interface for Duet3D printer boards',
      comingSoon: true
    },
    {
      id: 'repetierserver-001',
      name: 'Repetier-Server',
      type: 'printer_control',
      status: 'pending',
      description: 'Professional 3D printer server with multi-printer support',
      comingSoon: true
    },
    {
      id: 'astroprint-001',
      name: 'AstroPrint',
      type: 'printer_control',
      status: 'pending',
      description: 'Cloud-based 3D printer management platform',
      comingSoon: true
    },
    {
      id: 'prusalink-001',
      name: 'PrusaLink',
      type: 'printer_control',
      status: 'pending',
      description: 'Local web interface for Prusa printers',
      comingSoon: true
    },
    {
      id: 'klipper-001',
      name: 'Klipper',
      type: 'printer_control',
      status: 'pending',
      description: '3D printer firmware with advanced features and web control',
      comingSoon: true
    }
  ];

  // Request fresh plugin list when component mounts
  useEffect(() => {
    if (wsStatus === 'connected') {
      refreshStatus();
    }
  }, [wsStatus, refreshStatus]);

  // Update integrations based on UDC status
  useEffect(() => {
    if (!isAuthenticated) return;
    
    console.log('[SoftwareIntegrationsPage] Updating integrations with UDC status:', udcStatus);
    console.log('[SoftwareIntegrationsPage] Number of plugins from UDC:', udcStatus.plugins.length);
    console.log('[SoftwareIntegrationsPage] Plugin IDs from UDC:', udcStatus.plugins.map(p => p.id));
    
    // Start with UDC integrations
    const udcIntegrations = UDC_INTEGRATIONS.map(integration => {
      // Check if this plugin is active in UDC
      const plugin = udcStatus.plugins.find(p => p.id === integration.pluginId);
      if (plugin) {
        // Map UDC plugin state to frontend status
        // UDC sends 'state' not 'status', with values: 'started', 'stopped'
        let status = 'configured';
        if (plugin.state === 'started') {
          status = 'active';
        }
        return {
          ...integration,
          status
        };
      }
      return integration;
    });
    
    // Combine all integrations
    setIntegrations([...udcIntegrations, ...COMING_SOON_SOFTWARE]);
    setIsLoading(false);
  }, [isAuthenticated, udcStatus]);

  // Filter integrations based on active tab
  const getFilteredIntegrations = () => {
    let filtered = integrations;
    
    // Filter by tab
    switch (activeTab) {
      case 'active':
        filtered = integrations.filter(i => i.isUDCPlugin && i.status === 'active');
        break;
      case 'configured':
        filtered = integrations.filter(i => i.isUDCPlugin && i.status === 'configured');
        break;
      case 'coming-soon':
        filtered = integrations.filter(i => i.comingSoon);
        break;
    }
    
    // Apply additional filters
    if (filterStatus !== 'all') {
      filtered = filtered.filter(i => i.status === filterStatus);
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(i => i.type === filterType);
    }
    
    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  };

  const filteredIntegrations = getFilteredIntegrations();

  // Show all integrations (no pagination for now)
  const paginatedIntegrations = filteredIntegrations;

  const handleAddIntegration = async () => {
    // TODO: Implement API call to add integration
    console.log('Adding integration:', newIntegration);
    setShowAddModal(false);
    setNewIntegration({
      name: '',
      type: 'other',
      description: '',
      endpoint: '',
      apiKey: '',
      username: '',
    });
  };

  const getStatusIcon = (status: SoftwareIntegration['status']) => {
    switch (status) {
      case 'active':
        return <div className="status-indicator active" />;
      case 'configured':
        return <div className="status-indicator configured" />;
      case 'error':
        return <div className="status-indicator error" />;
      case 'pending':
        return <div className="status-indicator pending" />;
      default:
        return <div className="status-indicator configured" />;
    }
  };

  const handleLaunchSoftware = (integration: SoftwareIntegration) => {
    if (integration.isUDCPlugin && integration.pluginId) {
      sendCommand(integration.pluginId, 'launch');
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'active':
        return integrations.filter(i => i.isUDCPlugin && i.status === 'active').length;
      case 'configured':
        return integrations.filter(i => i.isUDCPlugin && i.status === 'configured').length;
      case 'coming-soon':
        return integrations.filter(i => i.comingSoon).length;
      default:
        return 0;
    }
  };

  if (!isAuthenticated) {
    return <div className="software-integrations-page">Please log in to view software integrations.</div>;
  }

  return (
    <div className="software-integrations-page">
      <div className="page-header">
        <h1>Software Integrations</h1>
        <div className="header-actions">
          <div className="udc-status">
            <FaDesktop />
            <span className={`status-text ${udcStatus.connected ? 'connected' : 'disconnected'}`}>
              UDC {udcStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button onClick={() => setShowAddModal(true)} className="add-button">
            <FaPlus /> Add Integration
          </button>
          <div className="view-controls">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              {Object.entries(SOFTWARE_TYPES).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="name">Sort by Name</option>
              <option value="type">Sort by Type</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs for categories */}
      <div className="category-tabs">
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <FaCheck /> Active ({getTabCount('active')})
        </button>
        <button
          className={`tab-button ${activeTab === 'configured' ? 'active' : ''}`}
          onClick={() => setActiveTab('configured')}
        >
          <FaExclamationTriangle /> Configured ({getTabCount('configured')})
        </button>
        <button
          className={`tab-button ${activeTab === 'coming-soon' ? 'active' : ''}`}
          onClick={() => setActiveTab('coming-soon')}
        >
          <FaClock /> Coming Soon ({getTabCount('coming-soon')})
        </button>
      </div>

      <div className="integrations-grid">
        {isLoading ? (
          <div className="loading-message">Loading integrations...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="empty-state">
            <FaCode className="empty-icon" />
            <h3>
              {activeTab === 'active' ? 'No Active Software' : 
               activeTab === 'configured' ? 'No Configured Software' :
               'No Software Matches Your Filters'}
            </h3>
            <p>
              {activeTab === 'active' ? 'Launch the Universal Desktop Controller to activate software' :
               activeTab === 'configured' ? 'Configure software in the UDC to see it here' :
               'Try adjusting your filters or check another tab'}
            </p>
          </div>
        ) : (
          paginatedIntegrations.map((integration, index) => {
            const Icon = SOFTWARE_TYPES[integration.type]?.icon || FaCode;
            const isClickable = integration.isUDCPlugin && integration.status === 'active';
            
            return (
              <div
                key={integration.id}
                className={`integration-card ${integration.status} ${integration.comingSoon ? 'coming-soon' : ''} ${isClickable ? 'clickable' : ''}`}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                {getStatusIcon(integration.status)}
                <div className="integration-icon">
                  <Icon />
                </div>
                <h3>{integration.name}</h3>
                <p className="integration-type">{SOFTWARE_TYPES[integration.type]?.label}</p>
                <p className="integration-description">{integration.description}</p>
                {integration.comingSoon ? (
                  <p className="coming-soon-label">Coming Soon</p>
                ) : integration.isUDCPlugin && integration.status === 'active' ? (
                  <>
                    <div className="quick-actions">
                      {integration.pluginId === 'arduino-ide' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open IDE"
                          >
                            <FaDesktop /> IDE
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'startSerial', { baudRate: 9600 });
                            }}
                            title="Serial Monitor"
                          >
                            <FaCode /> Serial
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfigureIntegration(integration);
                              setShowConfigureModal(true);
                            }}
                            title="Configure"
                          >
                            <FaCog /> Config
                          </button>
                        </>
                      ) : integration.pluginId === 'unified-slicer' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open Slicer"
                          >
                            <FaCube /> Slice
                          </button>
                        </>
                      ) : integration.pluginId === 'kicad' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open KiCad"
                          >
                            <FaDesktop /> KiCad
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'openSchematic');
                            }}
                            title="Schematic Editor"
                          >
                            <FaMicrochip /> Schematic
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'openPCB');
                            }}
                            title="PCB Editor"
                          >
                            <FaMicrochip /> PCB
                          </button>
                        </>
                      ) : integration.pluginId === 'matlab' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open MATLAB"
                          >
                            <FaCalculator /> MATLAB
                          </button>
                        </>
                      ) : integration.pluginId === 'labview' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open LabVIEW"
                          >
                            <FaChartLine /> LabVIEW
                          </button>
                        </>
                      ) : integration.pluginId === 'node-red' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'start');
                            }}
                            title="Start Node-RED"
                          >
                            <FaProjectDiagram /> Start
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'openEditor');
                            }}
                            title="Open Editor"
                          >
                            <FaCode /> Editor
                          </button>
                        </>
                      ) : integration.pluginId === 'openscad' ? (
                        <>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchSoftware(integration);
                            }}
                            title="Open OpenSCAD"
                          >
                            <FaCube /> OpenSCAD
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'newFile', { template: 'parametric_box' });
                            }}
                            title="New Model"
                          >
                            <FaPlus /> New
                          </button>
                          <button 
                            className="quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendCommand(integration.pluginId, 'getExamples');
                            }}
                            title="Examples"
                          >
                            <FaFolder /> Examples
                          </button>
                        </>
                      ) : (
                        <button 
                          className="quick-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchSoftware(integration);
                          }}
                          title="Launch"
                        >
                          <FaDesktop /> Launch
                        </button>
                      )}
                    </div>
                    <button 
                      className="full-control-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onNavigateToDetail) {
                          onNavigateToDetail(integration.id);
                        }
                      }}
                    >
                      Full Control →
                    </button>
                  </>
                ) : integration.isUDCPlugin ? (
                  <p className="udc-label">UDC Plugin (Offline)</p>
                ) : (
                  integration.lastSync && (
                    <p className="last-sync">Last sync: {new Date(integration.lastSync).toLocaleString()}</p>
                  )
                )}
              </div>
            );
          })
        )}
      </div>


      {showConfigureModal && configureIntegration && (
        <div className="modal-overlay" onClick={() => setShowConfigureModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Configure {configureIntegration.name}</h2>
              <button onClick={() => setShowConfigureModal(false)} className="close-button">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Board Type</label>
                <select
                  value={pluginConfig.board}
                  onChange={(e) => setPluginConfig({ ...pluginConfig, board: e.target.value })}
                >
                  <option value="arduino:avr:uno">Arduino Uno</option>
                  <option value="arduino:avr:mega">Arduino Mega</option>
                  <option value="arduino:avr:nano">Arduino Nano</option>
                  <option value="arduino:avr:leonardo">Arduino Leonardo</option>
                  <option value="arduino:samd:mkr1000">Arduino MKR1000</option>
                  <option value="arduino:samd:mkrzero">Arduino MKR Zero</option>
                  <option value="esp8266:esp8266:nodemcuv2">NodeMCU v2</option>
                  <option value="esp32:esp32:esp32">ESP32</option>
                </select>
              </div>
              <div className="form-group">
                <label>Serial Port</label>
                <select
                  value={pluginConfig.port}
                  onChange={(e) => setPluginConfig({ ...pluginConfig, port: e.target.value })}
                >
                  <option value="">Auto-detect</option>
                  <option value="/dev/tty.usbmodem14101">USB Serial Port</option>
                  <option value="/dev/tty.usbserial-0001">USB-Serial Adapter</option>
                  <option value="COM3">COM3</option>
                  <option value="COM4">COM4</option>
                </select>
              </div>
              <div className="form-group">
                <label>Baud Rate</label>
                <select
                  value={pluginConfig.baudRate}
                  onChange={(e) => setPluginConfig({ ...pluginConfig, baudRate: parseInt(e.target.value) })}
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                  <option value="230400">230400</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sketches Folder</label>
                <input
                  type="text"
                  value={pluginConfig.sketchesPath}
                  onChange={(e) => setPluginConfig({ ...pluginConfig, sketchesPath: e.target.value })}
                  placeholder="~/Documents/Arduino"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowConfigureModal(false)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={() => {
                  sendCommand(configureIntegration.pluginId!, 'updateConfig', pluginConfig);
                  setShowConfigureModal(false);
                }} 
                className="save-button"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Software Integration</h2>
              <button onClick={() => setShowAddModal(false)} className="close-button">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                  placeholder="e.g., GitHub API"
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={newIntegration.type}
                  onChange={(e) => setNewIntegration({ ...newIntegration, type: e.target.value as keyof typeof SOFTWARE_TYPES })}
                >
                  {Object.entries(SOFTWARE_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newIntegration.description}
                  onChange={(e) => setNewIntegration({ ...newIntegration, description: e.target.value })}
                  placeholder="Brief description of this integration"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Endpoint URL (optional)</label>
                <input
                  type="text"
                  value={newIntegration.endpoint}
                  onChange={(e) => setNewIntegration({ ...newIntegration, endpoint: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div className="form-group">
                <label>API Key (optional)</label>
                <input
                  type="password"
                  value={newIntegration.apiKey}
                  onChange={(e) => setNewIntegration({ ...newIntegration, apiKey: e.target.value })}
                  placeholder="Your API key"
                />
              </div>
              <div className="form-group">
                <label>Username (optional)</label>
                <input
                  type="text"
                  value={newIntegration.username}
                  onChange={(e) => setNewIntegration({ ...newIntegration, username: e.target.value })}
                  placeholder="Username if required"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleAddIntegration} className="save-button">
                Add Integration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoftwareIntegrationsPage;