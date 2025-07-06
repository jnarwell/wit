import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface Sensor {
  name: string;
  value: string;
  unit: string;
}

interface SensorWidgetProps {
  onRemove?: () => void;
}

const SensorWidget: React.FC<SensorWidgetProps> = ({ onRemove }) => {
  const sensors: Sensor[] = [
    { name: 'Temperature', value: '23.5', unit: '°C' },
    { name: 'Humidity', value: '45', unit: '%' },
    { name: 'Pressure', value: '1013', unit: 'hPa' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Sensors</h3>
        {onRemove && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 hover:bg-red-600 text-white p-2 rounded-md"
            style={{ touchAction: 'none' }}
          >
            <FaTimes className="text-sm" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {sensors.map((sensor) => (
          <div key={sensor.name} className="p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">{sensor.name}</div>
            <div className="text-2xl font-semibold text-gray-900">
              {sensor.value}
              <span className="text-lg font-normal text-gray-600 ml-1">{sensor.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SensorWidget;