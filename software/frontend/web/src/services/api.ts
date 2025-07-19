// src/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// API Response Types
export interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  currentJob?: string;
  progress?: number;
  metrics?: Array<{ label: string; value: string }>;
}

export interface Project {
  id: string;
  name: string;
  status: 'active' | 'planning' | 'completed' | 'on_hold';
  progress: number;