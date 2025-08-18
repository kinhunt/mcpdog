// 配置管理相关类型定义

export interface ToolConfig {
  enabled: boolean;
  alias?: string;
  description?: string;
}

export interface ToolsConfig {
  mode: 'all' | 'whitelist' | 'blacklist';
  enabledTools?: string[];
  disabledTools?: string[];
  toolSettings?: Record<string, ToolConfig>;
}

export interface ServerConfig {
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http-sse' | 'streamable-http';
  description?: string;
  
  // Connection settings
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  endpoint?: string; // 保持向后兼容
  url?: string;      // 新的标准字段名  
  apiKey?: string;
  headers?: Record<string, string>;
  
  // Transport specific settings
  sseReconnectInterval?: number;
  httpKeepAlive?: boolean;
  sseEndpoint?: string;
  maxChunkSize?: number;
  streamTimeout?: number;
  streamEndpoint?: string;
  sessionMode?: 'auto' | 'required' | 'disabled';
  
  // Tool configuration
  toolsConfig?: ToolsConfig;
  
  // Other settings
  timeout?: number;
  retries?: number;
}

export interface ServerWithTools extends ServerConfig {
  connected: boolean;
  toolCount: number;
  enabledToolCount: number;
  tools: ToolWithConfig[];
}

export interface ToolWithConfig {
  name: string;
  description: string;
  enabled: boolean;
  settings: ToolConfig;
  inputSchema?: any;
  annotations?: any;
}

export interface MCPClientConfig {
  type: 'claude-desktop' | 'cursor' | 'vscode' | 'continue';
  name: string;
  config: any;
  instructions: string[];
}


export interface AppConfig {
  version: string;
  servers: Record<string, ServerConfig>;
  web?: {
    enabled: boolean;
    port: number;
    host: string;
  };
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}