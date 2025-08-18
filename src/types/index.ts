// MCPDog 核心类型定义
import { EventEmitter } from 'events';

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
  endpoint?: string; // 保持向后兼容
  url?: string;      // 新的标准字段名
  apiKey?: string;
  headers?: Record<string, string>;
  
  // HTTP+SSE 特定配置
  sseReconnectInterval?: number; // SSE 重连间隔（毫秒）
  httpKeepAlive?: boolean;       // HTTP keep-alive
  sseEndpoint?: string;          // 自定义 SSE 端点
  
  // Streamable HTTP 特定配置
  maxChunkSize?: number;         // 流传输最大块大小
  streamTimeout?: number;        // 流超时时间
  streamEndpoint?: string;       // 自定义流端点
  
  // 通用会话管理配置（HTTP+SSE 和 Streamable HTTP 共用）
  sessionMode?: 'auto' | 'required' | 'disabled'; // 会话模式
  
  // 工具级别控制配置
  toolsConfig?: {
    mode: 'all' | 'whitelist' | 'blacklist'; // 工具控制模式
    enabledTools?: string[];      // 白名单模式：明确启用的工具
    disabledTools?: string[];     // 黑名单模式：明确禁用的工具
    toolSettings?: Record<string, {
      enabled: boolean;
      alias?: string;             // 工具别名
      description?: string;       // 自定义描述
    }>;
  };
  
  // 其他配置
  timeout?: number;
  retries?: number;
  enabledTools?: string[]; // 保持向后兼容
}

export interface MCPDogConfig {
  version: string;
  servers: Record<string, MCPServerConfig>;
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

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPNotificationRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export type MCPMessage = MCPRequest | MCPNotificationRequest;

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface ServerAdapter extends EventEmitter {
  name: string;
  config: MCPServerConfig;
  isConnected: boolean;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getTools(): Promise<MCPTool[]>;
  callTool(name: string, args: any): Promise<MCPResponse>;
  sendRequest(request: MCPRequest): Promise<MCPResponse>;
}

export interface ClientCapabilities {
  supportsNotifications: boolean;
  clientName: string;
  clientVersion: string;
}

// 事件类型
export type MCPDogEvents = {
  'server-connected': { serverName: string };
  'server-disconnected': { serverName: string; error?: Error };
  'tools-changed': { serverName?: string };
  'config-updated': { config: MCPDogConfig };
  'tool-called': { serverName: string; toolName: string; args: any; result: any };
  'error': { error: Error; context?: string };
};