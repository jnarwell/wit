// MCP (Model Context Protocol) Service
// Handles communication with external AI models through MCP

interface MCPSettings {
  enabled: boolean;
  serverUrl: string;
  apiKey: string;
  autoSync: boolean;
  syncInterval: number;
  dataPermissions: {
    machines: boolean;
    projects: boolean;
    sensors: boolean;
    tasks: boolean;
    files: boolean;
    analytics: boolean;
    userProfile: boolean;
  };
  modelPermissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
    delete: boolean;
  };
  trustedModels: string[];
}

interface MCPMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  model: string;
  action: string;
  data?: any;
  timestamp: Date;
}

interface MCPContext {
  machines?: any[];
  projects?: any[];
  sensors?: any[];
  tasks?: any[];
  files?: any[];
  analytics?: any;
  userProfile?: any;
}

class MCPService {
  private settings: MCPSettings | null = null;
  private ws: WebSocket | null = null;
  private messageQueue: MCPMessage[] = [];
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(message: MCPMessage) => void>> = new Map();

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    const saved = localStorage.getItem('wit-mcp-settings');
    if (saved) {
      this.settings = JSON.parse(saved);
      if (this.settings?.enabled) {
        this.connect();
      }
    }
  }

  public updateSettings(settings: MCPSettings) {
    this.settings = settings;
    localStorage.setItem('wit-mcp-settings', JSON.stringify(settings));
    
    if (settings.enabled && !this.isConnected) {
      this.connect();
    } else if (!settings.enabled && this.isConnected) {
      this.disconnect();
    }

    if (settings.enabled && settings.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  private connect() {
    if (!this.settings || !this.settings.serverUrl) return;

    try {
      this.ws = new WebSocket(this.settings.serverUrl);
      
      this.ws.onopen = () => {
        console.log('[MCP] Connected to server');
        this.isConnected = true;
        this.authenticate();
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        const message: MCPMessage = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('[MCP] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[MCP] Disconnected from server');
        this.isConnected = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[MCP] Failed to connect:', error);
    }
  }

  private disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private authenticate() {
    if (!this.settings?.apiKey) return;

    this.send({
      id: this.generateId(),
      type: 'request',
      model: 'system',
      action: 'authenticate',
      data: { apiKey: this.settings.apiKey },
      timestamp: new Date()
    });
  }

  private scheduleReconnect() {
    if (!this.settings?.enabled || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      console.log('[MCP] Attempting to reconnect...');
      this.connect();
    }, 5000);
  }

  private startAutoSync() {
    if (!this.settings?.autoSync) return;

    this.stopAutoSync();
    const interval = (this.settings.syncInterval || 30) * 60 * 1000; // Convert to milliseconds
    
    this.syncTimer = setInterval(() => {
      this.syncContext();
    }, interval);

    // Initial sync
    this.syncContext();
  }

  private stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async syncContext() {
    if (!this.isConnected || !this.settings) return;

    const context: MCPContext = {};
    const permissions = this.settings.dataPermissions;

    // Gather permitted data
    if (permissions.machines) {
      const machines = localStorage.getItem('wit-machines');
      if (machines) context.machines = JSON.parse(machines);
    }

    if (permissions.projects) {
      const projects = localStorage.getItem('wit-projects');
      if (projects) context.projects = JSON.parse(projects);
    }

    if (permissions.sensors) {
      const sensors = localStorage.getItem('wit-sensors');
      if (sensors) context.sensors = JSON.parse(sensors);
    }

    if (permissions.tasks) {
      const tasks = localStorage.getItem('wit-tasks');
      if (tasks) context.tasks = JSON.parse(tasks);
    }

    // Send context update
    this.send({
      id: this.generateId(),
      type: 'event',
      model: 'system',
      action: 'context-update',
      data: context,
      timestamp: new Date()
    });
  }

  private send(message: MCPMessage) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) this.send(message);
    }
  }

  private handleMessage(message: MCPMessage) {
    console.log('[MCP] Received message:', message);

    // Check if model is trusted
    if (!this.isModelTrusted(message.model)) {
      console.warn('[MCP] Untrusted model attempted access:', message.model);
      return;
    }

    // Check permissions
    if (!this.hasPermission(message.action)) {
      console.warn('[MCP] Permission denied for action:', message.action);
      return;
    }

    // Notify listeners
    const listeners = this.listeners.get(message.action) || new Set();
    listeners.forEach(listener => listener(message));

    // Handle specific actions
    switch (message.action) {
      case 'read-data':
        this.handleReadData(message);
        break;
      case 'write-data':
        this.handleWriteData(message);
        break;
      case 'execute-command':
        this.handleExecuteCommand(message);
        break;
    }
  }

  private isModelTrusted(model: string): boolean {
    if (!this.settings) return false;
    return this.settings.trustedModels.includes(model) || model === 'system';
  }

  private hasPermission(action: string): boolean {
    if (!this.settings) return false;
    
    const permissions = this.settings.modelPermissions;
    if (action.startsWith('read-')) return permissions.read;
    if (action.startsWith('write-')) return permissions.write;
    if (action.startsWith('execute-')) return permissions.execute;
    if (action.startsWith('delete-')) return permissions.delete;
    
    return false;
  }

  private handleReadData(message: MCPMessage) {
    const { dataType, query } = message.data;
    const permissions = this.settings?.dataPermissions;
    
    if (!permissions || !permissions[dataType as keyof typeof permissions]) {
      this.sendResponse(message.id, { error: 'Permission denied' });
      return;
    }

    // Get requested data
    const data = localStorage.getItem(`wit-${dataType}`);
    if (data) {
      this.sendResponse(message.id, { data: JSON.parse(data) });
    } else {
      this.sendResponse(message.id, { error: 'Data not found' });
    }
  }

  private handleWriteData(message: MCPMessage) {
    const { dataType, data } = message.data;
    const permissions = this.settings?.dataPermissions;
    
    if (!permissions || !permissions[dataType as keyof typeof permissions]) {
      this.sendResponse(message.id, { error: 'Permission denied' });
      return;
    }

    // Update data
    localStorage.setItem(`wit-${dataType}`, JSON.stringify(data));
    this.sendResponse(message.id, { success: true });
    
    // Notify UI of changes
    window.dispatchEvent(new CustomEvent('mcp-data-update', { 
      detail: { dataType, data } 
    }));
  }

  private handleExecuteCommand(message: MCPMessage) {
    const { command, args } = message.data;
    
    // Execute allowed commands
    switch (command) {
      case 'refresh-data':
        window.location.reload();
        break;
      case 'navigate':
        if (window.__witNavigate) {
          window.__witNavigate(args.page, args.id);
        }
        break;
      default:
        this.sendResponse(message.id, { error: 'Unknown command' });
    }
  }

  private sendResponse(requestId: string, data: any) {
    this.send({
      id: this.generateId(),
      type: 'response',
      model: 'wit-system',
      action: 'response',
      data: { requestId, ...data },
      timestamp: new Date()
    });
  }

  public on(action: string, listener: (message: MCPMessage) => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(listener);
  }

  public off(action: string, listener: (message: MCPMessage) => void) {
    const listeners = this.listeners.get(action);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  public requestData(dataType: string, query?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handler = (message: MCPMessage) => {
        if (message.data?.requestId === id) {
          clearTimeout(timeout);
          this.off('response', handler);
          
          if (message.data.error) {
            reject(new Error(message.data.error));
          } else {
            resolve(message.data.data);
          }
        }
      };

      this.on('response', handler);

      this.send({
        id,
        type: 'request',
        model: 'wit-client',
        action: 'read-data',
        data: { dataType, query },
        timestamp: new Date()
      });
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      enabled: this.settings?.enabled || false,
      serverUrl: this.settings?.serverUrl || '',
      autoSync: this.settings?.autoSync || false
    };
  }
}

// Export singleton instance
export default new MCPService();