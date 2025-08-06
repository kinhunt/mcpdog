import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';
import { useConfigStore } from '../store/configStore';


export const useWebSocket = (url: string) => {
  const socketRef = useRef<Socket | null>(null);
  const addServerLogRef = useRef<((log: any) => void) | null>(null);
  const { 
    setConnected, 
    setSystemStatus, 
    addEvent,
    addServerLog
  } = useAppStore();
  
  const { loadConfig } = useConfigStore();

  useEffect(() => {
    addServerLogRef.current = addServerLog;
  }, [addServerLog]);

  // 细粒度的服务器状态更新函数
  const updateServerStatusOnly = (servers: any[]) => {
    console.log('[WebSocket] Updating server status only:', servers);
    // 直接更新Zustand store，避免调用setSystemStatus导致的闪烁
    // 这里我们可以直接更新configStore中的servers状态
    const { setServers } = useConfigStore.getState();
    setServers(servers);
  };

  useEffect(() => {
    // 创建Socket连接
    socketRef.current = io(url, {
      transports: ['websocket'],
      autoConnect: true
    });

    const socket = socketRef.current;

    // 连接事件
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      // 请求初始状态
      socket.emit('request-status');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    // 状态更新事件
    socket.on('status-update', (data) => {
      console.log('[WebSocket] Status update received:', data);
      setSystemStatus(data);
      console.log('[WebSocket] setSystemStatus called with:', data);
    });

    // 配置变化事件（主要来自daemon模式）
    socket.on('config-changed', (data) => {
      console.log('[WebSocket] Config changed event received:', data);
      // 只在非服务器切换的配置变化时重新加载配置
      // 服务器切换的状态更新通过WebSocket事件处理，避免页面刷新
      if (!data.context || data.context.changeType !== 'server-toggle') {
        loadConfig().then(() => {
          console.log('[WebSocket] Config reloaded successfully after config-changed event');
        }).catch(error => {
          console.error('[WebSocket] Failed to reload config after config-changed event:', error);
        });
      } else {
        console.log('[WebSocket] Skipping config reload for server toggle to avoid page flicker');
      }
      socket.emit('request-status');
      addEvent({
        type: 'config-changed',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // 服务器更新事件
    socket.on('server-updated', (data) => {
      console.log('[WebSocket] Server updated event received:', data);
      addEvent({
        type: 'server-updated',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    // 服务器启动/停止事件
    socket.on('server-started', () => {
      console.log('[WebSocket] Server started event received');
      // 请求最新状态以更新连接状态
      socket.emit('request-status');
    });

    socket.on('server-stopped', () => {
      console.log('[WebSocket] Server stopped event received');
      // 请求最新状态以更新连接状态
      socket.emit('request-status');
    });

    // 路由更新事件（工具变化）
    socket.on('routes-updated', (data) => {
      console.log('[WebSocket] Routes updated event received:', data);
      
      // 避免在服务器重新连接过程中重复请求状态
      // 状态更新会通过server-status-changed事件处理
      if (!data.isReconnection) {
        // 请求最新状态以更新工具数量
        socket.emit('request-status');
      }
      
      addEvent({
        type: 'routes-updated',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // 工具调用事件
    socket.on('tool-called', (data) => {
      console.log('Tool called:', data);
      addEvent({
        type: 'tool-called',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    // 新的复合事件处理器 - 直接携带系统状态
    socket.on('server-status-changed', (data) => {
      console.log('[WebSocket] Server status changed event received:', data);
      
      // 使用更细粒度的状态更新，避免整体页面重新渲染
      if (data.systemStatus) {
        console.log('[WebSocket] Using embedded system status from server-status-changed event');
        
        // 只更新必要的状态，避免整体重新渲染
        const { servers } = data.systemStatus;
        
        // 如果只是服务器状态变化，只更新服务器状态
        if (servers && !data.event) {
          // 使用更细粒度的更新方法
          updateServerStatusOnly(servers);
        } else {
          // 如果是其他状态变化，才更新整体状态
          setSystemStatus(data.systemStatus);
        }
      }
      
      // 如果是服务器启用事件，触发工具列表重新加载
      if (data.event === 'server-connected' || data.event === 'server-enabled') {
        console.log('[WebSocket] Server enabled/connected, updating state smoothly');
        
        // 对于enable事件，我们不需要复杂的重试机制
        // 只需要等待自然的WebSocket更新即可
        // 这样可以避免不必要的loadConfig调用导致的闪烁
        
        // 如果是server-enabled事件，只需要等待后续的server-connected事件
        if (data.event === 'server-enabled') {
          console.log('[WebSocket] Server enabled, waiting for connection event');
          return; // 不执行任何操作，等待server-connected事件
        }
        
        // 如果是server-connected事件，说明服务器已经连接，可以更新工具状态
        if (data.event === 'server-connected') {
          console.log('[WebSocket] Server connected, updating tool state');
          
          // 使用更平滑的状态更新，避免loadConfig
          if (data.systemStatus && data.systemStatus.servers) {
            const { servers } = data.systemStatus;
            const connectedServer = servers.find((s: any) => s.name === data.serverName);
            
            if (connectedServer) {
              console.log('[WebSocket] Updating server state for connected server:', connectedServer.name);
              // 直接更新服务器状态，避免loadConfig
              const { setServers } = useConfigStore.getState();
              const currentServers = useConfigStore.getState().servers;
              
              const updatedServers = currentServers.map(server => 
                server.name === connectedServer.name 
                  ? {
                      ...server,
                      connected: connectedServer.connected,
                      toolCount: connectedServer.toolCount,
                      enabledToolCount: connectedServer.enabledToolCount,
                      // 保持原有的工具状态，避免重置
                      tools: server.tools || []
                    }
                  : server
              );
              
              setServers(updatedServers);
              console.log('[WebSocket] Server state updated smoothly without loadConfig');
            }
          }
        }
      }
      
      // 记录事件
      addEvent({
        type: data.event, // server-connected, server-disabled 等
        data: data.originalData,
        timestamp: data.timestamp
      });
    });

    // 兼容性：保留原有的 server-connected 事件处理器
    socket.on('server-connected', (data) => {
      console.log('[WebSocket] Legacy server connected event received:', data);
      // 延迟请求状态，确保适配器状态已完全更新
      setTimeout(() => {
        console.log('[WebSocket] Requesting delayed status update after server connection');
        socket.emit('request-status');
      }, 500); // 500ms延迟，在后端broadcastStatusUpdate之前
      // 再次延迟请求，确保获取稳定状态  
      setTimeout(() => {
        console.log('[WebSocket] Requesting second delayed status update after server connection');
        socket.emit('request-status');
      }, 1500); // 1.5秒延迟，在后端broadcastStatusUpdate之后
      addEvent({
        type: 'server-connected',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    // 服务器断开连接事件
    socket.on('server-disconnected', (data) => {
      console.log('[WebSocket] Server disconnected event received:', data);
      // 服务器断开后请求最新状态
      socket.emit('request-status');
      addEvent({
        type: 'server-disconnected',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    // 服务器错误事件
    socket.on('server-error', (data) => {
      console.log('[WebSocket] Server error event received:', data);
      addEvent({
        type: 'server-error',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    // 错误事件
    socket.on('error', (data) => {
      console.error('Socket error:', data);
      addEvent({
        type: 'error',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    socket.on('server-log', (data) => {
      if (addServerLogRef.current) {
        addServerLogRef.current(data);
      }
    });

    // 处理增强的日志事件
    socket.on('enhanced-log-added', (data) => {
      console.log('[WebSocket] Enhanced log received:', data);
      if (addServerLogRef.current) {
        // 转换为兼容的格式，过滤掉原始JSON消息
        if (!data.logEntry.message.startsWith('Received: {') && 
            !data.logEntry.message.match(/^\{.*\}$/)) {
          addServerLogRef.current({
            serverName: data.serverName,
            stream: data.logEntry.source || 'system',
            data: `[${data.logEntry.level.toUpperCase()}] ${data.logEntry.message}`,
            timestamp: data.logEntry.timestamp
          });
        }
      }
    });

    socket.on('server-log-error', (data) => {
      console.log('[WebSocket] Server log error:', data);
      addEvent({
        type: 'server-error',
        data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    });

    socket.on('server-connection-status', (data) => {
      console.log('[WebSocket] Server connection status changed:', data);
      addEvent({
        type: data.isConnected ? 'server-connected' : 'server-disconnected',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // 清理函数
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [url, setConnected, setSystemStatus, addEvent, loadConfig]);

  // 添加手动刷新工具列表的方法
  const refreshServerTools = (serverName?: string) => {
    if (socketRef.current?.connected) {
      console.log(`[WebSocket] Manually refreshing tools for server: ${serverName || 'all servers'}`);
      socketRef.current.emit('request-status');
    }
  };

  // 请求状态更新
  const requestStatus = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-status');
    }
  };

  return {
    socket: socketRef.current,
    requestStatus,
    refreshServerTools
  };
};