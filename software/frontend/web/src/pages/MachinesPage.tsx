// src/pages/MachinesPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaSortAmountDown, FaTimes, FaCheckCircle, FaExclamationCircle, FaUser, FaLock, FaSignInAlt, FaSignOutAlt, FaWifi, FaExclamationTriangle } from 'react-icons/fa';
import SpecificWidget from '../components/widgets/SpecificWidget';

import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : '';

// WebSocket configuration
const WS_ENABLED = true; // Set to false to disable WebSocket completely
const WS_MAX_RECONNECT_ATTEMPTS = 3;
const WS_RECONNECT_DELAY = 5000; // 5 seconds

// WebSocket Status Component
const WebSocketStatus: React.FC<{ status: 'connected' | 'disconnected' | 'failed' | 'disabled' }> = ({ status }) => {
  // ... (implementation remains the same)
};


// Machine interfaces
interface Machine {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  metrics: { label: string; value: string }[];
  connectionType: 'usb' | 'network' | 'serial' | 'bluetooth' | 'network-prusalink' | 'network-octoprint';
  connectionDetails: string;
  manufacturer: string;
  model?: string;
  notes?: string;
  dateAdded: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  username?: string;
  password?: string;
  apiKey?: string;
}

interface MachineTypeConfig {
  defaultName: string;
  connectionTypes: Array<'usb' | 'network' | 'serial' | 'bluetooth' | 'network-prusalink' | 'network-octoprint'>;
  defaultConnection: 'usb' | 'network' | 'serial' | 'bluetooth' | 'network-prusalink' | 'network-octoprint';
  manufacturers: string[];
}

