import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes, FaCode, FaCloud, FaDatabase, FaRobot, FaCubes, FaChartLine, FaMicrochip, FaCube, FaPrint } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import './SoftwareIntegrationsPage.css';

const API_BASE_URL = 'http://localhost:8000';

// Interface for software integrations
interface SoftwareIntegration {
  id: string;
  name: string;
  type: 'cad' | 'simulation' | 'embedded' | 'pcb' | 'data_acquisition' | 'manufacturing' | 'api' | 'database' | 'cloud' | 'ai' | 'other';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  description: string;
  endpoint?: string;
  apiKey?: string;
  username?: string;
  lastSync?: string;
  config?: Record<string, any>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  comingSoon?: boolean;
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
  'api': { label: 'API', icon: FaCode },
  'database': { label: 'Database', icon: FaDatabase },
  'cloud': { label: 'Cloud Service', icon: FaCloud },
  'ai': { label: 'AI Service', icon: FaRobot },
  'other': { label: 'Other', icon: FaCode },
};

const SOFTWARE_STATUS = {
  'connected': { label: 'Connected', color: 'bg-green-500' },
  'disconnected': { label: 'Disconnected', color: 'bg-gray-500' },
  'error': { label: 'Error', color: 'bg-red-500' },
  'pending': { label: 'Pending', color: 'bg-yellow-500' },
};

