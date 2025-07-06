import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FaPlus } from 'react-icons/fa';
import MachineWidget from './widgets/MachineWidget';
import ProjectWidget from './widgets/ProjectWidget';
import VoiceControlWidget from './widgets/VoiceControlWidget';
import SensorWidget from './widgets/SensorWidget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Widget {
  i: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const Dashboard: React.FC = () => {
  const [widgets, setWidgets] = useState<Widget[]>([
    { i: 'machines', type: 'machines', x: 0, y: 0, w: 4, h: 6 },
    { i: 'projects', type: 'projects', x: 4, y: 0, w: 4, h: 6 },
    { i: 'voice', type: 'voice', x: 8, y: 0, w: 4, h: 6 },
    { i: 'sensors', type: 'sensors', x: 0, y: 6, w: 4, h: 6 },
  ]);

  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      setWidgets(JSON.parse(savedLayout));
    }
  }, []);

  const saveLayout = (newWidgets: Widget[]) => {
    localStorage.setItem('dashboardLayout', JSON.stringify(newWidgets));
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

  // Find next available position for new widget
  const findAvailablePosition = (width: number, height: number): { x: number; y: number } => {
    const cols = 12;
    const occupied = new Set<string>();
    
    // Mark all occupied cells
    widgets.forEach(widget => {
      for (let x = widget.x; x < widget.x + widget.w; x++) {
        for (let y = widget.y; y < widget.y + widget.h; y++) {
          occupied.add(`${x},${y}`);
        }
      }
    });

    // Find first available position that fits the widget
    for (let y = 0; y < 100; y++) { // Max 100 rows down
      for (let x = 0; x <= cols - width; x++) {
        let fits = true;
        
        // Check if widget fits at this position
        for (let wx = x; wx < x + width; wx++) {
          for (let wy = y; wy < y + height; wy++) {
            if (occupied.has(`${wx},${wy}`)) {
              fits = false;
              break;
            }
          }
          if (!fits) break;
        }
        
        if (fits) {
          return { x, y };
        }
      }
    }
    
    // If no space found, place at bottom
    const maxY = Math.max(0, ...widgets.map(w => w.y + w.h));
    return { x: 0, y: maxY };
  };

  const addWidget = (type: string) => {
    const position = findAvailablePosition(4, 6);
    const newWidget: Widget = {
      i: `${type}-${Date.now()}`,
      type,
      x: position.x,
      y: position.y,
      w: 4,
      h: 6,
    };
    const newWidgets = [...widgets, newWidget];
    setWidgets(newWidgets);
    saveLayout(newWidgets);
    setShowAddMenu(false);
  };

  const renderWidget = (widget: Widget) => {
    const props = { onRemove: () => removeWidget(widget.i) };
    
    switch (widget.type) {
      case 'machines':
        return <MachineWidget {...props} />;
      case 'projects':
        return <ProjectWidget {...props} />;
      case 'voice':
        return <VoiceControlWidget {...props} />;
      case 'sensors':
        return <SensorWidget {...props} />;
      default:
        return <div>Unknown Widget</div>;
    }
  };

  const widgetTypes = [
    { type: 'machines', name: 'Machines' },
    { type: 'projects', name: 'Projects' },
    { type: 'voice', name: 'Voice Control' },
    { type: 'sensors', name: 'Sensors' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">W.I.T. Dashboard</h1>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
          >
            <FaPlus /> Add Widget
          </button>
          {showAddMenu && (
            <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg p-1 z-50 min-w-[150px]">
              {widgetTypes.map(({ type, name }) => (
                <button
                  key={type}
                  onClick={() => addWidget(type)}
                  className="block w-full text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 px-4 py-2 rounded transition-all duration-150"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
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
          <div key={widget.i} className="widget-container">
            {renderWidget(widget)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default Dashboard;