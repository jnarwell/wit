import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Power, AlertTriangle, Activity, Clock, 
  User, FolderOpen, MessageSquare, Home, Cpu, Terminal, 
  Search, Plus, X, ChevronRight, Zap, Database, Gauge,
  Settings, Filter, Grid, List, ChevronLeft, Wifi,
  ThermometerSun, Camera, Volume2, Move, Layers
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// Type Definitions
interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  current_job?: string;
  metrics?: {
    temperature?: number;
    uptime?: number;
    power?: number;
  };
  image?: string;
}

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'motion' | 'sound' | 'camera' | 'other';
  status: 'active' | 'inactive' | 'error';
  value?: number | string;
  unit?: string;
  lastReading?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'paused';
  progress: number;
  equipment: string[];
  createdAt: string;
  updatedAt: string;
}

interface Widget {
  id: string;
  type: 'machines' | 'sensors' | 'projects';
  position: 'left' | 'right';
  minimized: boolean;
}

// ASCII Art Voice Circle
const VoiceCircle: React.FC<{ 
  isListening: boolean; 
  onCommand: (command: string) => void;
}> = ({ isListening, onCommand }) => {
  const [pulseAnimation, setPulseAnimation] = useState(0);
  const [commandText, setCommandText] = useState('');
  
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setPulseAnimation(prev => (prev + 1) % 3);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isListening]);
  
  const pulseRings = ['○', '◎', '◉'];
  
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        {/* Pulse effect */}
        <div className={`absolute inset-0 flex items-center justify-center ${isListening ? 'animate-ping' : ''}`}>
          <div className="text-green-400 text-9xl opacity-20 font-mono">
            {pulseRings[pulseAnimation]}
          </div>
        </div>
        
        {/* Main circle */}
        <div className="relative w-64 h-64 border-4 border-green-400 rounded-full flex flex-col items-center justify-center bg-black shadow-retro">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-400 font-mono mb-2">W.I.T.</h1>
            <p className="text-sm text-green-400 font-mono">INTERACTIVE</p>
            <p className="text-sm text-green-400 font-mono">VOICE</p>
            <p className="text-sm text-green-400 font-mono">CIRCLE</p>
          </div>
          
          {/* Microphone indicator */}
          <div className="absolute bottom-4">
            {isListening ? (
              <MicOff className="w-6 h-6 text-red-500 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6 text-green-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* Command input */}
      <div className="w-full max-w-md">
        <input
          type="text"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value.toUpperCase())}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onCommand(commandText);
              setCommandText('');
            }
          }}
          className="w-full bg-black border-2 border-green-400 text-green-400 font-mono px-4 py-2 text-center
                   focus:outline-none focus:shadow-retro uppercase"
          placeholder="SPEAK OR TYPE COMMAND..."
        />
      </div>
    </div>
  );
};

// Widget Component for Home Page
const StatusWidget: React.FC<{
  title: string;
  type: 'machines' | 'sensors' | 'projects';
  items: any[];
  onViewAll: () => void;
}> = ({ title, type, items, onViewAll }) => {
  const getIcon = () => {
    switch (type) {
      case 'machines': return <Cpu className="w-4 h-4" />;
      case 'sensors': return <Gauge className="w-4 h-4" />;
      case 'projects': return <FolderOpen className="w-4 h-4" />;
    }
  };
  
  const getStatusColor = (item: any) => {
    if (type === 'machines' || type === 'sensors') {
      switch (item.status) {
        case 'online':
        case 'active': return 'text-green-400';
        case 'offline':
        case 'inactive': return 'text-gray-600';
        case 'busy': return 'text-yellow-400';
        case 'error': return 'text-red-500';
        default: return 'text-gray-400';
      }
    }
    return 'text-green-400';
  };
  
  return (
    <div className="terminal-container h-full">
      <div className="terminal-header">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="uppercase">{title}</span>
        </div>
        <div className="terminal-buttons">
          <div className="terminal-button"></div>
          <div className="terminal-button"></div>
          <div className="terminal-button"></div>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2 mb-4">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-gray-900 border border-gray-700">
              <span className="text-green-400 font-mono text-sm truncate">{item.name}</span>
              <span className={`font-mono text-xs ${getStatusColor(item)}`}>
                [{item.status?.toUpperCase() || 'ACTIVE'}]
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onViewAll}
          className="w-full retro-btn text-xs"
        >
          VIEW ALL {title} →
        </button>
      </div>
    </div>
  );
};

