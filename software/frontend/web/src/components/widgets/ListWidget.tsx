// src/components/widgets/ListWidget.tsx
import React from 'react';
import { FaTimes, FaCog, FaProjectDiagram, FaMicrochip, FaChevronRight } from 'react-icons/fa';

interface ListWidgetProps {
  type: 'projects' | 'machines' | 'sensors';
  onRemove: () => void;
  onNavigate: () => void;
  style: React.CSSProperties;
}

const ListWidget: React.FC<ListWidgetProps> = ({ type, onRemove, onNavigate, style }) => {
  const getIcon = () => {
    switch (type) {
      case 'projects': return <FaProjectDiagram size={32} />;
      case 'machines': return <FaCog size={32} />;
      case 'sensors': return <FaMicrochip size={32} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'projects': return 'from-blue-600 to-blue-700';
      case 'machines': return 'from-purple-600 to-purple-700';
      case 'sensors': return 'from-teal-600 to-teal-700';
    }
  };

  const getCount = () => {
    // This would come from your data source
    switch (type) {
      case 'projects': return 12;
      case 'machines': return 8;
      case 'sensors': return 24;
    }
  };

  const getActiveCount = () => {
    // This would come from your data source
    switch (type) {
      case 'projects': return 5;
      case 'machines': return 6;
      case 'sensors': return 20;
    }
  };

  return (
    <div style={style} className="widget-container group">
      <div 
        className={`h-full bg-gradient-to-br ${getColor()} rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl transform hover:scale-105 transition-all cursor-pointer`}
        onClick={onNavigate}
      >
        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity z-10"
        >
          <FaTimes size={16} />
        </button>

        {/* Content */}
        <div className="h-full flex flex-col items-center justify-center p-4 text-white">
          {/* Icon */}
          <div className="mb-3">
            {getIcon()}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold capitalize mb-2">{type}</h3>

          {/* Stats */}
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold">{getCount()}</div>
            <div className="text-sm opacity-80">{getActiveCount()} Active</div>
          </div>

          {/* Navigate indicator */}
          <div className="mt-4 flex items-center gap-1 text-sm opacity-80">
            <span>View All</span>
            <FaChevronRight size={12} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListWidget;