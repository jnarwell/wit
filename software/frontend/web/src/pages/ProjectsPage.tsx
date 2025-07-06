import React, { useState } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FaTimes, FaClock, FaUser, FaTasks, FaCalendar } from 'react-icons/fa';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'ON_HOLD';
  progress: number;
  owner: string;
  dueDate: string;
  tasks: {
    total: number;
    completed: number;
  };
}

interface ProjectWidget {
  i: string;
  projectId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ProjectsPage: React.FC = () => {
  const projects: Project[] = [
    {
      id: '1',
      name: 'Keyboard Build',
      description: 'Custom mechanical keyboard with wooden case',
      status: 'ACTIVE',
      progress: 75,
      owner: 'John Doe',
      dueDate: '2024-02-15',
      tasks: { total: 12, completed: 9 },
    },
    {
      id: '2',
      name: 'Robot Arm',
      description: '6-axis robot arm for workshop automation',
      status: 'PLANNING',
      progress: 15,
      owner: 'Jane Smith',
      dueDate: '2024-04-01',
      tasks: { total: 20, completed: 3 },
    },
    {
      id: '3',
      name: 'LED Display',
      description: 'Large LED matrix display for workshop status',
      status: 'COMPLETED',
      progress: 100,
      owner: 'Mike Johnson',
      dueDate: '2024-01-10',
      tasks: { total: 8, completed: 8 },
    },
    {
      id: '4',
      name: 'Tool Organizer',
      description: 'Modular tool organization system',
      status: 'ON_HOLD',
      progress: 40,
      owner: 'Sarah Wilson',
      dueDate: '2024-03-20',
      tasks: { total: 15, completed: 6 },
    },
  ];

  const [widgets, setWidgets] = useState<ProjectWidget[]>(() => {
    const saved = localStorage.getItem('projectsLayout');
    if (saved) {
      return JSON.parse(saved);
    }
    return projects.map((project, index) => ({
      i: `project-${project.id}`,
      projectId: project.id,
      x: (index % 2) * 6,
      y: Math.floor(index / 2) * 7,
      w: 6,
      h: 7,
    }));
  });

  const saveLayout = (newWidgets: ProjectWidget[]) => {
    localStorage.setItem('projectsLayout', JSON.stringify(newWidgets));
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
      case 'ACTIVE': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PLANNING': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      case 'ON_HOLD': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 75) return 'bg-green-600';
    if (progress >= 50) return 'bg-blue-600';
    if (progress >= 25) return 'bg-amber-600';
    return 'bg-gray-600';
  };

  const renderProjectWidget = (widget: ProjectWidget) => {
    const project = projects.find(p => p.id === widget.projectId);
    if (!project) return null;

    return (
      <div className="bg-white rounded-lg shadow-md h-full flex flex-col border border-gray-200 relative group overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-2">
              <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(project.status)}`}>
                {project.status.replace('_', ' ')}
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
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(project.progress)}`}
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <FaUser className="text-gray-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-gray-600">Owner: </span>
                <span className="text-gray-800 font-medium">{project.owner}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FaCalendar className="text-gray-400 flex-shrink-0" />
              <div className="truncate">
                <span className="text-gray-600">Due: </span>
                <span className="text-gray-800 font-medium">{project.dueDate}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FaTasks className="text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-600">Tasks: </span>
                <span className="text-gray-800 font-medium">
                  {project.tasks.completed}/{project.tasks.total}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FaClock className="text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-600">Time: </span>
                <span className="text-gray-800 font-medium">14 days</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-2 border-t border-gray-200">
          <button className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-sm">
            View Details
          </button>
          <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-md hover:bg-gray-50 transition-colors text-sm">
            Edit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Projects Overview</h2>
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
            {renderProjectWidget(widget)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default ProjectsPage;