// Machine/Sensor Card Component
const ItemCard: React.FC<{
  item: Equipment | Sensor;
  type: 'machine' | 'sensor';
  onClick: () => void;
}> = ({ item, type, onClick }) => {
  const [graphData] = useState(() => 
    Array.from({ length: 20 }, () => Math.random() * 100)
  );
  
  const getIcon = () => {
    if (type === 'sensor') {
      const sensor = item as Sensor;
      switch (sensor.type) {
        case 'temperature': return <ThermometerSun className="w-6 h-6" />;
        case 'motion': return <Move className="w-6 h-6" />;
        case 'camera': return <Camera className="w-6 h-6" />;
        case 'sound': return <Volume2 className="w-6 h-6" />;
        default: return <Gauge className="w-6 h-6" />;
      }
    }
    return <Cpu className="w-6 h-6" />;
  };
  
  return (
    <div 
      onClick={onClick}
      className="terminal-container cursor-pointer hover:border-green-300 transition-all"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-green-400 font-mono font-bold text-sm uppercase truncate">
            {item.name}
          </h3>
          <div className={`text-xs font-mono ${
            item.status === 'online' || item.status === 'active' ? 'text-green-400' : 
            item.status === 'error' ? 'text-red-500' : 'text-gray-500'
          }`}>
            [{item.status.toUpperCase()}]
          </div>
        </div>
        
        {/* Graph visualization */}
        <div className="h-20 mb-3 border border-gray-700 bg-black p-2">
          <svg className="w-full h-full" viewBox="0 0 100 50">
            <polyline
              fill="none"
              stroke="#00ff00"
              strokeWidth="1"
              points={graphData.map((value, index) => 
                `${(index / (graphData.length - 1)) * 100},${50 - (value / 2)}`
              ).join(' ')}
            />
          </svg>
        </div>
        
        {/* Icon/Image placeholder */}
        <div className="flex items-center justify-center h-16 border border-gray-700 bg-gray-900">
          <div className="text-green-400">
            {getIcon()}
          </div>
        </div>
        
        {/* Additional info */}
        <div className="mt-2 text-xs font-mono text-gray-500">
          {type === 'sensor' && (item as Sensor).value !== undefined && (
            <span>VALUE: {(item as Sensor).value} {(item as Sensor).unit}</span>
          )}
          {type === 'machine' && (item as Equipment).current_job && (
            <span>JOB: {(item as Equipment).current_job}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Add New Item Card
const AddItemCard: React.FC<{
  type: 'machine' | 'sensor';
  onClick: () => void;
}> = ({ type, onClick }) => (
  <div 
    onClick={onClick}
    className="terminal-container cursor-pointer hover:border-green-300 transition-all flex items-center justify-center h-full"
  >
    <div className="text-center">
      <Plus className="w-12 h-12 text-green-400 mx-auto mb-2" />
      <p className="text-green-400 font-mono uppercase">
        ADD {type}
      </p>
    </div>
  </div>
);

// Filter Bar Component
const FilterBar: React.FC<{
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}> = ({ filters, activeFilter, onFilterChange, viewMode, onViewModeChange }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-green-400" />
        <span className="text-green-400 font-mono text-sm">FILTER:</span>
      </div>
      <div className="flex gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`px-3 py-1 font-mono text-xs border transition-all ${
              activeFilter === filter
                ? 'bg-green-400 text-black border-green-400'
                : 'bg-black text-green-400 border-gray-700 hover:border-green-400'
            }`}
          >
            {filter.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
    
    <div className="flex gap-2">
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 ${viewMode === 'grid' ? 'text-green-400' : 'text-gray-600'}`}
      >
        <Grid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 ${viewMode === 'list' ? 'text-green-400' : 'text-gray-600'}`}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// Detail View Modal
const DetailView: React.FC<{
  item: Equipment | Sensor | Project;
  type: 'machine' | 'sensor' | 'project';
  onClose: () => void;
}> = ({ item, type, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="terminal-container max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="terminal-header sticky top-0 z-10">
          <span className="uppercase">{item.name} - DETAIL VIEW</span>
          <button onClick={onClose} className="text-black hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Status and main info */}
            <div className="space-y-4">
              <div className="retro-panel">
                <h3 className="text-green-400 font-mono font-bold mb-3">STATUS</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-mono text-sm">STATE:</span>
                    <span className="text-green-400 font-mono text-sm">
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-mono text-sm">TYPE:</span>
                    <span className="text-green-400 font-mono text-sm">
                      {type.toUpperCase()}
                    </span>
                  </div>
                  {type === 'machine' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-mono text-sm">UPTIME:</span>
                        <span className="text-green-400 font-mono text-sm">
                          {Math.floor(Math.random() * 100)}H
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-mono text-sm">TEMPERATURE:</span>
                        <span className="text-green-400 font-mono text-sm">
                          {Math.floor(Math.random() * 50 + 20)}°C
                        </span>
                      </div>
                    </>
                  )}
                  {type === 'sensor' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-mono text-sm">CURRENT VALUE:</span>
                        <span className="text-green-400 font-mono text-sm">
                          {(item as Sensor).value} {(item as Sensor).unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-mono text-sm">LAST READING:</span>
                        <span className="text-green-400 font-mono text-sm">
                          {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Control buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button className="retro-btn text-sm">START</button>
                <button className="retro-btn-danger text-sm">STOP</button>
                <button className="retro-btn-secondary text-sm">CALIBRATE</button>
                <button className="retro-btn-secondary text-sm">SETTINGS</button>
              </div>
            </div>
            
            {/* Right column - Graphs and data */}
            <div className="space-y-4">
              <div className="retro-panel">
                <h3 className="text-green-400 font-mono font-bold mb-3">REAL-TIME DATA</h3>
                <div className="h-40 border border-gray-700 bg-black p-2">
                  <svg className="w-full h-full" viewBox="0 0 100 50">
                    <polyline
                      fill="none"
                      stroke="#00ff00"
                      strokeWidth="1"
                      points={Array.from({ length: 50 }, (_, i) => 
                        `${i * 2},${25 + Math.sin(i / 5) * 20}`
                      ).join(' ')}
                    />
                  </svg>
                </div>
              </div>
              
              <div className="retro-panel">
                <h3 className="text-green-400 font-mono font-bold mb-3">HISTORY</h3>
                <div className="space-y-1 text-xs font-mono">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="text-gray-500">
                      {new Date(Date.now() - i * 3600000).toLocaleString()} - OPERATION COMPLETED
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom section - Additional controls */}
          <div className="mt-6 retro-panel">
            <h3 className="text-green-400 font-mono font-bold mb-3">COMMANDS</h3>
            <div className="grid grid-cols-4 gap-2">
              {['STATUS', 'DIAGNOSTIC', 'MAINTENANCE', 'LOGS', 'EXPORT', 'SCHEDULE', 'ALERT', 'HELP'].map((cmd) => (
                <button key={cmd} className="retro-btn text-xs">
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'home' | 'machines' | 'sensors' | 'projects'>('home');
  const [machines, setMachines] = useState<Equipment[]>([
    { id: '1', name: 'PRUSA_MK3S', type: '3D_PRINTER', status: 'online' },
    { id: '2', name: 'CNC_ROUTER', type: 'CNC_MACHINE', status: 'offline' },
    { id: '3', name: 'LASER_CUTTER', type: 'LASER', status: 'busy', current_job: 'PANEL_CUT_42' },
    { id: '4', name: 'RESIN_PRINTER', type: 'RESIN_3D', status: 'online' },
    { id: '5', name: 'VINYL_CUTTER', type: 'CUTTER', status: 'online' },
  ]);
  
  const [sensors, setSensors] = useState<Sensor[]>([
    { id: '1', name: 'TEMP_SENSOR_01', type: 'temperature', status: 'active', value: 23.5, unit: '°C' },
    { id: '2', name: 'MOTION_DETECTOR', type: 'motion', status: 'active', value: 'NO_MOTION' },
    { id: '3', name: 'SOUND_LEVEL', type: 'sound', status: 'active', value: 45, unit: 'dB' },
    { id: '4', name: 'CAMERA_01', type: 'camera', status: 'inactive' },
    { id: '5', name: 'HUMIDITY_01', type: 'humidity', status: 'active', value: 65, unit: '%' },
  ]);
  
  const [projects, setProjects] = useState<Project[]>([
    { 
      id: '1', 
      name: 'KEYBOARD_BUILD', 
      description: 'Custom mechanical keyboard',
      status: 'active',
      progress: 65,
      equipment: ['1', '3'],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-15'
    },
    { 
      id: '2', 
      name: 'ROBOT_ARM', 
      description: 'Arduino robot arm project',
      status: 'planning',
      progress: 15,
      equipment: ['2'],
      createdAt: '2024-01-10',
      updatedAt: '2024-01-14'
    },
  ]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'machine' | 'sensor' | 'project' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const handleCommand = (command: string) => {
    console.log('Voice command:', command);
    // Process voice commands here
    if (command.includes('SHOW') && command.includes('MACHINES')) {
      setCurrentPage('machines');
    } else if (command.includes('SHOW') && command.includes('SENSORS')) {
      setCurrentPage('sensors');
    } else if (command.includes('HOME')) {
      setCurrentPage('home');
    }
  };
  
  const getFilteredMachines = () => {
    if (filter === 'ALL') return machines;
    return machines.filter(m => m.type === filter);
  };
  
  const getFilteredSensors = () => {
    if (filter === 'ALL') return sensors;
    return sensors.filter(s => s.type === filter);
  };
  
  const tabs = [
    { id: 'home', label: 'HOME', icon: Home },
    { id: 'machines', label: 'MACHINES', icon: Cpu },
    { id: 'sensors', label: 'SENSORS', icon: Gauge },
    { id: 'projects', label: 'PROJECTS', icon: FolderOpen },
  ];
  
  return (
    <div className="min-h-screen bg-black text-green-400">
      {/* Header with tabs */}
      <header className="border-b-2 border-green-400 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-mono font-bold flex items-center gap-2">
                <Terminal className="w-6 h-6" />
                W.I.T. TERMINAL
              </h1>
              
              <nav className="flex gap-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentPage(tab.id as any)}
                    className={`px-4 py-2 font-mono text-sm border transition-all flex items-center gap-2 ${
                      currentPage === tab.id
                        ? 'border-green-400 bg-green-400 text-black'
                        : 'border-transparent hover:border-green-400'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
            {/* Left Widget - Projects */}
            <div className="col-span-3">
              <StatusWidget
                title="PROJECT STATUS"
                type="projects"
                items={projects}
                onViewAll={() => setCurrentPage('projects')}
              />
            </div>
            
            {/* Center - Voice Circle */}
            <div className="col-span-6 flex items-center justify-center">
              <VoiceCircle
                isListening={isListening}
                onCommand={handleCommand}
              />
            </div>
            
            {/* Right Widget - Machines */}
            <div className="col-span-3">
              <StatusWidget
                title="MACHINE STATUS"
                type="machines"
                items={machines}
                onViewAll={() => setCurrentPage('machines')}
              />
            </div>
          </div>
        )}
        
        {/* Machines Page */}
        {currentPage === 'machines' && (
          <div>
            <FilterBar
              filters={['ALL', '3D_PRINTER', 'CNC_MACHINE', 'LASER', 'CUTTER']}
              activeFilter={filter}
              onFilterChange={setFilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            
            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
              {getFilteredMachines().map((machine) => (
                <ItemCard
                  key={machine.id}
                  item={machine}
                  type="machine"
                  onClick={() => {
                    setSelectedItem(machine);
                    setSelectedType('machine');
                  }}
                />
              ))}
              <AddItemCard
                type="machine"
                onClick={() => console.log('Add new machine')}
              />
            </div>
          </div>
        )}
        
        {/* Sensors Page */}
        {currentPage === 'sensors' && (
          <div>
            <FilterBar
              filters={['ALL', 'temperature', 'motion', 'camera', 'sound', 'humidity']}
              activeFilter={filter}
              onFilterChange={setFilter}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            
            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4`}>
              {getFilteredSensors().map((sensor) => (
                <ItemCard
                  key={sensor.id}
                  item={sensor}
                  type="sensor"
                  onClick={() => {
                    setSelectedItem(sensor);
                    setSelectedType('sensor');
                  }}
                />
              ))}
              <AddItemCard
                type="sensor"
                onClick={() => console.log('Add new sensor')}
              />
            </div>
          </div>
        )}
        
        {/* Projects Page */}
        {currentPage === 'projects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project.id} className="terminal-container cursor-pointer">
                <div className="p-4">
                  <h3 className="text-green-400 font-mono font-bold mb-2">{project.name}</h3>
                  <p className="text-gray-500 font-mono text-sm mb-3">{project.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-500">STATUS:</span>
                      <span className="text-green-400">{project.status.toUpperCase()}</span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 border border-gray-700">
                      <div 
                        className="bg-green-400 h-full"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono text-gray-500">
                      PROGRESS: {project.progress}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Detail View Modal */}
      {selectedItem && selectedType && (
        <DetailView
          item={selectedItem}
          type={selectedType}
          onClose={() => {
            setSelectedItem(null);
            setSelectedType(null);
          }}
        />
      )}
    </div>
  );
};

export default App;