const SoftwareIntegrationsPage: React.FC<SoftwareIntegrationsPageProps> = ({ onNavigateToDetail }) => {
  const { isAuthenticated, tokens } = useAuth();
  const [integrations, setIntegrations] = useState<SoftwareIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [activeTab, setActiveTab] = useState('all');
  
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    type: 'api' as keyof typeof SOFTWARE_TYPES,
    description: '',
    endpoint: '',
    apiKey: '',
    username: '',
  });

  // Predefined software integrations
  const PREDEFINED_SOFTWARE: SoftwareIntegration[] = [
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
      id: 'fusion360-001',
      name: 'Autodesk Fusion 360',
      type: 'cad',
      status: 'pending',
      description: 'Cloud-based CAD/CAM/CAE platform',
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
    {
      id: 'freecad-001',
      name: 'FreeCAD',
      type: 'cad',
      status: 'pending',
      description: 'Open-source parametric 3D modeler',
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
      id: 'arduino-001',
      name: 'Arduino IDE',
      type: 'embedded',
      status: 'pending',
      description: 'Programming environment for Arduino microcontrollers',
      comingSoon: true
    },
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
      id: 'kicad-001',
      name: 'KiCad',
      type: 'pcb',
      status: 'pending',
      description: 'Open-source electronics design automation',
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
      id: 'labview-001',
      name: 'LabVIEW',
      type: 'data_acquisition',
      status: 'pending',
      description: 'Graphical programming for measurement systems',
      comingSoon: true
    },
    {
      id: 'matlab-001',
      name: 'MATLAB',
      type: 'data_acquisition',
      status: 'pending',
      description: 'Technical computing and data analysis',
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
    
    // 3D Slicers
    {
      id: 'prusaslicer-001',
      name: 'PrusaSlicer',
      type: 'slicer',
      status: 'connected',
      description: 'Advanced open-source slicer with excellent Prusa printer support',
      comingSoon: false
    },
    {
      id: 'cura-001',
      name: 'Ultimaker Cura',
      type: 'slicer',
      status: 'connected',
      description: 'Popular open-source slicer with wide printer compatibility',
      comingSoon: false
    },
    {
      id: 'bambustudio-001',
      name: 'Bambu Studio',
      type: 'slicer',
      status: 'connected',
      description: 'Optimized slicer for Bambu Lab printers with cloud features',
      comingSoon: false
    },
    {
      id: 'superslicer-001',
      name: 'SuperSlicer',
      type: 'slicer',
      status: 'pending',
      description: 'PrusaSlicer fork with additional features and calibration tools',
      comingSoon: true
    },
    {
      id: 'orcaslicer-001',
      name: 'OrcaSlicer',
      type: 'slicer',
      status: 'pending',
      description: 'Bambu Studio fork with enhanced features and UI improvements',
      comingSoon: true
    },
    {
      id: 'simplify3d-001',
      name: 'Simplify3D',
      type: 'slicer',
      status: 'pending',
      description: 'Professional slicer with advanced support generation',
      comingSoon: true
    },
    {
      id: 'ideamaker-001',
      name: 'ideaMaker',
      type: 'slicer',
      status: 'pending',
      description: 'Feature-rich slicer by Raise3D',
      comingSoon: true
    },
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
      status: 'connected',
      description: 'Web-based 3D printer control with extensive plugin ecosystem',
      comingSoon: false
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
      status: 'connected',
      description: 'Local web interface for Prusa printers',
      comingSoon: false
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

  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIntegration, setDraggedIntegration] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Fetch integrations from API
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // For now, we'll show predefined software and any user-added integrations
    setIsLoading(false);
    // Combine predefined software with user integrations (empty for now)
    setIntegrations([...PREDEFINED_SOFTWARE]);
  }, [isAuthenticated]);

  // Calculate grid size
  useEffect(() => {
    const updateGridSize = () => {
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        setGridSize({
          cellWidth: rect.width / gridCols,
          cellHeight: rect.height / gridRows
        });
      }
    };

    updateGridSize();
    window.addEventListener('resize', updateGridSize);
    return () => window.removeEventListener('resize', updateGridSize);
  }, [gridCols, gridRows]);

  // Filter and sort integrations
  const filteredIntegrations = integrations.filter(integration => {
    if (filterStatus !== 'all' && integration.status !== filterStatus) return false;
    if (activeTab !== 'all' && integration.type !== activeTab) return false;
    return true;
  }).sort((a, b) => {
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

  // Pagination
  const integrationsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(filteredIntegrations.length / integrationsPerPage);
  const paginatedIntegrations = filteredIntegrations.slice(
    (currentPage - 1) * integrationsPerPage,
    currentPage * integrationsPerPage
  );

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
      case 'connected':
        return <div className="status-indicator connected" />;
      case 'error':
        return <div className="status-indicator error" />;
      case 'pending':
        return <div className="status-indicator pending" />;
      default:
        return <div className="status-indicator disconnected" />;
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
          <button onClick={() => setShowAddModal(true)} className="add-button">
            <FaPlus /> Add Integration
          </button>
          <div className="view-controls">
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              {Object.entries(SOFTWARE_STATUS).map(([key, value]) => (
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
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
        >
          All ({integrations.length})
        </button>
        {Object.entries(SOFTWARE_TYPES).filter(([key]) => 
          ['cad', 'simulation', 'embedded', 'pcb', 'data_acquisition', 'manufacturing'].includes(key)
        ).map(([key, value]) => {
          const count = integrations.filter(i => i.type === key).length;
          return (
            <button
              key={key}
              className={`tab-button ${activeTab === key ? 'active' : ''}`}
              onClick={() => { setActiveTab(key); setCurrentPage(1); }}
            >
              {value.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="integrations-grid" ref={gridRef}>
        {isLoading ? (
          <div className="loading-message">Loading integrations...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="empty-state">
            <FaCode className="empty-icon" />
            <h3>No Software Integrations Match Your Filters</h3>
            <p>Try adjusting your filters or add a new integration</p>
          </div>
        ) : (
          paginatedIntegrations.map((integration, index) => {
            const Icon = SOFTWARE_TYPES[integration.type]?.icon || FaCode;
            return (
              <div
                key={integration.id}
                className={`integration-card ${integration.status} ${integration.comingSoon ? 'coming-soon' : ''}`}
                onClick={() => !integration.comingSoon && onNavigateToDetail?.(integration.id)}
                style={{ cursor: integration.comingSoon ? 'not-allowed' : 'pointer' }}
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

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <FaChevronLeft />
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <FaChevronRight />
          </button>
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