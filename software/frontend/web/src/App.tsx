import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Gauge,
  Home,
  Terminal,
  Mic,
  MicOff,
  Settings,
  Plus,
  X,
  Filter,
  Grid,
  List,
  FolderOpen,
  ThermometerSun,
  Move,
  Camera,
  Volume2,
  Activity,
  Wifi,
  AlertCircle,
  CheckCircle,
  Clock,
  Battery,
  Power,
  Box,
  Wrench,
} from 'lucide-react';

// Types
interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  current_job?: string;
}

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'motion' | 'camera' | 'sound' | 'humidity' | 'pressure';
  status: 'active' | 'inactive' | 'error';
  value?: number | string;
  unit?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'planning' | 'paused';
  progress: number;
  equipment: string[];
  createdAt: string;
  updatedAt: string;
}

// Voice Circle Component
const VoiceCircle: React.FC<{
  isListening: boolean;
  onCommand: (command: string) => void;
}> = ({ isListening, onCommand }) => {
  const [commandText, setCommandText] = useState('');
  
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Voice visualization circle */}
      <div className="relative">
        <div className={`w-32 h-32 border-4 ${
          isListening ? 'border-black bg-gray-100' : 'border-gray-400 bg-white'
        } flex items-center justify-center transition-all duration-300`}>
          <div className="z-10">
            {isListening ? (
              <MicOff className="w-10 h-10 text-red-600" />
            ) : (
              <Mic className="w-10 h-10 text-black" />
            )}
          </div>
        </div>
        
        {/* Status indicator */}
        <div className={`absolute -bottom-2 -right-2 w-4 h-4 ${
          isListening ? 'bg-red-600' : 'bg-gray-400'
        }`} />
      </div>
      
      {/* Voice status */}
      <div className="text-center">
        <h2 className="text-xl font-bold uppercase tracking-wider mb-1">
          {isListening ? 'LISTENING' : 'VOICE CONTROL'}
        </h2>
        <p className="text-gray-600 text-sm">
          {isListening ? 'Speak your command' : 'Click mic or type below'}
        </p>
      </div>
      
      {/* Command input */}
      <div className="w-full max-w-sm">
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
          className="w-full bg-white border-2 border-black text-black px-4 py-2 text-center
                   focus:outline-none focus:bg-gray-50 uppercase font-medium"
          placeholder="TYPE COMMAND..."
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
      case 'machines': return <Wrench className="w-4 h-4" />;
      case 'sensors': return <Gauge className="w-4 h-4" />;
      case 'projects': return <Box className="w-4 h-4" />;
    }
  };
  
  const getStatusColor = (item: any) => {
    if (type === 'machines' || type === 'sensors') {
      switch (item.status) {
        case 'online':
        case 'active': return 'bg-black text-white';
        case 'offline':
        case 'inactive': return 'bg-gray-300 text-gray-600';
        case 'busy': return 'bg-yellow-400 text-black';
        case 'error': return 'bg-red-600 text-white';
        default: return 'bg-gray-400 text-white';
      }
    }
    return 'bg-black text-white';
  };
  
  return (
    <div className="border-2 border-black bg-white h-full flex flex-col">
      <div className="border-b-2 border-black px-3 py-2 flex items-center justify-between bg-gray-100">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-bold text-sm uppercase tracking-wider">{title}</span>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="space-y-2 flex-1">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="border border-black p-2 flex items-center justify-between">
              <span className="text-sm font-medium truncate flex-1">{item.name}</span>
              <span className={`text-xs px-2 py-0.5 font-bold ${getStatusColor(item)}`}>
                {item.status?.toUpperCase() || 'ACTIVE'}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onViewAll}
          className="mt-3 w-full bg-black text-white py-2 font-bold text-xs hover:bg-gray-800 transition-colors"
        >
          VIEW ALL →
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
  const getIcon = () => {
    if (type === 'sensor') {
      const sensor = item as Sensor;
      switch (sensor.type) {
        case 'temperature': return <ThermometerSun className="w-8 h-8" />;
        case 'motion': return <Move className="w-8 h-8" />;
        case 'camera': return <Camera className="w-8 h-8" />;
        case 'sound': return <Volume2 className="w-8 h-8" />;
        default: return <Gauge className="w-8 h-8" />;
      }
    }
    return <Cpu className="w-8 h-8" />;
  };
  
  const getStatusStyle = () => {
    switch (item.status) {
      case 'online':
      case 'active': return 'border-black bg-gray-100';
      case 'error': return 'border-red-600 bg-red-50';
      case 'busy': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };
  
  return (
    <div 
      onClick={onClick}
      className={`border-2 bg-white cursor-pointer hover:shadow-lg transition-shadow ${getStatusStyle()}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-sm uppercase tracking-wide truncate flex-1">
            {item.name}
          </h3>
          <div className={`text-xs font-bold px-2 py-1 ${
            item.status === 'online' || item.status === 'active' ? 'bg-black text-white' : 
            item.status === 'error' ? 'bg-red-600 text-white' : 'bg-gray-400 text-white'
          }`}>
            {item.status.toUpperCase()}
          </div>
        </div>
        
        {/* Icon */}
        <div className="flex items-center justify-center h-20 mb-3">
          <div className="text-black">
            {getIcon()}
          </div>
        </div>
        
        {/* Additional info */}
        <div className="text-xs font-medium text-gray-600">
          {type === 'sensor' && (item as Sensor).value !== undefined && (
            <div>VALUE: {(item as Sensor).value} {(item as Sensor).unit}</div>
          )}
          {type === 'machine' && (item as Equipment).current_job && (
            <div>JOB: {(item as Equipment).current_job}</div>
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
    className="border-2 border-dashed border-gray-400 bg-gray-50 cursor-pointer hover:border-black hover:bg-gray-100 transition-all flex items-center justify-center h-full min-h-[200px]"
  >
    <div className="text-center">
      <Plus className="w-10 h-10 text-gray-600 mx-auto mb-2" />
      <p className="text-gray-600 font-bold text-sm uppercase">
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
  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-black">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4" />
        <span className="font-bold text-sm uppercase">Filter:</span>
      </div>
      <div className="flex gap-1">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`px-3 py-1 text-xs font-bold border-2 transition-all ${
              activeFilter === filter
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-400 hover:border-black'
            }`}
          >
            {filter.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
    
    <div className="flex gap-1">
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 border-2 ${
          viewMode === 'grid' 
            ? 'bg-black text-white border-black' 
            : 'bg-white text-black border-gray-400 hover:border-black'
        }`}
      >
        <Grid className="w-3 h-3" />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 border-2 ${
          viewMode === 'list' 
            ? 'bg-black text-white border-black' 
            : 'bg-white text-black border-gray-400 hover:border-black'
        }`}
      >
        <List className="w-3 h-3" />
      </button>
    </div>
  </div>
);

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
  
  const [isListening, setIsListening] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const handleCommand = (command: string) => {
    console.log('Voice command:', command);
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
    { id: 'machines', label: 'MACHINES', icon: Wrench },
    { id: 'sensors', label: 'SENSORS', icon: Gauge },
    { id: 'projects', label: 'PROJECTS', icon: Box },
  ];
  
  return (
    <div className="h-screen bg-gray-100 text-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b-4 border-black bg-white">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-6 h-6" />
                W.I.T. TERMINAL
              </h1>
              
              <nav className="flex gap-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentPage(tab.id as any)}
                    className={`px-4 py-2 text-sm font-bold border-2 transition-all flex items-center gap-2 ${
                      currentPage === tab.id
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black border-transparent hover:border-black'
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
      
      {/* Main Content - Fixed height container */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          {/* Home Page */}
          {currentPage === 'home' && (
            <div className="h-full grid grid-cols-12 gap-4">
              {/* Left Widget - Projects */}
              <div className="col-span-3 h-full">
                <StatusWidget
                  title="PROJECTS"
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
              <div className="col-span-3 h-full">
                <StatusWidget
                  title="MACHINES"
                  type="machines"
                  items={machines}
                  onViewAll={() => setCurrentPage('machines')}
                />
              </div>
            </div>
          )}
          
          {/* Machines Page */}
          {currentPage === 'machines' && (
            <div className="h-full flex flex-col">
              <FilterBar
                filters={['ALL', '3D_PRINTER', 'CNC_MACHINE', 'LASER', 'CUTTER']}
                activeFilter={filter}
                onFilterChange={setFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
              
              <div className="flex-1 overflow-auto">
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-3 gap-4' : 'grid-cols-1 gap-2'}`}>
                  {getFilteredMachines().map((machine) => (
                    <ItemCard
                      key={machine.id}
                      item={machine}
                      type="machine"
                      onClick={() => console.log('View machine:', machine)}
                    />
                  ))}
                  <AddItemCard
                    type="machine"
                    onClick={() => console.log('Add new machine')}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Sensors Page */}
          {currentPage === 'sensors' && (
            <div className="h-full flex flex-col">
              <FilterBar
                filters={['ALL', 'temperature', 'motion', 'camera', 'sound', 'humidity']}
                activeFilter={filter}
                onFilterChange={setFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
              
              <div className="flex-1 overflow-auto">
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-3 gap-4' : 'grid-cols-1 gap-2'}`}>
                  {getFilteredSensors().map((sensor) => (
                    <ItemCard
                      key={sensor.id}
                      item={sensor}
                      type="sensor"
                      onClick={() => console.log('View sensor:', sensor)}
                    />
                  ))}
                  <AddItemCard
                    type="sensor"
                    onClick={() => console.log('Add new sensor')}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Projects Page */}
          {currentPage === 'projects' && (
            <div className="h-full overflow-auto">
              <div className="grid grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div key={project.id} className="border-2 border-black bg-white">
                    <div className="p-4">
                      <h3 className="font-bold uppercase mb-2">{project.name}</h3>
                      <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">STATUS:</span>
                          <span className="font-bold">{project.status.toUpperCase()}</span>
                        </div>
                        <div className="w-full bg-gray-200 h-4 border border-black">
                          <div 
                            className="bg-black h-full transition-all duration-500"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <div className="text-xs font-medium text-gray-600">
                          PROGRESS: {project.progress}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;