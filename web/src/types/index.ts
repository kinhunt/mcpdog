// Web界面相关类型定义

export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http-sse' | 'streamable-http';
  description?: string;
  
  // stdio 配置
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  
  // HTTP 配置
  endpoint?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  
  // HTTP+SSE 特定配置
  sseReconnectInterval?: number;
  httpKeepAlive?: boolean;
  sseEndpoint?: string;
  
  // Streamable HTTP 特定配置
  maxChunkSize?: number;
  streamTimeout?: number;
  streamEndpoint?: string;
  
  // 通用会话管理配置
  sessionMode?: 'auto' | 'required' | 'disabled';
  
  // 其他配置
  timeout?: number;
  retries?: number;
  enabledTools?: string[];
}

export interface ServerStatus {
  name: string;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
  enabledToolCount: number;
  transport: string;
  command?: string;
  args?: string[];
  description?: string;
  timeout?: number;
  retries?: number;
  toolsConfig?: any;
  tools?: any[];
  // HTTP相关配置
  endpoint?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  // 其他配置字段
  cwd?: string;
  env?: Record<string, string>;
}

export interface ToolInfo {
  name: string;
  description: string;
  serverName: string;
  inputSchema?: any;
  annotations?: any;
}

export interface SystemStatus {
  initialized: boolean;
  client?: {
    supportsNotifications: boolean;
    clientName: string;
    clientVersion: string;
  };
  servers: ServerStatus[];
  totalTools: number;
  enabledTools: number;
  uptime: number;
  timestamp: string;
}

export interface RealtimeEvent {
  type: 'server-updated' | 'tool-called' | 'error' | 'status-update' | 'config-changed' | 'routes-updated' | 'server-connected' | 'server-disconnected' | 'server-error';
  data: any;
  timestamp: string;
}

export interface ServerLog {
  serverName: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: string;
}

export interface EnhancedServerLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: 'stdout' | 'stderr' | 'system';
  serverName: string;
}

export interface AppState {
  // 连接状态
  connected: boolean;
  
  // 系统状态
  systemStatus: SystemStatus | null;
  
  // 工具列表
  tools: ToolInfo[];
  
  // 实时事件日志
  events: RealtimeEvent[];

  // 服务器日志
  serverLogs: Record<string, ServerLog[]>;
  
  // UI状态
  selectedServer: string | null;
  selectedTool: string | null;
  
  // 操作方法
  setConnected: (connected: boolean) => void;
  setSystemStatus: (status: SystemStatus) => void;
  setTools: (tools: ToolInfo[]) => void;
  addEvent: (event: RealtimeEvent) => void;
  addServerLog: (log: ServerLog) => void;
  setSelectedServer: (server: string | null) => void;
  setSelectedTool: (tool: string | null) => void;
}