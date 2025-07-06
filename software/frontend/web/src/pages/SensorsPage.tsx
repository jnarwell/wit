import React, { useState } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FaTimes, FaThermometerHalf, FaTint, FaWind, FaBolt, FaLightbulb, FaVolumeUp } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Sensor {
  id: string;
  name: string;
  type: string;
  value: number;
  unit: string;
  location: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  lastUpdate: string;
  icon: React.ElementType;
  history?: { time: string; value: number }[];
}

interface SensorWidget {
  i: string;
  sensorId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SensorsPage: React.FC = () => {
  const sensors: Sensor[] = [
    {
      id: '1',
      name: 'Workshop Temperature',
      type: 'Temperature',
      value: 23.5,
      unit: '°C',
      location: 'Main Workshop',
      status: 'NORMAL',
      lastUpdate: '2 mins ago',
      icon: FaThermometerHalf,
      history: [
        { time: '00:00', value: 22 },
        { time: '04:00', value: 21 },
        { time: '08:00', value: 22.5 },
        { time: '12:00', value: 24 },
        { time: '16:00', value: 23.5 },
        { time: '20:00', value: 23 },
      ],
    },
    {
      id: '2',
      name: 'Humidity Level',
      type: 'Humidity',
      value: 45,
      unit: '%',
      location: 'Main Workshop',
      status: 'NORMAL',
      lastUpdate: '2 mins ago',
      icon: FaTint,
    },
    {
      id: '3',
      name: 'Air Pressure',
      type: 'Pressure',
      value: 1013,
      unit: 'hPa',
      location: 'Main Workshop',
      status: 'NORMAL',
      lastUpdate: '5 mins ago',
      icon: FaWind,
    },
    {
      id: '4',
      name: 'Power Consumption',
      type: 'Power',
      value: 2.4,
      unit: 'kW',
      location: 'Machine Area',
      status: 'WARNING',
      lastUpdate: '1 min ago',
      icon: FaBolt,
    },
    {
      id: '5',
      name: 'Light Level',
      type: 'Light',
      value: 750,
      unit: 'lux',
      location: 'Work Area',
      status: 'NORMAL',
      lastUpdate: '3 mins ago',
      icon: FaLightbulb,
    },
    {
      id: '6',
      name: 'Noise Level',
      type: 'Sound',
      value: 65,
      unit: 'dB',
      location: 'Machine Area',
      status: 'WARNING',
      lastUpdate: '1 min ago',
      icon: FaVolumeUp,
    },
  ];

  const [widgets, setWidgets] = useState<SensorWidget[]>(() => {
    const saved = localStorage.getItem('sensorsLayout');
    if (saved) {
      return JSON.parse(saved);
    }
    return sensors.map((sensor, index) => ({
      i: `sensor-${sensor.id}`,
      sensorId: sensor.id,
      x: (index % 3) * 4,
      y: Math.floor(index / 3) * 6,
      w: 4,
      h: 6,
    }));
  });

  const saveLayout = (newWidgets: SensorWidget[]) => {
    localStorage.setItem('sensorsLayout', JSON.stringify(newWidgets));
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
      case 'NORMAL': return 'bg-green-100 text-green-800 border-green-300';
      case 'WARNING': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getValueColor = (status: string) => {
    switch (status) {
      case 'NORMAL': return 'text-green-600';
      case 'WARNING': return 'text-amber-600';
      case 'CRITICAL': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderSensorWidget = (widget: SensorWidget) => {
    const sensor = sensors.find(s => s.id === widget.sensorId);
    if (!sensor) return null;

    const Icon = sensor.icon;

    return (
      <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                <Icon className="text-xl text-gray-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800 truncate">{sensor.name}</h3>
                <p className="text-sm text-gray-600 truncate">{sensor.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(sensor.status)}`}>
                {sensor.status}
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

        <div className="flex-1 p-4 flex flex-col">
          <div className="text-center mb-3">
            <div className={`text-3xl font-bold ${getValueColor(sensor.status)}`}>
              {sensor.value}
              <span className="text-xl font-normal ml-1">{sensor.unit}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Last update: {sensor.lastUpdate}</p>
          </div>

          {sensor.history && widget.h > 5 && (
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensor.history} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-4 flex gap-2 border-t border-gray-200">
          <button className="flex-1 text-sm bg-blue-600 text-white py-2 px-2 rounded-md hover:bg-blue-700 transition-colors">
            History
          </button>
          <button className="flex-1 text-sm border border-gray-300 text-gray-700 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors">
            Configure
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Sensors Overview</h2>
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
            {renderSensorWidget(widget)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default SensorsPage;