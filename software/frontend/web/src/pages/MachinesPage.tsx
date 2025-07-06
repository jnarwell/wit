import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FaPlus, FaTimes, FaCog, FaWrench } from 'react-icons/fa';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'MAINTENANCE';
  job?: string;
  progress?: number;
  lastMaintenance?: string;
  totalJobs?: number;
}

interface MachineWidget {
  i: string;
  machineId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MachinesPage: React.FC = () => {
  const machines: Machine[] = [
    {
      id: '1',
      name: 'PRUSA MK3S',
      type: '3D Printer',
      status: 'ONLINE',
      lastMaintenance: '2024-01-15',
      totalJobs: 342,
    },
    {
      id: '2',
      name: 'CNC ROUTER',
      type: 'CNC Machine',
      status: 'OFFLINE',
      lastMaintenance: '2024-01-20',
      totalJobs: 128,
    },
    {
      id: '3',
      name: 'LASER CUTTER',
      type: 'Laser',
      status: 'BUSY',
      job: 'PANEL_CUT_42',
      progress: 67,
      lastMaintenance: '2024-01-10',
      totalJobs: 456,
    },
    {
      id: '4',
      name: 'RESIN PRINTER',
      type: '3D Printer',
      status: 'ONLINE',
      lastMaintenance: '2024-01-18',
      totalJobs: 89,
    },
    {
      id: '5',
      name: 'VINYL CUTTER',
      type: 'Cutter',
      status: 'ONLINE',
      lastMaintenance: '2024-01-22',
      totalJobs: 234,
    },
    {
      id: '6',
      name: 'FORM 3L',
      type: '3D Printer',
      status: 'MAINTENANCE',
      lastMaintenance: '2024-01-25',
      totalJobs: 156,
    },
  ];

  const [widgets, setWidgets] = useState<MachineWidget[]>(() => {
    const saved = localStorage.getItem('machinesLayout');
    if (saved) {
      return JSON.parse(saved);
    }
    return machines.map((machine, index) => ({
      i: `machine-${machine.id}`,
      machineId: machine.id,
      x: (index % 3) * 4,
      y: Math.floor(index / 3) * 6,
      w: 4,
      h: 6,
    }));
  });

  const saveLayout = (newWidgets: MachineWidget[]) => {
    localStorage.setItem('machinesLayout', JSON.stringify(newWidgets));
  };

  const onLayoutChange = (layout: Layout[]) => {
    const updatedWidgets = widgets.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.i);
      if (layoutItem) {
        return {
          ...widget,
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h,
        };
      }
      return widget;
    });
    setWidgets(updatedWidgets);
    saveLayout(updatedWidgets);
  };

  const removeWidget = (id: string) => {
    const newWidgets = widgets.filter(w => w.i !== id);
    setWidgets(newWidgets);
    saveLayout(newWidgets);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-green-100 text-green-800 border-green-300';
      case 'OFFLINE': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'BUSY': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'MAINTENANCE': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ONLINE': return '🟢';
      case 'OFFLINE': return '⚫';
      case 'BUSY': return '🟡';
      case 'MAINTENANCE': return '🔴';
      default: return '⚫';
    }
  };

  const renderMachineWidget = (widget: MachineWidget) => {
    const machine = machines.find(m => m.id === widget.machineId);
    if (!machine) return null;

    return (
      <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{machine.name}</h3>
              <p className="text-sm text-gray-600">{machine.type}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(machine.status)}`}>
                {getStatusIcon(machine.status)} {machine.status}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  removeWidget(widget.i);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {machine.status === 'BUSY' && machine.job && (
            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Current Job:</span>
                <span className="text-sm text-gray-600">{machine.job}</span>
              </div>
              {machine.progress && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${machine.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-2">
                <FaWrench className="text-gray-400" />
                Last Maintenance
              </span>
              <span className="text-gray-800">{machine.lastMaintenance}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-2">
                <FaCog className="text-gray-400" />
                Total Jobs
              </span>
              <span className="text-gray-800">{machine.totalJobs}</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-2 border-t border-gray-200">
          <button className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-sm">
            Control
          </button>
          <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-md hover:bg-gray-50 transition-colors text-sm">
            Details
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Machines Overview</h2>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: widgets }}
        onLayoutChange={onLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        isDraggable
        isResizable
        compactType={null}
        preventCollision
      >
        {widgets.map(widget => (
          <div key={widget.i}>
            {renderMachineWidget(widget)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default MachinesPage;