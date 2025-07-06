// src/pages/MachinesPage.tsx
import React from 'react';
import { FaCog, FaCircle, FaWrench, FaChartBar, FaExclamationTriangle, FaClock } from 'react-icons/fa';

// Individual machine status widget
const MachineStatusWidget: React.FC<{ machine: any }> = ({ machine }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-gray-400';
      case 'busy': return 'text-yellow-500';
      case 'maintenance': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{machine.name}</h3>
        <FaCircle className={`${getStatusColor(machine.status)}`} />
      </div>
      
      <div className="flex-grow">
        <p className="text-sm text-gray-600 mb-2">{machine.type}</p>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status:</span>
            <span className={`font-medium ${getStatusColor(machine.status)}`}>
              {machine.status.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">IP:</span>
            <span className="font-mono">{machine.ip}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Jobs:</span>
            <span>{machine.totalJobs}</span>
          </div>
          
          {machine.currentJob && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-600 truncate">{machine.currentJob.name}</p>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${machine.currentJob.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{machine.currentJob.progress}% - ETA: {machine.currentJob.estimatedEnd}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
        Control Panel
      </button>
    </div>
  );
};

// Overview widget
const MachineOverviewWidget: React.FC = () => {
  const stats = {
    total: 6,
    online: 3,
    busy: 2,
    offline: 1,
    maintenance: 0
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <FaChartBar className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">Overview</h3>
      </div>
      
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-sm text-gray-600">Total Machines</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xl font-semibold text-green-600">{stats.online}</p>
            <p className="text-xs text-green-700">Online</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-xl font-semibold text-yellow-600">{stats.busy}</p>
            <p className="text-xs text-yellow-700">Busy</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xl font-semibold text-gray-600">{stats.offline}</p>
            <p className="text-xs text-gray-700">Offline</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xl font-semibold text-red-600">{stats.maintenance}</p>
            <p className="text-xs text-red-700">Maintenance</p>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Utilization Rate</span>
            <span className="font-medium">67%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: '67%' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Maintenance widget
const MaintenanceWidget: React.FC = () => {
  const upcoming = [
    { machine: 'Prusa MK3S+', date: '2024-02-01', type: 'Regular' },
    { machine: 'Shapeoko 4', date: '2024-02-05', type: 'Belt Check' },
    { machine: 'Form 3', date: '2024-02-10', type: 'Resin Tank' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <FaWrench className="text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-800">Maintenance Schedule</h3>
      </div>
      
      <div className="space-y-3">
        {upcoming.map((item, index) => (
          <div key={index} className="p-3 bg-orange-50 rounded-lg">
            <p className="font-medium text-sm text-gray-800">{item.machine}</p>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{item.type}</span>
              <span>{new Date(item.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
      
      <button className="mt-4 w-full py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm">
        Schedule Maintenance
      </button>
    </div>
  );
};

// Alerts widget
const AlertsWidget: React.FC = () => {
  const alerts = [
    { id: 1, machine: 'CNC Mill', message: 'High vibration detected', level: 'warning' },
    { id: 2, machine: 'Laser Cutter', message: 'Filter replacement due', level: 'info' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <FaExclamationTriangle className="text-yellow-600" />
        <h3 className="text-lg font-semibold text-gray-800">Active Alerts</h3>
      </div>
      
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className={`p-3 rounded-lg ${
            alert.level === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
          }`}>
            <p className="font-medium text-sm text-gray-800">{alert.machine}</p>
            <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Performance widget
const PerformanceWidget: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <FaClock className="text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-800">Today's Performance</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Jobs Completed</span>
            <span className="font-medium">12 / 15</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '80%' }} />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Uptime</span>
            <span className="font-medium">94%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full" style={{ width: '94%' }} />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Efficiency</span>
            <span className="font-medium">87%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const MachinesPage: React.FC = () => {
  // Mock data
  const machines = [
    {
      id: '1',
      name: 'Prusa MK3S+',
      type: '3D Printer',
      status: 'busy',
      ip: '192.168.1.101',
      totalJobs: 342,
      currentJob: {
        name: 'Widget Assembly v2',
        progress: 67,
        estimatedEnd: '4:12 PM'
      }
    },
    {
      id: '2',
      name: 'Ender 3 Pro',
      type: '3D Printer',
      status: 'online',
      ip: '192.168.1.102',
      totalJobs: 128
    },
    {
      id: '3',
      name: 'Shapeoko 4',
      type: 'CNC Mill',
      status: 'offline',
      ip: '192.168.1.103',
      totalJobs: 89
    },
    {
      id: '4',
      name: 'Glowforge Pro',
      type: 'Laser Cutter',
      status: 'busy',
      ip: '192.168.1.104',
      totalJobs: 567,
      currentJob: {
        name: 'Acrylic Panel Cut',
        progress: 45,
        estimatedEnd: '3:30 PM'
      }
    },
    {
      id: '5',
      name: 'Form 3',
      type: 'SLA Printer',
      status: 'online',
      ip: '192.168.1.105',
      totalJobs: 234
    },
    {
      id: '6',
      name: 'Ultimaker S5',
      type: '3D Printer',
      status: 'online',
      ip: '192.168.1.106',
      totalJobs: 456
    }
  ];

  return (
    <div className="h-full bg-gray-100 overflow-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FaCog className="text-blue-600" />
          Workshop Machines
        </h1>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
          {/* Overview spans 2 columns on larger screens */}
          <div className="md:col-span-2 lg:col-span-1">
            <MachineOverviewWidget />
          </div>
          
          {/* Performance widget */}
          <div>
            <PerformanceWidget />
          </div>
          
          {/* Maintenance widget */}
          <div>
            <MaintenanceWidget />
          </div>
          
          {/* Alerts widget */}
          <div>
            <AlertsWidget />
          </div>
          
          {/* Individual machine widgets */}
          {machines.map((machine) => (
            <div key={machine.id}>
              <MachineStatusWidget machine={machine} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MachinesPage;