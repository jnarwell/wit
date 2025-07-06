// src/pages/ProjectsPage.tsx
import React, { useState } from 'react';
import { FaProjectDiagram, FaPlus, FaSearch, FaCalendar, FaUser, FaTasks, FaClock } from 'react-icons/fa';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'planning' | 'completed' | 'on-hold';
  progress: number;
  owner: string;
  team: string[];
  startDate: string;
  deadline: string;
  tasksCompleted: number;
  totalTasks: number;
  priority: 'low' | 'medium' | 'high';
  budget?: number;
  budgetSpent?: number;
  tags: string[];
}

const ProjectsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Mock data - replace with real data
  const projects: Project[] = [
    {
      id: '1',
      name: 'Workshop Automation System',
      description: 'Implement AI-driven automation for all workshop equipment with voice control and predictive maintenance.',
      status: 'active',
      progress: 75,
      owner: 'John Doe',
      team: ['Jane Smith', 'Mike Johnson'],
      startDate: '2024-01-01',
      deadline: '2024-02-15',
      tasksCompleted: 18,
      totalTasks: 24,
      priority: 'high',
      budget: 50000,
      budgetSpent: 37500,
      tags: ['AI', 'Automation', 'IoT']
    },
    {
      id: '2',
      name: 'Tool Organization System',
      description: 'Design and build a comprehensive tool tracking and organization system with RFID tags.',
      status: 'planning',
      progress: 20,
      owner: 'Jane Smith',
      team: ['Tom Wilson'],
      startDate: '2024-01-15',
      deadline: '2024-03-01',
      tasksCompleted: 4,
      totalTasks: 20,
      priority: 'medium',
      budget: 15000,
      budgetSpent: 3000,
      tags: ['Organization', 'RFID', 'Inventory']
    },
    {
      id: '3',
      name: 'Safety Protocol Update',
      description: 'Update all safety protocols and implement new training program for workshop users.',
      status: 'completed',
      progress: 100,
      owner: 'Mike Johnson',
      team: ['Sarah Lee'],
      startDate: '2023-11-01',
      deadline: '2024-01-10',
      tasksCompleted: 15,
      totalTasks: 15,
      priority: 'high',
      budget: 10000,
      budgetSpent: 9500,
      tags: ['Safety', 'Training', 'Compliance']
    },
    {
      id: '4',
      name: 'CNC Workflow Optimization',
      description: 'Optimize CNC machining workflows with new CAM software and automated tool changes.',
      status: 'active',
      progress: 60,
      owner: 'Tom Wilson',
      team: ['John Doe', 'Jane Smith'],
      startDate: '2024-01-10',
      deadline: '2024-02-20',
      tasksCompleted: 12,
      totalTasks: 20,
      priority: 'medium',
      budget: 25000,
      budgetSpent: 15000,
      tags: ['CNC', 'Optimization', 'CAM']
    },
    {
      id: '5',
      name: 'Inventory Management System',
      description: 'Implement real-time inventory tracking with automatic reordering capabilities.',
      status: 'on-hold',
      progress: 45,
      owner: 'Sarah Lee',
      team: ['Mike Johnson'],
      startDate: '2023-12-01',
      deadline: '2024-02-28',
      tasksCompleted: 9,
      totalTasks: 20,
      priority: 'low',
      budget: 20000,
      budgetSpent: 9000,
      tags: ['Inventory', 'Database', 'Automation']
    },
    {
      id: '6',
      name: '3D Printer Fleet Expansion',
      description: 'Add 5 new 3D printers and create automated print farm management system.',
      status: 'active',
      progress: 35,
      owner: 'John Doe',
      team: ['Tom Wilson', 'Sarah Lee'],
      startDate: '2024-01-20',
      deadline: '2024-03-15',
      tasksCompleted: 7,
      totalTasks: 20,
      priority: 'high',
      budget: 75000,
      budgetSpent: 26250,
      tags: ['3D Printing', 'Expansion', 'Automation']
    }
  ];

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'planning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'on-hold': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: Project['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || project.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="page-container">
      {/* Header - Fixed */}
      <div className="bg-white shadow-sm px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaProjectDiagram className="text-purple-600" />
            Projects
          </h1>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-purple-700 transition-colors">
            <FaPlus /> New Project
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow max-w-md">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-blue-600 text-sm font-medium">Active</p>
            <p className="text-2xl font-bold text-blue-800">
              {projects.filter(p => p.status === 'active').length}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-green-600 text-sm font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-800">
              {projects.filter(p => p.status === 'completed').length}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-yellow-600 text-sm font-medium">Total Budget</p>
            <p className="text-2xl font-bold text-yellow-800">
              ${projects.reduce((sum, p) => sum + (p.budget || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-purple-600 text-sm font-medium">Total Tasks</p>
            <p className="text-2xl font-bold text-purple-800">
              {projects.reduce((sum, p) => sum + p.totalTasks, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Projects List - Scrollable */}
      <div className="page-content">
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const daysLeft = getDaysUntilDeadline(project.deadline);
            const budgetPercentage = project.budget ? (project.budgetSpent! / project.budget) * 100 : 0;
            
            return (
              <div key={project.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow animate-fadeIn">
                <div className="p-6">
                  {/* Project Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-grow">
                      <h3 className="text-xl font-semibold text-gray-800 mb-1">{project.name}</h3>
                      <p className="text-gray-600 text-sm mb-3">{project.description}</p>
                      
                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {project.tags.map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(project.status)}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(project.priority)}`}>
                        {project.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FaUser className="text-gray-400" />
                      <div>
                        <p className="text-gray-500 text-xs">Owner</p>
                        <p className="text-gray-800 font-medium">{project.owner}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCalendar className="text-gray-400" />
                      <div>
                        <p className="text-gray-500 text-xs">Deadline</p>
                        <p className={`font-medium ${daysLeft < 7 ? 'text-red-600' : 'text-gray-800'}`}>
                          {daysLeft > 0 ? `${daysLeft} days` : 'Overdue'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaTasks className="text-gray-400" />
                      <div>
                        <p className="text-gray-500 text-xs">Tasks</p>
                        <p className="text-gray-800 font-medium">
                          {project.tasksCompleted}/{project.totalTasks}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaClock className="text-gray-400" />
                      <div>
                        <p className="text-gray-500 text-xs">Team Size</p>
                        <p className="text-gray-800 font-medium">{project.team.length + 1}</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bars */}
                  <div className="space-y-3">
                    {/* Task Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Task Progress</span>
                        <span className="text-gray-800 font-medium">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            project.status === 'completed' ? 'bg-green-500' :
                            project.status === 'on-hold' ? 'bg-gray-400' :
                            'bg-purple-600'
                          }`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Budget Progress */}
                    {project.budget && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Budget Used</span>
                          <span className="text-gray-800 font-medium">
                            ${project.budgetSpent?.toLocaleString()} / ${project.budget.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              budgetPercentage > 90 ? 'bg-red-500' :
                              budgetPercentage > 75 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                      View Details
                    </button>
                    <button className="flex-1 px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">
                      Manage Tasks
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;