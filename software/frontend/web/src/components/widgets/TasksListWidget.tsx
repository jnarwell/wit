// src/components/widgets/TasksListWidget.tsx
import React, { useState, useEffect } from 'react';
import { FaTasks, FaCalendarAlt, FaFolder, FaCircle } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './TasksListWidget.css';

const API_BASE_URL = 'http://localhost:8000';

interface Task {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  project_name: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  created_at: string;
  updated_at: string;
}

const TASK_STATUS = {
  not_started: { label: 'Not Started', color: 'bg-yellow-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500' },
  blocked: { label: 'Blocked', color: 'bg-red-500' },
  complete: { label: 'Complete', color: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500' }
};

const TASK_PRIORITY = {
  low: { label: 'Low', color: 'text-gray-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' }
};

export const TasksListWidget: React.FC = () => {
  const { tokens } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [tokens]);

  const fetchTasks = async () => {
    if (!tokens) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/incomplete`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      // Sort by due date (earliest first)
      const sortedTasks = data.sort((a: Task, b: Task) => {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setTasks(sortedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} days overdue`, className: 'text-red-500 font-semibold' };
    } else if (diffDays === 0) {
      return { text: 'Due today', className: 'text-orange-500 font-semibold' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', className: 'text-yellow-500' };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, className: 'text-yellow-400' };
    } else {
      return { text: date.toLocaleDateString(), className: 'text-gray-400' };
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 h-full flex items-center justify-center">
        <div className="text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 h-full flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaTasks className="text-blue-400 text-xl" />
          <h3 className="text-lg font-semibold text-white">Upcoming Tasks</h3>
        </div>
        <span className="text-sm text-gray-400">{tasks.length} tasks</span>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto tasks-list-container">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No pending tasks
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const dueDate = formatDueDate(task.due_date);
              const date = new Date(task.due_date);
              const now = new Date();
              const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              let taskClass = "bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors cursor-pointer";
              if (diffDays < 0) taskClass += " task-overdue";
              else if (diffDays === 0) taskClass += " task-due-today";
              else if (diffDays <= 3) taskClass += " task-due-soon";
              
              return (
                <div
                  key={task.id}
                  className={taskClass}
                >
                  {/* Task Title and Priority */}
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-white font-medium flex-1 pr-2">{task.title}</h4>
                    <span className={`text-xs ${TASK_PRIORITY[task.priority].color}`}>
                      {TASK_PRIORITY[task.priority].label}
                    </span>
                  </div>

                  {/* Task Details */}
                  <div className="flex items-center gap-4 text-xs">
                    {/* Project */}
                    <div className="flex items-center gap-1 text-gray-300">
                      <FaFolder className="text-gray-400 text-xs" />
                      <span>{task.project_name}</span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1">
                      <FaCircle className={`${TASK_STATUS[task.status]?.color || 'bg-gray-500'} text-xs`} />
                      <span className="text-gray-300">{TASK_STATUS[task.status]?.label || task.status}</span>
                    </div>

                    {/* Due Date */}
                    <div className="flex items-center gap-1 ml-auto">
                      <FaCalendarAlt className="text-gray-400" />
                      <span className={dueDate.className}>{dueDate.text}</span>
                    </div>
                  </div>

                  {/* Description if available */}
                  {task.description && (
                    <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};