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
  sendCommand: (plugin: string, command: string, args?: any) => void;
  refreshStatus: () => void;
  lastPluginResponse: any | null;
}

const WS_RECONNECT_DELAY = 5000;
const WS_MAX_RECONNECT_ATTEMPTS = 3;

export const useUDCWebSocket = (): UseUDCWebSocketReturn => {
  const { tokens } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'failed'>('disconnected');
  const [udcStatus, setUdcStatus] = useState<UDCStatus>({
    connected: false,
    plugins: []
  });
  const [lastPluginResponse, setLastPluginResponse] = useState<any | null>(null);

  const sendCommand = useCallback((plugin: string, command: string, args?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'plugin_command',
        pluginId: plugin,
        command,
        args: args || {},
        messageId: `${Date.now()}-${Math.random()}`
      };
      console.log('[UDC WebSocket] Sending command:', message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[UDC WebSocket] Cannot send command - WebSocket not connected');
    }
  }, []);

  const refreshStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'udc.status',
        requestId: `${Date.now()}-${Math.random()}`
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
              // Check if we have actual plugins
              const hasPlugins = data.plugins && data.plugins.length > 0;
              setUdcStatus({
                connected: hasPlugins,
                plugins: data.plugins || [],
                version: data.version
              });
              break;
              
            case 'plugin_response':
              console.log('[UDC WebSocket] Received plugin response:', data);
              // Store the latest plugin response for subscribers
              setLastPluginResponse(data);
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
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: data.status } : p
                )
              }));
              break;
              
            case 'plugin_started':
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: 'active' } : p
                )
              }));
              break;
              
            case 'plugin_stopped':
              setUdcStatus(prev => ({
                ...prev,
                plugins: prev.plugins.map(p => 
                  p.id === data.pluginId ? { ...p, status: 'inactive' } : p
                )
              }));
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

      ws.onclose = () => {
        console.log('[UDC WebSocket] Disconnected');
        wsRef.current = null;
        setWsStatus('disconnected');
        setUdcStatus({
          connected: false,
          plugins: []
        });

        if (reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, WS_RECONNECT_DELAY);
        } else {
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

  return {
    status: udcStatus,
    wsStatus,
    sendCommand,
    refreshStatus,
    lastPluginResponse
  };
};