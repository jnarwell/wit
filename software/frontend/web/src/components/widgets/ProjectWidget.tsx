// src/components/widgets/ProjectWidget.tsx
import React, { useState } from 'react';
import { FaTimes, FaProjectDiagram, FaClock, FaUser } from 'react-icons/fa';

interface ProjectWidgetProps {
  onRemove?: () => void;
}

interface Project {
  id: string;
  name: string;
  status: 'active' | 'planning' | 'completed' | 'on-hold';
  progress: number;
  owner: string;
  deadline: string;
  tasksCompleted: number;
  totalTasks: number;
  priority: 'low' | 'medium' | 'high';
}

const ProjectWidget: React.FC<ProjectWidgetProps> = ({ onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Mock data - replace with real data from API
  const projects: Project[] = [
    {
      id: '1',
      name: 'Workshop Automation',
      status: 'active',
      progress: 75,
      owner: 'John Doe',
      deadline: '2024-02-15',
      tasksCompleted: 18,
      totalTasks: 24,
      priority: 'high'
    },
    {
      id: '2',
      name: 'Tool Organization System',
      status: 'planning',
      progress: 20,
      owner: 'Jane Smith',
      deadline: '2024-03-01',
      tasksCompleted: 4,
      totalTasks: 20,
      priority: 'medium'
    },
    {
      id: '3',
      name: 'Safety Protocol Update',
      status: 'completed',
      progress: 100,
      owner: 'Mike Johnson',
      deadline: '2024-01-10',
      tasksCompleted: 15,
      totalTasks: 15,
      priority: 'high'
    },
    {
      id: '4',
      name: 'Inventory Management',
      status: 'on-hold',
      progress: 45,
      owner: 'Sarah Lee',
      deadline: '2024-02-28',
      tasksCompleted: 9,
      totalTasks: 20,
      priority: 'low'
    },
    {
      id: '5',
      name: 'CNC Workflow Optimization',
      status: 'active',
      progress: 60,
      owner: 'Tom Wilson',
      deadline: '2024-02-20',
      tasksCompleted: 12,
      totalTasks: 20,
      priority: 'medium'
    }
  ];

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'text-blue-600 bg-blue-50';
      case 'planning': return 'text-yellow-600 bg-yellow-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'on-hold': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: Project['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FaProjectDiagram className="text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-800">Projects</h3>
        </div>
        {onRemove && isHovered && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove widget"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Project List - Scrollable */}
      <div className="widget-content flex-grow">
        <div className="space-y-3">
          {projects.map((project) => {
            const daysLeft = getDaysUntilDeadline(project.deadline);
            
            return (
              <div 
                key={project.id} 
                className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow animate-fadeIn"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-grow">
                    <h4 className="font-medium text-gray-800 flex items-center gap-2">
                      {project.name}
                      <span className={`text-xs ${getPriorityColor(project.priority)}`}>
                        {project.priority.toUpperCase()}
                      </span>
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FaUser className="text-gray-400" />
                        {project.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <FaClock className="text-gray-400" />
                        {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
                    {project.status.replace('-', ' ')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{project.tasksCompleted}/{project.totalTasks} tasks</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        project.status === 'completed' ? 'bg-green-500' :
                        project.status === 'on-hold' ? 'bg-gray-400' :
                        'bg-purple-600'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Active:</span>
            <span className="ml-1 font-medium text-blue-600">
              {projects.filter(p => p.status === 'active').length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Completed:</span>
            <span className="ml-1 font-medium text-green-600">
              {projects.filter(p => p.status === 'completed').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectWidget;