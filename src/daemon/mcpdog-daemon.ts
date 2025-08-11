/**
 * MCPDog Daemon
 * Unified management of MCP servers, supporting multiple client access modes
 */

import { EventEmitter } from 'events';
import { createServer, Server as NetServer } from 'net';
import { Server as HttpServer } from 'http';
import { MCPDogServer } from '../core/mcpdog-server.js';
import { ConfigManager } from '../config/config-manager.js';
import { StreamableHttpMCPServer } from '../streamable-http-server.js';
import path from 'path';
import fs from 'fs/promises';

export interface DaemonConfig {
  configPath: string;
  ipcPort?: number;
  dashboardPort?: number;
  httpPort?: number;
  enableHttp?: boolean;
  enableStdio?: boolean;
  pidFile?: string;
  // backward compatibility
  webPort?: number;
}

export interface DaemonClient {
  id: string;
  type: 'stdio' | 'web' | 'cli';
  socket?: any;
  lastSeen: Date;
}

export class MCPDogDaemon extends EventEmitter {
  private mcpServer: MCPDogServer;
  private configManager: ConfigManager;
  private ipcServer: NetServer;
  private webServer?: HttpServer;
  private httpMCPServer?: StreamableHttpMCPServer;
  private clients = new Map<string, DaemonClient>();
  private config: DaemonConfig;
  private isRunning = false;

  constructor(config: DaemonConfig) {
    super();
    this.config = config;
    this.configManager = new ConfigManager(config.configPath);
    this.mcpServer = new MCPDogServer(this.configManager);
    this.ipcServer = createServer();
    
    this.setupMCPServerEvents();
    this.setupIPCServer();
  }

  private setupMCPServerEvents() {
    // Forward MCP server events to all clients
    this.mcpServer.on('started', () => {
      this.broadcastToClients('server-started', {});
    });

    this.mcpServer.on('stopped', () => {
      this.broadcastToClients('server-stopped', {});
    });

    // Listen for individual server connection events
    this.mcpServer.on('server-connected', (data) => {
      console.log(`[DAEMON] Received server-connected event for: ${data.serverName}`);
      this.broadcastToClients('server-connected', data);
      console.log(`[DAEMON] Broadcasted server-connected event for: ${data.serverName}`);
    });

    this.mcpServer.on('server-disconnected', (data) => {
      this.broadcastToClients('server-disconnected', data);
    });

    this.mcpServer.on('server-error', (data) => {
      this.broadcastToClients('server-error', data);
    });

    this.mcpServer.on('server-log', (data) => {
      this.broadcastToClients('server-log', data);
    });

    // Listen for tool router events
    const toolRouter = this.mcpServer.getToolRouter();
    toolRouter.on('routes-updated', (data) => {
      this.broadcastToClients('routes-updated', data);
    });

    toolRouter.on('tool-called', (data) => {
      this.broadcastToClients('tool-called', data);
    });

    toolRouter.on('error', (data) => {
      this.broadcastToClients('error', data);
    });

    // Listen for config changes
    this.configManager.on('config-updated', (data) => {
      this.broadcastToClients('config-changed', data.config);
      // If it's a server toggle or tool config change, no need to restart all servers
      const changeType = data.context?.changeType;
      const serverName = data.context?.serverName;

      if (changeType === 'server-toggle') {
        console.log(`[DAEMON] Skipping full restart for server toggle: ${serverName}`);
      } else if (changeType === 'tool-toggle' || changeType === 'tool-config-update') {
        if (serverName) {
          console.log(`[DAEMON] Handling tool update for server: ${serverName}`);
          this.mcpServer.updateServerTools(serverName);
        }
      } else {
        this.handleConfigChange(data.config);
      }
    });

    // Listen for server enable/disable events
    this.configManager.on('server-toggled', (data) => {
      console.log(`[DAEMON] Server toggled: ${data.name} enabled: ${data.enabled}`);
      this.emit('server-toggled', data);
    });
  }

  private setupIPCServer() {
    this.ipcServer.on('connection', (socket) => {
      const clientId = this.generateClientId();
      console.log(`[DAEMON] Client connected: ${clientId}`);

      // Register client
      const client: DaemonClient = {
        id: clientId,
        type: 'cli', // Default type, will be updated based on handshake message
        socket,
        lastSeen: new Date()
      };
      this.clients.set(clientId, client);

      // Handle client messages
      socket.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          try {
            const message = JSON.parse(line);
            this.handleClientMessage(clientId, message);
          } catch (error) {
            console.error(`[DAEMON] Invalid message from ${clientId}:`, error);
          }
        });
      });

      socket.on('close', () => {
        console.log(`[DAEMON] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      socket.on('error', (error) => {
        console.error(`[DAEMON] Client error ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        serverStatus: this.mcpServer.getStatus()
      });
    });
  }

  private async handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastSeen = new Date();

    switch (message.type) {
      case 'handshake':
        // Client type handshake
        client.type = message.clientType || 'cli';
        this.sendToClient(clientId, {
          type: 'handshake-ack',
          serverStatus: this.mcpServer.getStatus()
        });
        break;

      case 'mcp-request':
        // MCP protocol request forwarding, pass client ID to support multi-client deduplication
        try {
          const response = await this.mcpServer.handleRequest(message.request, clientId);
          this.sendToClient(clientId, {
            type: 'mcp-response',
            requestId: message.requestId,
            response
          });
        } catch (error) {
          this.sendToClient(clientId, {
            type: 'mcp-error',
            requestId: message.requestId,
            error: (error as Error).message
          });
        }
        break;

      case 'get-status':
        this.sendToClient(clientId, {
          type: 'status',
          status: this.getFullStatus()
        });
        break;

      case 'reload-config':
        await this.reloadConfig();
        break;

      case 'get-tools':
        const tools = await this.mcpServer.getToolRouter().getAllTools();
        this.sendToClient(clientId, {
          type: 'tools',
          tools
        });
        break;

      case 'config-request':
        await this.handleConfigRequest(message);
        break;

      default:
        console.warn(`[DAEMON] Unknown message type from ${clientId}:`, message.type);
    }
  }

  private sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client?.socket) {
      try {
        client.socket.write(JSON.stringify(message) + '\n');
      } catch (error) {
        console.error(`[DAEMON] Failed to send to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  private broadcastToClients(type: string, data: any) {
    const message = { type, data, timestamp: new Date().toISOString() };
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
    
    // Also emit local event for daemon-web-server etc. to listen to
    this.emit(type, data);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFullStatus() {
    const toolRouter = this.mcpServer.getToolRouter();
    const adapters = toolRouter.getAllAdapters();
    
    return {
      daemon: {
        isRunning: this.isRunning,
        clients: Array.from(this.clients.values()).map(c => ({
          id: c.id,
          type: c.type,
          lastSeen: c.lastSeen
        })),
        uptime: process.uptime()
      },
      mcpServer: this.mcpServer.getStatus(),
      servers: adapters.map(adapter => ({
        name: adapter.name,
        connected: adapter.isConnected,
        toolCount: toolRouter.getToolsByServer(adapter.name).length,
        enabledToolCount: toolRouter.getEnabledToolsByServer(adapter.name).length,
        config: adapter.config
      }))
    };
  }

  private async handleConfigChange(config: any) {
    console.log('[DAEMON] Config changed, reloading servers...');
    // Reinitialize servers
    await this.mcpServer.stop();
    await this.mcpServer.start();
    
    this.broadcastToClients('status-update', this.getFullStatus()); // Explicitly broadcast status after server restart
  }

  private async initializeMCPServer() {
    // Simulate MCP client's initialize request to initialize the server
    const initializeRequest = {
      jsonrpc: '2.0' as const,
      id: 'daemon-init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: false }
        },
        clientInfo: {
          name: 'MCPDog Daemon',
          version: '2.0.0'
        }
      }
    };

    try {
      await this.mcpServer.handleRequest(initializeRequest, 'daemon-init');
      console.log('[DAEMON] MCP Server initialized successfully');
    } catch (error) {
      console.error('[DAEMON] Failed to initialize MCP Server:', error);
    }
  }

  private async reloadConfig() {
    console.log('[DAEMON] Manual config reload requested');
    await this.configManager.loadConfig();
    
    // Re-initialize MCP server to connect to new servers
    try {
      await this.mcpServer.handleConfigReload();
      console.log('[DAEMON] MCP Server reinitialized after config reload');
    } catch (error) {
      console.error('[DAEMON] Failed to reinitialize MCP Server after config reload:', error);
    }
  }

  private async handleConfigRequest(message: any) {
    const { action, serverName, toolName, enabled } = message;

    switch (action) {
      case 'toggle-tool':
        await this.configManager.toggleTool(serverName, toolName, enabled);
        break;
      // Add other config actions here
      default:
        console.warn(`[DAEMON] Unknown config action: ${action}`);
    }
  }

  async start(): Promise<void> {
    try {
      console.log('[DAEMON] Starting MCPDog daemon...');
      
      // Load config file
      await this.configManager.loadConfig();
      
      // Start MCP server
      await this.mcpServer.start();
      
      // In daemon mode, manually initialize MCP server
      await this.initializeMCPServer();
      
      // Start IPC server
      const ipcPort = this.config.ipcPort || 9999;
      await new Promise<void>((resolve) => {
        this.ipcServer.listen(ipcPort, 'localhost', () => {
          console.log(`[DAEMON] IPC server listening on port ${ipcPort}`);
          resolve();
        });
      });

      // Start HTTP MCP server if enabled
      if (this.config.enableHttp && this.config.httpPort) {
        try {
          this.httpMCPServer = new StreamableHttpMCPServer(this.configManager, this.config.httpPort);
          await this.httpMCPServer.start();
          console.log(`[DAEMON] HTTP MCP server started on port ${this.config.httpPort}`);
        } catch (error) {
          console.error(`[DAEMON] Failed to start HTTP MCP server on port ${this.config.httpPort}:`, error);
          // HTTP transport is optional, continue without it
        }
      }

      // Write PID file
      if (this.config.pidFile) {
        await fs.writeFile(this.config.pidFile, process.pid.toString());
      }

      this.isRunning = true;
      console.log('[DAEMON] MCPDog daemon started successfully');
      
    } catch (error) {
      console.error('[DAEMON] Failed to start daemon:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('[DAEMON] Stopping MCPDog daemon...');
      
      this.isRunning = false;
      
      // Close all client connections
      this.clients.forEach((client, clientId) => {
        if (client.socket) {
          client.socket.end();
        }
      });
      this.clients.clear();

      // Stop HTTP MCP server if running
      if (this.httpMCPServer) {
        try {
          // StreamableHttpMCPServer doesn't have a direct stop method, 
          // but it should clean up on process exit
          console.log('[DAEMON] HTTP MCP server stopped');
        } catch (error) {
          console.error('[DAEMON] Error stopping HTTP MCP server:', error);
        }
      }

      // Stop IPC server
      await new Promise<void>((resolve) => {
        this.ipcServer.close(() => resolve());
      });

      // Stop MCP server
      await this.mcpServer.stop();

      // Clean up PID file
      if (this.config.pidFile) {
        try {
          await fs.unlink(this.config.pidFile);
        } catch (error) {
          // PID file might have already been deleted, ignore error
        }
      }

      console.log('[DAEMON] MCPDog daemon stopped');
      
    } catch (error) {
      console.error('[DAEMON] Error stopping daemon:', error);
      throw error;
    }
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  // Web server support (optional)
  async startWebServer(port: number): Promise<void> {
    const { DaemonWebServer } = await import('./daemon-web-server.js');
    const webServer = new DaemonWebServer(this, port);
    await webServer.start();
    console.log(`[DAEMON] Web interface started on port ${port}`);
  }
}