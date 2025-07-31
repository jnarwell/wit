import React, { useState, useEffect } from 'react';
import { FaTimes, FaProjectDiagram, FaCheckCircle, FaClock, FaExclamationCircle } from 'react-icons/fa';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProjectProgressWidgetProps {
  onRemove: () => void;
  width?: number;
  height?: number;
  data?: {
    projectId?: string;
    projectName?: string;
  };
}

interface Task {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
}

const ProjectProgressWidget: React.FC<ProjectProgressWidgetProps> = ({ onRemove, width = 1, height = 1, data }) => {
  const [selectedProject, setSelectedProject] = useState(data?.projectId || '');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState(0);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now

  // Simulate project data
  useEffect(() => {
    if (selectedProject || data?.projectId) {
      // Generate mock tasks
      const mockTasks: Task[] = [
        { id: '1', name: 'Design Phase', status: 'completed' },
        { id: '2', name: 'Prototype Development', status: 'completed' },
        { id: '3', name: 'Testing', status: 'in_progress' },
        { id: '4', name: 'Documentation', status: 'in_progress' },
        { id: '5', name: 'Manufacturing Setup', status: 'pending' },
        { id: '6', name: 'Quality Assurance', status: 'pending' },
        { id: '7', name: 'Deployment', status: 'pending' }
      ];
      setTasks(mockTasks);
      
      // Calculate progress
      const completed = mockTasks.filter(t => t.status === 'completed').length;
      setProgress((completed / mockTasks.length) * 100);
    }
  }, [selectedProject, data?.projectId]);

  const isCompact = width <= 1 && height <= 1;
  const isMedium = width === 2 || height === 2;
  const isLarge = width >= 3 || height >= 3;

  const getTaskCounts = () => {
    const counts = {
      completed: 0,
      in_progress: 0,
      pending: 0,
      blocked: 0
    };
    tasks.forEach(task => {
      counts[task.status]++;
    });
    return counts;
  };

  const taskCounts = getTaskCounts();

  const chartData = {
    labels: ['Completed', 'In Progress', 'Pending', 'Blocked'],
    datasets: [
      {
        data: [taskCounts.completed, taskCounts.in_progress, taskCounts.pending, taskCounts.blocked],
        backgroundColor: ['#10B981', '#3B82F6', '#6B7280', '#EF4444'],
        borderWidth: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: !isCompact
      }
    }
  };

  const getDaysRemaining = () => {
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = () => {
    const daysRemaining = getDaysRemaining();
    if (progress >= 100) return 'text-green-400';
    if (daysRemaining < 7) return 'text-red-400';
    if (daysRemaining < 14) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="widget-container group h-full">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-all flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r from-indigo-600 to-indigo-700 ${isCompact ? 'p-2' : 'p-3'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <FaProjectDiagram size={isCompact ? 20 : 24} />
              {!isCompact && <span className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}>Project Progress</span>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"
            >
              <FaTimes size={isCompact ? 14 : 16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex-1 flex flex-col`}>
          {/* Project Selector */}
          {!data?.projectId && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full mb-3 bg-gray-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="">Select Project</option>
              <option value="project-1">Smart Home System</option>
              <option value="project-2">Industrial Automation</option>
              <option value="project-3">IoT Dashboard</option>
            </select>
          )}

          {/* Project Name */}
          {(selectedProject || data?.projectId) && (
            <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-white mb-2`}>
              {data?.projectName || 'Smart Home System'}
            </h3>
          )}

          {/* Progress Display */}
          <div className="mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold ${getStatusColor()}`}>
                {progress.toFixed(0)}%
              </span>
              {!isCompact && (
                <span className="text-xs text-gray-400">
                  {getDaysRemaining()} days left
                </span>
              )}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Task Summary for compact view */}
          {isCompact && (
            <div className="text-xs text-gray-400">
              <span className="text-green-400">{taskCounts.completed}</span> / {tasks.length} tasks
            </div>
          )}

          {/* Chart for medium/large widgets */}
          {!isCompact && (isMedium || isLarge) && (
            <div className="flex-1 min-h-0 mb-3" style={{ maxHeight: '150px' }}>
              <Doughnut data={chartData} options={chartOptions} />
            </div>
          )}

          {/* Task Breakdown for non-compact */}
          {!isCompact && (
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FaCheckCircle className="text-green-400" />
                  <span className="text-gray-400">Completed</span>
                </span>
                <span className="text-white">{taskCounts.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FaClock className="text-blue-400" />
                  <span className="text-gray-400">In Progress</span>
                </span>
                <span className="text-white">{taskCounts.in_progress}</span>
              </div>
              {isLarge && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <FaClock className="text-gray-400" />
                      <span className="text-gray-400">Pending</span>
                    </span>
                    <span className="text-white">{taskCounts.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <FaExclamationCircle className="text-red-400" />
                      <span className="text-gray-400">Blocked</span>
                    </span>
                    <span className="text-white">{taskCounts.blocked}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Recent Activity for large widgets */}
          {isLarge && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-xs font-medium text-gray-400 mb-2">Recent Activity</h4>
              <div className="space-y-1 text-xs">
                <div className="text-gray-300">✓ Testing phase started</div>
                <div className="text-gray-300">✓ Prototype approved</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressWidget;