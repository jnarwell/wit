import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface Project {
  name: string;
  status: 'ACTIVE' | 'PLANNING' | 'COMPLETED';
}

interface ProjectWidgetProps {
  onRemove?: () => void;
}

const ProjectWidget: React.FC<ProjectWidgetProps> = ({ onRemove }) => {
  const projects: Project[] = [
    { name: 'KEYBOARD_BUILD', status: 'ACTIVE' },
    { name: 'ROBOT_ARM', status: 'PLANNING' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-blue-600 bg-blue-50';
      case 'PLANNING': return 'text-amber-600 bg-amber-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Projects</h3>
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
        {projects.map((project) => (
          <div key={project.name} className="p-3 bg-gray-50 rounded-md">
            <div className="font-medium text-gray-900">{project.name.replace(/_/g, ' ')}</div>
            <div className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getStatusColor(project.status)}`}>
              {project.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectWidget;