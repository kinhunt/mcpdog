/**
 * MCPDog Daemon Client
 * Used to connect to the daemon and communicate
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';

export interface DaemonClientConfig {
  host?: string;
  port?: number;
  clientType: 'stdio' | 'web' | 'cli';
  reconnect?: boolean;
  reconnectInterval?: number;
  silent?: boolean; // Silent mode, no log output
}

export class DaemonClient extends EventEmitter {
  private socket: Socket;
  private config: DaemonClientConfig;
  private isConnected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private requestCounter = 0;
  private pendingRequests = new Map<string, (response: any) => void>();

  constructor(config: DaemonClientConfig) {
    super();
    this.config = {
      host: 'localhost',
      port: 9999,
      reconnect: true,
      reconnectInterval: 5000,
      ...config
    };
    this.socket = new Socket();
    this.setupSocket();
  }

  private setupSocket() {
    this.socket.on('connect', () => {
      if (!this.config.silent) {
        console.log('[DAEMON-CLIENT] Connected to daemon');
      }
      this.isConnected = true;
      this.clearReconnectTimer();
      
      // Send handshake message
      this.send({
        type: 'handshake',
        clientType: this.config.clientType
      });
      
      this.emit('connected');
    });

    this.socket.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          if (!this.config.silent) {
            console.error('[DAEMON-CLIENT] Invalid message:', error);
          }
        }
      });
    });

    this.socket.on('close', () => {
      if (!this.config.silent) {
        console.log('[DAEMON-CLIENT] Disconnected from daemon');
      }
      this.isConnected = false;
      this.emit('disconnected');
      
      if (this.config.reconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('error', (error) => {
      if (!this.config.silent) {
        console.error('[DAEMON-CLIENT] Socket error:', error);
      }
      this.emit('error', error);
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        if (!this.config.silent) {
          console.log(`[DAEMON-CLIENT] Welcome, client ID: ${message.clientId}`);
        }
        this.emit('welcome', message);
        break;

      case 'handshake-ack':
        if (!this.config.silent) {
          console.log('[DAEMON-CLIENT] Handshake acknowledged');
        }
        this.emit('ready', message.serverStatus);
        break;

      case 'mcp-response':
        // MCP request response
        const responseCallback = this.pendingRequests.get(message.requestId);
        if (responseCallback) {
          responseCallback(message.response);
          this.pendingRequests.delete(message.requestId);
        }
        break;

      case 'mcp-error':
        // MCP request error
        const errorCallback = this.pendingRequests.get(message.requestId);
        if (errorCallback) {
          errorCallback({ error: message.error });
          this.pendingRequests.delete(message.requestId);
        }
        break;

      case 'server-started':
      case 'server-stopped':
      case 'routes-updated':
      case 'tool-called':
      case 'config-changed':
        // Forward events
        this.emit(message.type, message.data);
        break;

      case 'status':
        this.emit('status', message.status);
        break;

      case 'tools':
        this.emit('tools', message.tools);
        break;

      default:
        if (!this.config.silent) {
          console.warn('[DAEMON-CLIENT] Unknown message type:', message.type);
        }
    }
  }

  private send(message: any) {
    if (this.isConnected) {
      this.socket.write(JSON.stringify(message) + '\n');
    } else {
      if (!this.config.silent) {
        console.error('[DAEMON-CLIENT] Cannot send message, not connected');
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    if (!this.config.silent) {
      console.log(`[DAEMON-CLIENT] Scheduling reconnect in ${this.config.reconnectInterval}ms`);
    }
    this.reconnectTimer = setTimeout(() => {
      if (!this.config.silent) {
        console.log('[DAEMON-CLIENT] Attempting to reconnect...');
      }
      this.connect();
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  // Public API
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        this.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        this.off('connected', onConnect);
        reject(error);
      };

      this.once('connected', onConnect);
      this.once('error', onError);

      this.socket.connect(this.config.port!, this.config.host!);
    });
  }

  disconnect() {
    this.config.reconnect = false;
    this.clearReconnectTimer();
    this.socket.end();
  }

  // MCP protocol forwarding
  async sendMCPRequest(request: any): Promise<any> {
    return new Promise((resolve) => {
      const requestId = `req_${++this.requestCounter}`;
      this.pendingRequests.set(requestId, resolve);
      
      this.send({
        type: 'mcp-request',
        requestId,
        request
      });
    });
  }

  // Get status
  getStatus(): void {
    this.send({ type: 'get-status' });
  }

  // Get tools list
  getTools(): void {
    this.send({ type: 'get-tools' });
  }

  // Reload configuration
  reloadConfig(): void {
    this.send({ type: 'reload-config' });
  }

  get connected(): boolean {
    return this.isConnected;
  }
}