interface MachinesPageProps {
  onNavigateToDetail?: (id: string) => void;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MACHINE_TYPES: Record<string, MachineTypeConfig> = {
  '3d-printer': {
    defaultName: '3D Printer',
    connectionTypes: ['usb', 'network-prusalink', 'network-octoprint', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Prusa', 'Ultimaker', 'MakerBot', 'Creality', 'Anycubic', 'Other']
  },
  'laser-cutter': {
    defaultName: 'Laser Cutter',
    connectionTypes: ['usb', 'network-prusalink', 'network-octoprint'],
    defaultConnection: 'network-octoprint',
    manufacturers: ['Epilog', 'Trotec', 'Universal Laser', 'Glowforge', 'Other']
  },
  'cnc-mill': {
    defaultName: 'CNC Mill',
    connectionTypes: ['usb', 'serial', 'network-octoprint'],
    defaultConnection: 'serial',
    manufacturers: ['Haas', 'Tormach', 'ShopBot', 'Carbide 3D', 'Other']
  },
  'vinyl-cutter': {
    defaultName: 'Vinyl Cutter',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Cricut', 'Silhouette', 'Roland', 'Other']
  },
  'soldering': {
    defaultName: 'Soldering Station',
    connectionTypes: ['usb'],
    defaultConnection: 'usb',
    manufacturers: ['Hakko', 'Weller', 'Metcal', 'Other']
  },
  'custom': {
    defaultName: 'Custom Equipment',
    connectionTypes: ['usb', 'network-prusalink', 'network-octoprint', 'serial', 'bluetooth'],
    defaultConnection: 'network-octoprint',
    manufacturers: ['Custom', 'Other']
  },
  // Microcontrollers
  'arduino-uno': {
    defaultName: 'Arduino Uno',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Arduino']
  },
  'arduino-mega': {
    defaultName: 'Arduino Mega',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Arduino']
  },
  'arduino-nano': {
    defaultName: 'Arduino Nano',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Arduino']
  },
  'esp32': {
    defaultName: 'ESP32',
    connectionTypes: ['usb', 'network', 'bluetooth'],
    defaultConnection: 'usb',
    manufacturers: ['Espressif', 'NodeMCU', 'Wemos', 'Other']
  },
  'esp8266': {
    defaultName: 'ESP8266',
    connectionTypes: ['usb', 'network'],
    defaultConnection: 'usb',
    manufacturers: ['Espressif', 'NodeMCU', 'Wemos', 'Other']
  },
  'raspberry-pi': {
    defaultName: 'Raspberry Pi',
    connectionTypes: ['network', 'usb'],
    defaultConnection: 'network',
    manufacturers: ['Raspberry Pi Foundation']
  },
  'raspberry-pi-pico': {
    defaultName: 'Raspberry Pi Pico',
    connectionTypes: ['usb', 'serial'],
    defaultConnection: 'usb',
    manufacturers: ['Raspberry Pi Foundation']
  }
};

const CONNECTION_CONFIGS: Record<string, any> = {
  'usb': {
    label: 'USB',
    placeholder: '/dev/ttyUSB0 or COM3',
    helperText: 'Connect printer directly via USB cable'
  },
  'network-prusalink': {
    label: 'Network (PrusaLink)',
    placeholder: '192.168.1.100',
    helperText: 'Built-in network interface on Prusa XL/MK4/MINI+',
    requiresAuth: true,
    authType: 'basic'
  },
  'network-octoprint': {
    label: 'Network (OctoPrint)',
    placeholder: 'http://octopi.local:5000',
    helperText: 'OctoPrint server URL',
    requiresApiKey: true
  },
  'serial': {
    label: 'Serial',
    placeholder: '/dev/ttyS0',
    helperText: 'Direct serial connection'
  },
  'bluetooth': {
    label: 'Bluetooth',
    placeholder: 'Device name',
    helperText: 'Bluetooth connection (experimental)'
  },
  'network': {
    label: 'Network',
    placeholder: '192.168.1.100:8080',
    helperText: 'IP address and port for network connection'
  }
};

const MachinesPage: React.FC<MachinesPageProps> = ({ onNavigateToDetail }) => {
  const { isAuthenticated, tokens } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [machines, setMachines] = useState<Machine[]>(() => {
    const saved = localStorage.getItem('wit-machines');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('[MachinesPage] Initial state from localStorage:', parsed.length, 'machines');
        return parsed;
      } catch (e) {
        console.error('[MachinesPage] Failed to parse initial state:', e);
        return [];
      }
    }
    console.log('[MachinesPage] No saved machines, starting with empty array');
    return [];
  });

  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnectingWS, setIsConnectingWS] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'failed' | 'disabled'>(
    WS_ENABLED ? 'disconnected' : 'disabled'
  );

  // Function to update machine data from printer status
  const updateMachineFromPrinterStatus = useCallback((printerId: string, status: any) => {
    setMachines(prevMachines => 
      prevMachines.map(machine => {
        if (machine.id === printerId) {
          // Determine status color based on printer state
          let statusColor: 'green' | 'yellow' | 'red' = 'red';
          const stateText = (status.state?.text || status.state || '').toLowerCase();
          
          if (status.connected) {
            if (stateText.includes('ready') || stateText.includes('operational') || stateText.includes('idle')) {
              statusColor = 'green';
            } else if (stateText.includes('printing') || stateText.includes('busy')) {
              statusColor = 'yellow';
            } else if (stateText.includes('error') || stateText.includes('offline')) {
              statusColor = 'red';
            } else {
              statusColor = 'yellow';
            }
          }
          
          // Build metrics from real data
          const metrics = [];
          
          // Status
          metrics.push({ 
            label: 'Status', 
            value: status.state?.text || status.state || 'Unknown' 
          });
          
          // Temperatures - check multiple possible locations
          const telemetry = status.telemetry || status.raw_telemetry || {};
          const temps = status.temperatures || {};
          
          const nozzleTemp = telemetry['temp-nozzle'] || temps.nozzle?.current || 0;
          const nozzleTarget = telemetry['temp-nozzle-target'] || temps.nozzle?.target || 0;
          const bedTemp = telemetry['temp-bed'] || temps.bed?.current || 0;
          const bedTarget = telemetry['temp-bed-target'] || temps.bed?.target || 0;
          
          if (nozzleTemp !== undefined || bedTemp !== undefined) {
            metrics.push({ 
              label: 'Nozzle', 
              value: nozzleTarget > 0 
                ? `${nozzleTemp.toFixed(1)}°C → ${nozzleTarget}°C`
                : `${nozzleTemp.toFixed(1)}°C`
            });
            
            metrics.push({ 
              label: 'Bed', 
              value: bedTarget > 0
                ? `${bedTemp.toFixed(1)}°C → ${bedTarget}°C`
                : `${bedTemp.toFixed(1)}°C`
            });
          }
          
          // Print job info
          if (status.job) {
            metrics.push({ 
              label: 'Job', 
              value: status.job.name || 'Printing...' 
            });
            
            if (status.job.progress !== undefined) {
              metrics.push({ 
                label: 'Progress', 
                value: `${status.job.progress.toFixed(1)}%` 
              });
            }
            
            if (status.job.time_remaining) {
              const hours = Math.floor(status.job.time_remaining / 3600);
              const minutes = Math.floor((status.job.time_remaining % 3600) / 60);
              metrics.push({ 
                label: 'Time Left', 
                value: `${hours}h ${minutes}m` 
              });
            }
          }
          
          // Position (for serial printers)
          if (status.position) {
            metrics.push({ 
              label: 'Position', 
              value: `X:${status.position.x?.toFixed(1)} Y:${status.position.y?.toFixed(1)} Z:${status.position.z?.toFixed(1)}` 
            });
          }
          
          return {
            ...machine,
            status: statusColor,
            metrics: metrics
          };
        }
        return machine;
      })
    );
  }, []);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    // Check if WebSocket is enabled
    if (!WS_ENABLED) {
      setWsStatus('disabled');
      return;
    }

    // Don't attempt if we've failed too many times
    if (reconnectAttemptsRef.current >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.log('[MachinesPage] Max reconnection attempts reached, stopping WebSocket connection');
      setWsStatus('failed');
      return;
    }

    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectingWS) {
      return;
    }
    
    setIsConnectingWS(true);
    setWsStatus('disconnected');
    console.log(`[MachinesPage] Connecting to printer WebSocket... (attempt ${reconnectAttemptsRef.current + 1}/${WS_MAX_RECONNECT_ATTEMPTS})`);
    
    try {
      const ws = new WebSocket('ws://localhost:8000/api/v1/equipment/ws/printers');
      
      ws.onopen = () => {
        console.log('[MachinesPage] WebSocket connected successfully');
        setIsConnectingWS(false);
        setWsStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial') {
            // Initial printer list - update all matching machines
            data.printers.forEach((printer: any) => {
              updateMachineFromPrinterStatus(printer.id, printer);
            });
          } else if (data.type === 'printer_update') {
            // Single printer update
            updateMachineFromPrinterStatus(data.printer.id, data.printer);
          } else if (data.type === 'printer_deleted') {
            // Printer was deleted
            console.log(`[MachinesPage] Printer ${data.printer_id} deleted`);
          }
        } catch (error) {
          console.error('[MachinesPage] WebSocket message error:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[MachinesPage] WebSocket error:', error);
        setIsConnectingWS(false);
        reconnectAttemptsRef.current++;
      };
      
      ws.onclose = () => {
        console.log('[MachinesPage] WebSocket disconnected');
        setIsConnectingWS(false);
        wsRef.current = null;
        
        // Only attempt reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
          setWsStatus('disconnected');
          
          // Clear any existing timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Schedule reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, WS_RECONNECT_DELAY);
        } else {
          setWsStatus('failed');
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('[MachinesPage] Failed to create WebSocket:', error);
      setIsConnectingWS(false);
      reconnectAttemptsRef.current++;
      setWsStatus('failed');
    }
  }, [updateMachineFromPrinterStatus]);

  // Connect WebSocket when component mounts
  useEffect(() => {
    if (WS_ENABLED) {
      connectWebSocket();
    }
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Function to fetch latest printer status
  const refreshPrinterStatus = useCallback(async (printerId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/${printerId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[MachinesPage] Got printer status:', data);
        
        // Map the response to the expected format
        const status = {
          connected: data.connected,
          state: { text: data.state || 'Unknown' },
          telemetry: data.raw_telemetry || {},
          job: data.job,
          temperatures: data.temperatures
        };
        
        updateMachineFromPrinterStatus(printerId, status);
      }
    } catch (error) {
      console.error('[MachinesPage] Error fetching printer status:', error);
    }
  }, [updateMachineFromPrinterStatus]);

  // Poll for printer status updates (backup for WebSocket)
  useEffect(() => {
    // Only poll if WebSocket is not connected or has failed
    if (wsStatus === 'connected') {
      return;
    }

    const interval = setInterval(() => {
      machines.forEach(machine => {
        if (machine.connectionType.startsWith('network') || machine.connectionType === 'serial') {
          refreshPrinterStatus(machine.id);
        }
      });
    }, 10000); // Poll every 10 seconds as backup
    
    return () => clearInterval(interval);
  }, [machines, wsStatus, refreshPrinterStatus]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridSize, setGridSize] = useState({ cellWidth: 0, cellHeight: 0 });
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date'>('date');
  const [gridCols, setGridCols] = useState(3);
  const [gridRows, setGridRows] = useState(3);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableSerialPorts, setAvailableSerialPorts] = useState<Array<{ port: string; description: string }>>([]);
  const [scanningPorts, setScanningPorts] = useState(false);
  
  const [newMachine, setNewMachine] = useState({
    type: '3d-printer',
    name: '',
    connectionType: 'usb' as 'usb' | 'network-prusalink' | 'network-octoprint' | 'serial' | 'bluetooth',
    connectionDetails: '',
    username: 'maker',
    password: '',
    apiKey: '',
    manufacturer: '',
    model: '',
    notes: '',
    baudRate: '115200'
  });

  // Drag state
  const isDraggingRef = useRef(false);
  const draggedMachineRef = useRef<Machine | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Resize state
  const isResizingRef = useRef(false);
  const resizedMachineRef = useRef<Machine | null>(null);
  const resizeDirectionRef = useRef<ResizeDirection>('se');
  const resizeStartRef = useRef({ 
    x: 0, 
    y: 0, 
    width: 0, 
    height: 0,
    posX: 0,
    posY: 0
  });
  const [resizePreview, setResizePreview] = useState<{ 
    width: number; 
    height: number;
    x?: number;
    y?: number 
  } | null>(null);

  const interactionStartPosRef = useRef({ x: 0, y: 0 });
  const [canNavigate, setCanNavigate] = useState(true);
  
  // Helper function for auth headers
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${tokens?.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load saved machines on mount
  useEffect(() => {
    console.log('[MachinesPage] Component mounted, checking localStorage...');
    const saved = localStorage.getItem('wit-machines');
    
    if (saved) {
      try {
        const parsedMachines = JSON.parse(saved);
        console.log('[MachinesPage] Found', parsedMachines.length, 'saved machines');
        setMachines(parsedMachines);
      } catch (error) {
        console.error('[MachinesPage] Failed to parse saved machines:', error);
        localStorage.removeItem('wit-machines');
      }
    } else {
      console.log('[MachinesPage] No saved machines found');
    }
  }, []);

  useEffect(() => {
    console.log('[MachinesPage] Saving', machines.length, 'machines to localStorage');
    localStorage.setItem('wit-machines', JSON.stringify(machines));
    // Dispatch event to notify widgets
    window.dispatchEvent(new Event('machines-updated'));
  }, [machines]);

  // Update machine details when type changes
  useEffect(() => {
    const typeConfig = MACHINE_TYPES[newMachine.type];
    if (typeConfig) {
      setNewMachine(prev => ({
        ...prev,
        name: prev.name || typeConfig.defaultName,
        connectionType: typeConfig.defaultConnection,
        manufacturer: prev.manufacturer || typeConfig.manufacturers[0],
        username: 'maker',
        password: '',
        apiKey: ''
      }));
    }
  }, [newMachine.type]);

  // Calculate grid dimensions
  useEffect(() => {
    const calculateGrid = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const leftPadding = 32;
      const rightPadding = 24;
      const topPadding = 24;
      const bottomPadding = 24;
      const gap = 16;
      
      const availableWidth = container.clientWidth - leftPadding - rightPadding;
      const availableHeight = container.clientHeight - topPadding - bottomPadding;

      const cellWidth = (availableWidth - (gap * (gridCols - 1))) / gridCols;
      const cellHeight = (availableHeight - (gap * (gridRows - 1))) / gridRows;

      setGridSize({ cellWidth, cellHeight });
    };

    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [gridCols, gridRows]);

  // Filter and sort machines
  const filteredMachines = machines.filter(machine => {
    if (filterStatus === 'all') return true;
    return machine.status === filterStatus;
  });

  const sortedMachines = [...filteredMachines].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        const statusOrder = { red: 0, yellow: 1, green: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      case 'date':
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      default:
        return 0;
    }
  });

  // Pagination
  const machinesPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(sortedMachines.length / machinesPerPage);
  const startIndex = (currentPage - 1) * machinesPerPage;
  const currentMachines = sortedMachines.slice(startIndex, startIndex + machinesPerPage);

  // Check if cursor is near edge of widget
  const getResizeDirection = (e: React.MouseEvent, element: HTMLElement): ResizeDirection | null => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeSize = 10;
    
    const nearTop = y < edgeSize;
    const nearBottom = y > rect.height - edgeSize;
    const nearLeft = x < edgeSize;
    const nearRight = x > rect.width - edgeSize;
    
    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    
    return null;
  };

  // Get cursor style based on resize direction
  const getCursorStyle = (direction: ResizeDirection | null): string => {
    if (!direction) return 'move';
    const cursorMap: Record<ResizeDirection, string> = {
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize',
      'ne': 'nesw-resize',
      'nw': 'nwse-resize',
      'se': 'nwse-resize',
      'sw': 'nesw-resize'
    };
    return cursorMap[direction];
  };

  const handleMouseDown = (e: React.MouseEvent, machine: Machine) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    
    interactionStartPosRef.current = { x: e.clientX, y: e.clientY };
    setCanNavigate(true);
    
    if (direction) {
      // Start resizing
      isResizingRef.current = true;
      resizedMachineRef.current = machine;
      resizeDirectionRef.current = direction;
      const size = machine.size || { width: 1, height: 1 };
      const position = machine.position || { x: 0, y: 0 };
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
        posX: position.x,
        posY: position.y
      };
      e.preventDefault();
    } else {
      // Start dragging
      isDraggingRef.current = true;
      draggedMachineRef.current = machine;
      const rect = element.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent, machine: Machine) => {
    const element = e.currentTarget as HTMLElement;
    const direction = getResizeDirection(e, element);
    element.style.cursor = getCursorStyle(direction);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - interactionStartPosRef.current.x);
      const deltaY = Math.abs(e.clientY - interactionStartPosRef.current.y);
      if (deltaX > 5 || deltaY > 5) {
        setCanNavigate(false);
      }
      
      if (isDraggingRef.current && draggedMachineRef.current) {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const gap = 16;
        
        const newX = e.clientX - rect.left - dragOffsetRef.current.x;
        const newY = e.clientY - rect.top - dragOffsetRef.current.y;

        setDragPosition({ x: newX, y: newY });
      } else if (isResizingRef.current && resizedMachineRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        const gap = 16;
        const dir = resizeDirectionRef.current;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = resizeStartRef.current.posX;
        let newY = resizeStartRef.current.posY;
        
        const cellsX = Math.round(deltaX / (gridSize.cellWidth + gap));
        const cellsY = Math.round(deltaY / (gridSize.cellHeight + gap));
        
        if (dir.includes('e')) {
          newWidth = Math.max(1, resizeStartRef.current.width + cellsX);
        }
        if (dir.includes('w')) {
          const widthChange = Math.min(resizeStartRef.current.width - 1, cellsX);
          newWidth = resizeStartRef.current.width - widthChange;
          newX = resizeStartRef.current.posX + widthChange;
        }
        if (dir.includes('s')) {
          newHeight = Math.max(1, resizeStartRef.current.height + cellsY);
        }
        if (dir.includes('n')) {
          const heightChange = Math.min(resizeStartRef.current.height - 1, cellsY);
          newHeight = resizeStartRef.current.height - heightChange;
          newY = resizeStartRef.current.posY + heightChange;
        }
        
        newWidth = Math.min(newWidth, gridCols - (dir.includes('w') ? newX : resizeStartRef.current.posX));
        newHeight = Math.min(newHeight, gridRows - (dir.includes('n') ? newY : resizeStartRef.current.posY));
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        setResizePreview({ width: newWidth, height: newHeight, x: newX, y: newY });
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && draggedMachineRef.current && dragPosition) {
        const gap = 16;
        const cellWidth = gridSize.cellWidth + gap;
        const cellHeight = gridSize.cellHeight + gap;

        const gridX = Math.round(dragPosition.x / cellWidth);
        const gridY = Math.round(dragPosition.y / cellHeight);

        const machine = draggedMachineRef.current;
        const size = machine.size || { width: 1, height: 1 };

        const finalX = Math.max(0, Math.min(gridCols - size.width, gridX));
        const finalY = Math.max(0, Math.min(gridRows - size.height, gridY));

        if (!isPositionOccupied(finalX, finalY, size.width, size.height, machine.id)) {
          setMachines(prevMachines =>
            prevMachines.map(m =>
              m.id === machine.id
                ? { ...m, position: { x: finalX, y: finalY } }
                : m
            )
          );
        }
      } else if (isResizingRef.current && resizedMachineRef.current && resizePreview) {
        const machine = resizedMachineRef.current;
        const newX = resizePreview.x !== undefined ? resizePreview.x : (machine.position?.x || 0);
        const newY = resizePreview.y !== undefined ? resizePreview.y : (machine.position?.y || 0);

        if (!isPositionOccupied(newX, newY, resizePreview.width, resizePreview.height, machine.id)) {
          setMachines(prevMachines =>
            prevMachines.map(m =>
              m.id === machine.id
                ? { 
                    ...m, 
                    size: { width: resizePreview.width, height: resizePreview.height },
                    position: { x: newX, y: newY }
                  }
                : m
            )
          );
        }
      }

      isDraggingRef.current = false;
      draggedMachineRef.current = null;
      setDragPosition(null);
      isResizingRef.current = false;
      resizedMachineRef.current = null;
      setResizePreview(null);
      
      setTimeout(() => {
        setCanNavigate(true);
      }, 100);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragPosition, gridSize, gridCols, gridRows, resizePreview, machines]);

  const isPositionOccupied = (x: number, y: number, width: number, height: number, excludeId?: string): boolean => {
    return currentMachines.some(machine => {
      if (machine.id === excludeId) return false;
      
      const mPos = machine.position || { x: 0, y: 0 };
      const mSize = machine.size || { width: 1, height: 1 };
      
      const collision = !(
        x + width <= mPos.x ||
        x >= mPos.x + mSize.width ||
        y + height <= mPos.y ||
        y >= mPos.y + mSize.height
      );
      
      return collision;
    });
  };

  const findAvailablePosition = (width: number, height: number): { x: number, y: number } | null => {
    for (let y = 0; y <= gridRows - height; y++) {
      for (let x = 0; x <= gridCols - width; x++) {
        if (!isPositionOccupied(x, y, width, height)) {
          return { x, y };
        }
      }
    }
    return null;
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const requestBody: any = {
        connection_type: newMachine.connectionType.replace('network-', ''),
      };

      if (newMachine.connectionType === 'network-prusalink') {
        requestBody.url = newMachine.connectionDetails.replace(/^https?:\/\//, '').replace(/\/$/, '');
        requestBody.username = newMachine.username || 'maker';
        requestBody.password = newMachine.password;
        
        if (!requestBody.password) {
          setConnectionTestResult({ 
            success: false, 
            message: 'Password is required for PrusaLink' 
          });
          setTestingConnection(false);
          return;
        }
      } else if (newMachine.connectionType === 'network-octoprint') {
        requestBody.url = newMachine.connectionDetails;
        requestBody.api_key = newMachine.apiKey;
        
        if (!requestBody.api_key) {
          setConnectionTestResult({ 
            success: false, 
            message: 'API key is required for OctoPrint' 
          });
          setTestingConnection(false);
          return;
        }
      } else {
        requestBody.port = newMachine.connectionDetails;
      }

      console.log('[MachinesPage] Testing connection with:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MachinesPage] Test connection failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[MachinesPage] Test connection result:', result);
      
      setConnectionTestResult({ 
        success: result.success, 
        message: result.message 
      });
      
    } catch (error: any) {
      console.error('[MachinesPage] Connection test error:', error);
      setConnectionTestResult({ 
        success: false, 
        message: error.message || 'Could not reach backend. Is dev_server.py running?' 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const scanSerialPorts = async () => {
    setScanningPorts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/microcontrollers/ports`, {
        headers: {
          'Authorization': `Bearer ${tokens?.access_token}`
        }
      });
      if (response.ok) {
        const ports = await response.json();
        setAvailableSerialPorts(ports);
      }
    } catch (error) {
      console.error('Failed to scan serial ports:', error);
    } finally {
      setScanningPorts(false);
    }
  };

  const handleAddMachine = async () => {
    if (!isAuthenticated) {
      alert('Please login first to add machines');
      return;
    }

    const machineId = `M${Date.now()}`;
    const typeConfig = MACHINE_TYPES[newMachine.type];
    
    const position = findAvailablePosition(1, 1);
    if (!position) {
      alert('No space available! Please remove machines or increase grid size.');
      return;
    }
    
    const newMachineData: Machine = {
      id: machineId,
      name: newMachine.name || typeConfig.defaultName,
      type: newMachine.type,
      status: 'yellow',
      metrics: [
        { label: 'Status', value: 'Connecting...' },
        { label: 'Connection', value: CONNECTION_CONFIGS[newMachine.connectionType]?.label || newMachine.connectionType }
      ],
      connectionType: newMachine.connectionType as any,
      connectionDetails: newMachine.connectionDetails,
      manufacturer: newMachine.manufacturer,
      model: newMachine.model,
      notes: newMachine.notes,
      dateAdded: new Date().toISOString(),
      position: position,
      size: { width: 1, height: 1 },
      username: newMachine.connectionType === 'network-prusalink' ? newMachine.username : undefined,
      password: newMachine.connectionType === 'network-prusalink' ? newMachine.password : undefined,
      apiKey: newMachine.connectionType === 'network-octoprint' ? newMachine.apiKey : undefined
    };

    setMachines(prevMachines => {
      const newMachines = [...prevMachines, newMachineData];
      console.log('[MachinesPage] Adding machine, new total:', newMachines.length);
      return newMachines;
    });
    
    setNewMachine({
      type: '3d-printer',
      name: '',
      connectionType: 'usb',
      connectionDetails: '',
      username: 'maker',
      password: '',
      apiKey: '',
      manufacturer: '',
      model: '',
      notes: '',
      baudRate: '115200'
    });
    
    setShowAddModal(false);
    setConnectionTestResult(null);

    if (newMachine.connectionType.startsWith('network')) {
      try {
        const apiRequest: any = {
          printer_id: machineId,
          name: newMachine.name || typeConfig.defaultName,
          connection_type: newMachine.connectionType.replace('network-', ''),
          manufacturer: newMachine.manufacturer,
          model: newMachine.model,
          notes: newMachine.notes
        };

        if (newMachine.connectionType === 'network-prusalink') {
          apiRequest.url = newMachine.connectionDetails;
          apiRequest.username = newMachine.username;
          apiRequest.password = newMachine.password;
        } else if (newMachine.connectionType === 'network-octoprint') {
          apiRequest.url = newMachine.connectionDetails;
          apiRequest.api_key = newMachine.apiKey;
        }

        console.log('[MachinesPage] Adding printer to backend:', apiRequest);

        const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(apiRequest)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[MachinesPage] Printer added to backend:', result);
          
          // Start polling for real status immediately
          const pollStatus = async (attempts = 0) => {
            if (attempts > 10) return; // Give up after 10 attempts
            
            try {
              const statusResponse = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/${machineId}`, {
                headers: getAuthHeaders()
              });
              
              if (statusResponse.ok) {
                const status = await statusResponse.json();
                console.log('[MachinesPage] Got printer status:', status);
                updateMachineFromPrinterStatus(machineId, status);
                
                // If still connecting, poll again
                if (!status.connected && attempts < 10) {
                  setTimeout(() => pollStatus(attempts + 1), 2000);
                }
              }
            } catch (error) {
              console.error('[MachinesPage] Failed to get printer status:', error);
              // Retry
              if (attempts < 10) {
                setTimeout(() => pollStatus(attempts + 1), 2000);
              }
            }
          };
          
          // Start polling after a short delay
          setTimeout(() => pollStatus(), 1000);
        } else {
          const errorText = await response.text();
          console.error('[MachinesPage] Failed to add printer to backend:', response.status, errorText);
          if (response.status === 401) {
            alert('Authentication expired. Please login again.');
            AuthTokens.removeToken();
            window.location.reload();
          }
        }
      } catch (error) {
        console.warn('[MachinesPage] Backend API not available, machine added locally only:', error);
        setTimeout(() => {
          setMachines(prev => prev.map(m => 
            m.id === machineId 
              ? { 
                  ...m, 
                  status: 'red',
                  metrics: [
                    { label: 'Status', value: 'Backend Offline' },
                    { label: 'Connection', value: CONNECTION_CONFIGS[newMachine.connectionType]?.label || newMachine.connectionType }
                  ]
                }
              : m
          ));
        }, 2000);
      }
    }
  };

  const handleDeleteMachine = async (machineId: string) => {
    console.log('[MachinesPage] Deleting machine:', machineId);
    
    // Remove from local state immediately
    setMachines(prevMachines => prevMachines.filter(m => m.id !== machineId));
    
    // Try to delete from backend if connected
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/equipment/printers/${machineId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        console.log('[MachinesPage] Machine deleted from backend');
      } else {
        console.warn('[MachinesPage] Failed to delete machine from backend:', response.status);
      }
    } catch (error) {
      console.warn('[MachinesPage] Backend API not available, machine deleted locally only:', error);
    }
  };

  const navigateToMachine = (machineId: string) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(machineId);
    } else {
      console.log(`Navigate to machine ${machineId}`);
    }
  };

  const getConnectionPlaceholder = () => {
    return CONNECTION_CONFIGS[newMachine.connectionType]?.placeholder || 'Enter connection details';
  };

  return (
    <div className="h-full bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-4">Machines</h1>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!isAuthenticated}
            className={`w-full ${isAuthenticated 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-600 cursor-not-allowed'} 
              text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors`}
          >
            <FaPlus />
            {isAuthenticated ? 'Add Machine' : 'Login to Add Machine'}
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Connection Status */}
          <div className="bg-gray-700 rounded p-3">
            <WebSocketStatus status={wsStatus} />
            {wsStatus === 'failed' && (
              <p className="text-xs text-gray-400 mt-1">
                Polling for updates instead
              </p>
            )}
          </div>

          {/* Filter */}
          <div>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <FaFilter className="w-4 h-4" />
              <span className="font-medium">Filter by Status</span>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="all">All Machines</option>
              <option value="green">Online</option>
              <option value="yellow">Warning</option>
              <option value="red">Offline</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <FaSortAmountDown className="w-4 h-4" />
              <span className="font-medium">Sort by</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="date">Date Added</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Grid Size */}
          <div>
            <label className="block text-gray-300 mb-3 font-medium">Grid Size</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Columns</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={gridCols}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setGridCols(Math.max(1, Math.min(8, val)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-1"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Rows</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={gridRows}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setGridRows(Math.max(1, Math.min(8, val)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-1"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-700 rounded p-4">
            <h3 className="text-white font-medium mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-white">{machines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Online:</span>
                <span className="text-green-400">{machines.filter(m => m.status === 'green').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Warning:</span>
                <span className="text-yellow-400">{machines.filter(m => m.status === 'yellow').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Offline:</span>
                <span className="text-red-400">{machines.filter(m => m.status === 'red').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto relative">
        <div
          ref={containerRef}
          className="relative h-full"
          style={{ minHeight: '400px' }}
        >
          {/* Machine Grid */}
          {currentMachines.map((machine, index) => {
            const position = machine.position || { x: index % gridCols, y: Math.floor(index / gridCols) };
            const size = machine.size || { width: 1, height: 1 };
            const gap = 16;
            
            const isDragging = isDraggingRef.current && draggedMachineRef.current?.id === machine.id;
            const isResizing = isResizingRef.current && resizedMachineRef.current?.id === machine.id;
            
            const displayPosition = (isDragging && dragPosition) 
              ? dragPosition 
              : (isResizing && resizePreview && (resizePreview.x !== undefined || resizePreview.y !== undefined))
              ? { x: (resizePreview.x !== undefined ? resizePreview.x : position.x) * (gridSize.cellWidth + gap), 
                  y: (resizePreview.y !== undefined ? resizePreview.y : position.y) * (gridSize.cellHeight + gap) }
              : { x: position.x * (gridSize.cellWidth + gap), y: position.y * (gridSize.cellHeight + gap) };
            
            const displaySize = (isResizing && resizePreview) 
              ? { width: resizePreview.width, height: resizePreview.height }
              : size;
            
            const style = {
              position: 'absolute' as const,
              left: `${displayPosition.x}px`,
              top: `${displayPosition.y}px`,
              width: `${displaySize.width * gridSize.cellWidth + (displaySize.width - 1) * gap}px`,
              height: `${displaySize.height * gridSize.cellHeight + (displaySize.height - 1) * gap}px`,
              transition: isDragging || isResizing ? 'none' : 'all 0.2s ease-in-out',
              zIndex: isDragging || isResizing ? 1000 : 1,
              opacity: isDragging ? 0.8 : 1,
            };

            return (
              <div
                key={machine.id}
                style={style}
                className={`widget-container group relative ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} h-full`}
                onMouseDown={(e) => handleMouseDown(e, machine)}
                onMouseMove={(e) => handleMouseMove(e, machine)}
                onMouseLeave={(e) => {
                  if (!isDraggingRef.current && !isResizingRef.current) {
                    (e.currentTarget as HTMLElement).style.cursor = 'default';
                  }
                }}
              >
                <SpecificWidget
                  type="machine"
                  data={machine}
                  onRemove={() => handleDeleteMachine(machine.id)}
                  onNavigate={() => {
                    if (canNavigate && !isDraggingRef.current && !isResizingRef.current) {
                      navigateToMachine(machine.id);
                    }
                  }}
                />
              </div>
            );
          })}
          
          {/* Grid overlay */}
          {(isDraggingRef.current || isResizingRef.current) && (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: gridRows * gridCols }, (_, index) => {
                const row = Math.floor(index / gridCols);
                const col = index % gridCols;
                const gap = 16;
                
                return (
                  <div
                    key={`grid-cell-${index}`}
                    className="absolute border border-dashed border-gray-500 opacity-30"
                    style={{
                      left: `${col * (gridSize.cellWidth + gap)}px`,
                      top: `${row * (gridSize.cellHeight + gap)}px`,
                      width: `${gridSize.cellWidth}px`,
                      height: `${gridSize.cellHeight}px`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gray-800 px-3 py-2 rounded shadow-lg">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronLeft className="text-white" />
            </button>
            <span className="text-white px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronRight className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add New Machine</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setConnectionTestResult(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Machine Type */}
              <div>
                <label className="block text-gray-300 mb-1">Machine Type</label>
                <select
                  value={newMachine.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const typeConfig = MACHINE_TYPES[type];
                    setNewMachine({
                      ...newMachine,
                      type,
                      name: typeConfig.defaultName,
                      connectionType: typeConfig.defaultConnection,
                      manufacturer: typeConfig.manufacturers[0],
                      username: 'maker',
                      password: '',
                      apiKey: ''
                    });
                    setConnectionTestResult(null);
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <optgroup label="Workshop Equipment">
                    <option value="3d-printer">3D Printer</option>
                    <option value="laser-cutter">Laser Cutter</option>
                    <option value="cnc-mill">CNC Mill</option>
                    <option value="vinyl-cutter">Vinyl Cutter</option>
                    <option value="soldering">Soldering Station</option>
                    <option value="custom">Custom Equipment</option>
                  </optgroup>
                  <optgroup label="Microcontrollers">
                    <option value="arduino-uno">Arduino Uno</option>
                    <option value="arduino-mega">Arduino Mega</option>
                    <option value="arduino-nano">Arduino Nano</option>
                    <option value="esp32">ESP32</option>
                    <option value="esp8266">ESP8266</option>
                    <option value="raspberry-pi">Raspberry Pi</option>
                    <option value="raspberry-pi-pico">Raspberry Pi Pico</option>
                  </optgroup>
                </select>
              </div>

              {/* Machine Name */}
              <div>
                <label className="block text-gray-300 mb-1">Machine Name</label>
                <input
                  type="text"
                  value={newMachine.name}
                  onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                  placeholder={MACHINE_TYPES[newMachine.type].defaultName}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-gray-300 mb-1">Connection Type</label>
                <select
                  value={newMachine.connectionType}
                  onChange={(e) => {
                    setNewMachine({ 
                      ...newMachine, 
                      connectionType: e.target.value as any,
                      connectionDetails: '',
                      username: 'maker',
                      password: '',
                      apiKey: ''
                    });
                    setConnectionTestResult(null);
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {MACHINE_TYPES[newMachine.type].connectionTypes.map(type => (
                    <option key={type} value={type}>
                      {CONNECTION_CONFIGS[type]?.label || type.toUpperCase()}
                    </option>
                  ))}
                </select>
                {CONNECTION_CONFIGS[newMachine.connectionType]?.helperText && (
                  <p className="text-xs text-gray-400 mt-1">
                    {CONNECTION_CONFIGS[newMachine.connectionType].helperText}
                  </p>
                )}
              </div>

              {/* Connection Details */}
              <div>
                <label className="block text-gray-300 mb-1">
                  {newMachine.connectionType.includes('network') ? 'IP Address/URL' : 'Port/Address'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMachine.connectionDetails}
                    onChange={(e) => {
                      setNewMachine({ ...newMachine, connectionDetails: e.target.value });
                      setConnectionTestResult(null);
                    }}
                    placeholder={getConnectionPlaceholder()}
                    className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
                  />
                  {/* Show scan button for USB/Serial connections on microcontrollers */}
                  {(newMachine.connectionType === 'usb' || newMachine.connectionType === 'serial') && 
                   (newMachine.type.includes('arduino') || newMachine.type.includes('esp') || newMachine.type.includes('raspberry-pi')) && (
                    <button
                      onClick={scanSerialPorts}
                      disabled={scanningPorts}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      {scanningPorts ? 'Scanning...' : 'Scan Ports'}
                    </button>
                  )}
                </div>
                {/* Show available ports dropdown */}
                {availableSerialPorts.length > 0 && (
                  <select
                    className="w-full mt-2 bg-gray-700 text-white rounded px-3 py-2"
                    onChange={(e) => {
                      setNewMachine({ ...newMachine, connectionDetails: e.target.value });
                      setConnectionTestResult(null);
                    }}
                    value={newMachine.connectionDetails}
                  >
                    <option value="">Select a port...</option>
                    {availableSerialPorts.map(port => (
                      <option key={port.port} value={port.port}>
                        {port.port} - {port.description}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Baud Rate for Serial/USB microcontrollers */}
              {(newMachine.connectionType === 'usb' || newMachine.connectionType === 'serial') && 
               (newMachine.type.includes('arduino') || newMachine.type.includes('esp') || newMachine.type.includes('raspberry-pi')) && (
                <div>
                  <label className="block text-gray-300 mb-1">Baud Rate</label>
                  <select
                    value={newMachine.baudRate}
                    onChange={(e) => setNewMachine({ ...newMachine, baudRate: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  >
                    <option value="9600">9600</option>
                    <option value="14400">14400</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="115200">115200</option>
                    <option value="128000">128000</option>
                    <option value="256000">256000</option>
                  </select>
                </div>
              )}

              {/* PrusaLink Authentication */}
              {newMachine.connectionType === 'network-prusalink' && (
                <>
                  <div>
                    <label className="block text-gray-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={newMachine.username}
                      onChange={(e) => {
                        setNewMachine({ ...newMachine, username: e.target.value });
                        setConnectionTestResult(null);
                      }}
                      placeholder="Default: maker"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Find in printer: Settings → Network → PrusaLink
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={newMachine.password}
                      onChange={(e) => {
                        setNewMachine({ ...newMachine, password: e.target.value });
                        setConnectionTestResult(null);
                      }}
                      placeholder="Enter PrusaLink password"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Password shown on printer display
                    </p>
                  </div>
                </>
              )}

              {/* OctoPrint API Key */}
              {newMachine.connectionType === 'network-octoprint' && (
                <div>
                  <label className="block text-gray-300 mb-1">API Key</label>
                  <input
                    type="password"
                    value={newMachine.apiKey}
                    onChange={(e) => {
                      setNewMachine({ ...newMachine, apiKey: e.target.value });
                      setConnectionTestResult(null);
                    }}
                    placeholder="Enter API key"
                    className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Get from OctoPrint Settings → API
                  </p>
                </div>
              )}

              {/* Test Connection Button */}
              {newMachine.connectionDetails && (
                <div>
                  <button
                    onClick={testConnection}
                    disabled={testingConnection || 
                      (newMachine.connectionType === 'network-prusalink' && !newMachine.password) ||
                      (newMachine.connectionType === 'network-octoprint' && !newMachine.apiKey)
                    }
                    className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center gap-2"
                  >
                    {testingConnection ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                  
                  {connectionTestResult && (
                    <div className={`mt-2 p-3 rounded flex items-center gap-2 ${
                      connectionTestResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                    }`}>
                      {connectionTestResult.success ? (
                        <FaCheckCircle className="flex-shrink-0" />
                      ) : (
                        <FaExclamationCircle className="flex-shrink-0" />
                      )}
                      <span className="text-sm">{connectionTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Manufacturer */}
              <div>
                <label className="block text-gray-300 mb-1">Manufacturer</label>
                <select
                  value={newMachine.manufacturer}
                  onChange={(e) => setNewMachine({ ...newMachine, manufacturer: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  {MACHINE_TYPES[newMachine.type].manufacturers.map(mfg => (
                    <option key={mfg} value={mfg}>{mfg}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-gray-300 mb-1">Model (Optional)</label>
                <input
                  type="text"
                  value={newMachine.model}
                  onChange={(e) => setNewMachine({ ...newMachine, model: e.target.value })}
                  placeholder="e.g., XL 5-tool, MK4, MINI+"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={newMachine.notes}
                  onChange={(e) => setNewMachine({ ...newMachine, notes: e.target.value })}
                  placeholder="Additional details, location, or configuration notes"
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddMachine}
                disabled={!newMachine.connectionDetails || 
                  (newMachine.connectionType === 'network-prusalink' && !newMachine.password) ||
                  (newMachine.connectionType === 'network-octoprint' && !newMachine.apiKey)
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Add Machine
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setConnectionTestResult(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachinesPage;