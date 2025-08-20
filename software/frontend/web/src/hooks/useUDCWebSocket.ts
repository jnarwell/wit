import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UDCPlugin {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  description?: string;
  icon?: string;
  permissions?: string[];
}

interface UDCStatus {
  connected: boolean;
  plugins: UDCPlugin[];
  version?: string;
}

interface UseUDCWebSocketReturn {
  status: UDCStatus;
  wsStatus: 'connected' | 'disconnected' | 'connecting' | 'failed';
  sendCommand: (plugin: string, command: string, args?: any) => Promise<any>;
  refreshStatus: () => void;
  resetConnection: () => void;
  lastPluginResponse: any | null;
}

const WS_RECONNECT_DELAY = 5000;
const WS_MAX_RECONNECT_ATTEMPTS = 3;

export const useUDCWebSocket = (): UseUDCWebSocketReturn => {
  const { tokens } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingCommandsRef = useRef<Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }>>(new Map());
  
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'failed'>('disconnected');
  const [udcStatus, setUdcStatus] = useState<UDCStatus>({
    connected: false,
    plugins: []
  });
  const [lastPluginResponse, setLastPluginResponse] = useState<any | null>(null);

  const sendCommand = useCallback((plugin: string, command: string, args?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const messageId = `${Date.now()}-${Math.random()}`;
        const message = {
          type: 'plugin_command',
          pluginId: plugin,
          command,
          args: args || {},
          messageId
        };
        
        // Store the promise handlers
        pendingCommandsRef.current.set(messageId, { resolve, reject });
        
        // Set a timeout to reject if no response
        setTimeout(() => {
          if (pendingCommandsRef.current.has(messageId)) {
            pendingCommandsRef.current.delete(messageId);
            reject(new Error('Command timeout'));
          }
        }, 30000); // 30 second timeout
        
        console.log('[UDC WebSocket] Sending command:', message);
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[UDC WebSocket] Cannot send command - WebSocket not connected');
        reject(new Error('WebSocket not connected'));
      }
    });
  }, []);

  const refreshStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Request plugin list to get fresh status
      wsRef.current.send(JSON.stringify({
        type: 'plugin_list',
        requestId: `refresh-${Date.now()}`
      }));
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!tokens?.access_token) {
      console.log('[UDC WebSocket] No auth token available');
      return;
    }

    if (reconnectAttemptsRef.current >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.log('[UDC WebSocket] Max reconnection attempts reached');
      setWsStatus('failed');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsStatus === 'connecting') {
      return;
    }

    setWsStatus('connecting');
    console.log(`[UDC WebSocket] Connecting... (attempt ${reconnectAttemptsRef.current + 1}/${WS_MAX_RECONNECT_ATTEMPTS})`);

    try {
      const ws = new WebSocket('ws://localhost:8000/ws/desktop-controller');
      
      ws.onopen = () => {
        console.log('[UDC WebSocket] Connected successfully');
        setWsStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Send registration message
        ws.send(JSON.stringify({
          type: 'register',
          controllerId: `web-ui-${Date.now()}`,
          token: tokens.access_token
        }));
        
        // Request plugin status after registration
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'plugin_list',
            requestId: `init-${Date.now()}`
          }));
        }, 200);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'registration_ack':
              console.log('[UDC WebSocket] Registration acknowledged:', data.controllerId);
              // Don't set connected to true here - wait for plugin list
              break;
              
            case 'plugin_list':
              console.log('[UDC WebSocket] Received plugin list:', data);
              // Check if we have actual plugins - only connected if real plugins exist
              const hasPlugins = data.plugins && data.plugins.length > 0;
              setUdcStatus({
                connected: hasPlugins, // Only connected if there are actual plugins
                plugins: data.plugins || [],
                version: data.version
              });
              break;
              
            case 'plugin_response':
              console.log('[UDC WebSocket] Received plugin response:', data);
              // Store the latest plugin response for subscribers
              setLastPluginResponse(data);
              
              // Resolve pending command if there's a matching messageId
              if (data.messageId && pendingCommandsRef.current.has(data.messageId)) {
                const { resolve, reject } = pendingCommandsRef.current.get(data.messageId)!;
                pendingCommandsRef.current.delete(data.messageId);
                
                // Check if there's an error property
                if (data.error) {
                  reject(new Error(data.error));
                } else if (data.result !== undefined) {
                  // Return the result directly
                  resolve(data.result);
                } else {
                  // Fallback to old behavior for compatibility
                  resolve(data);
                }
              }
              
              // Check if the response indicates no controller available
              if (data.error && data.error.includes('No desktop controller available')) {
                setUdcStatus(prev => ({ 
                  ...prev, 
                  connected: false,
                  plugins: [] 
                }));
              }
              break;
              
            case 'plugin_status':
              console.log('[UDC WebSocket] Received plugin status update:', data);
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: data.status } : p
                )
              }));
              // Also refresh the full plugin list to get latest states
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'plugin_list',
                    requestId: `status-refresh-${Date.now()}`
                  }));
                }
              }, 100);
              break;
              
            case 'plugin_started':
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: 'active' } : p
                )
              }));
              // Refresh plugin list to get full updated status
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'plugin_list',
                    requestId: `started-refresh-${Date.now()}`
                  }));
                }
              }, 100);
              break;
              
            case 'plugin_stopped':
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: 'inactive' } : p
                )
              }));
              // Refresh plugin list to get full updated status
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'plugin_list',
                    requestId: `stopped-refresh-${Date.now()}`
                  }));
                }
              }, 100);
              break;
              
            case 'error':
              console.error('[UDC WebSocket] Error:', data.message);
              break;
              
            default:
              console.log('[UDC WebSocket] Unhandled message type:', data.type, data);
          }
        } catch (error) {
          console.error('[UDC WebSocket] Message parsing error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[UDC WebSocket] Error:', error);
        reconnectAttemptsRef.current++;
      };

      ws.onclose = (event) => {
        console.log('[UDC WebSocket] Disconnected', event.code, event.reason);
        wsRef.current = null;
        setWsStatus('disconnected');
        setUdcStatus({
          connected: false,
          plugins: []
        });

        // Don't reconnect if the close was intentional or if the connection was never established
        if (event.code === 1000 || event.code === 1001) {
          console.log('[UDC WebSocket] Clean disconnect, not reconnecting');
          return;
        }

        // Only reconnect if we haven't reached the max attempts and there was a real connection before
        if (reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Exponential backoff: 5s, 10s, 20s
          const delay = WS_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`[UDC WebSocket] Will retry in ${delay/1000}s`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else {
          console.log('[UDC WebSocket] Max reconnection attempts reached, giving up');
          setWsStatus('failed');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[UDC WebSocket] Failed to create WebSocket:', error);
      setWsStatus('failed');
      reconnectAttemptsRef.current++;
    }
  }, [tokens, wsStatus]);

  const resetConnection = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setWsStatus('disconnected');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    // Avoid connecting twice in strict mode
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Don't close the connection immediately - let it stay open
      // The next effect run will reuse the existing connection
    };
  }, [connectWebSocket]);
  
  // Separate cleanup effect for true unmounting
  useEffect(() => {
    return () => {
      // This only runs when the component is truly unmounting
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Periodic refresh to keep plugin status in sync
  useEffect(() => {
    if (wsStatus !== 'connected') return;

    const intervalId = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'plugin_list',
          requestId: `periodic-refresh-${Date.now()}`
        }));
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(intervalId);
  }, [wsStatus]);

  return {
    status: udcStatus,
    wsStatus,
    sendCommand,
    refreshStatus,
    resetConnection,
    lastPluginResponse
  };
};