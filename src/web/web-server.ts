/**
 * MCPDog Web Management Interface Server
 * Provides REST API and WebSocket real-time communication
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { globalLogManager } from '../logging/server-log-manager.js';
import { fileURLToPath } from 'url';
import { MCPDogServer } from '../core/mcpdog-server.js';
import { ConfigManager } from '../config/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebServerOptions {
  port: number;
  configPath?: string;
  staticPath?: string;
}

export class MCPDogWebServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private mcpServer: MCPDogServer;
  private configManager: ConfigManager;
  private port: number;

  constructor(options: WebServerOptions) {
    this.port = options.port;
    this.configManager = new ConfigManager(options.configPath, false);
    this.mcpServer = new MCPDogServer(this.configManager);
    
    // Create Express application
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupMCPServerEvents();
  }

  private setupMiddleware(): void {
    // CORS support
    this.app.use(cors());
    
    // JSON parsing
    this.app.use(express.json());
    
    // Static file serving
    const staticPath = path.join(__dirname, '../../web/dist');
    this.app.use(express.static(staticPath));
    
    // API route prefix
    this.app.use('/api', this.createAPIRouter());
  }

  private createAPIRouter(): express.Router {
    const router = express.Router();

    // System status API
    router.get('/status', this.handleGetStatus.bind(this));
    
    // Server management API
    router.get('/servers', this.handleGetServers.bind(this));
    router.post('/servers', this.handleAddServer.bind(this));
    router.put('/servers/:name', this.handleUpdateServer.bind(this));
    router.delete('/servers/:name', this.handleRemoveServer.bind(this));
    router.post('/servers/:name/toggle', this.handleToggleServer.bind(this));
    
    // Tool management API
    router.get('/tools', this.handleGetTools.bind(this));
    router.post('/tools/:name/call', this.handleCallTool.bind(this));
    
    // Config management API
    router.get('/config', this.handleGetConfig.bind(this));
    router.put('/config', this.handleUpdateConfig.bind(this));
    
    // Log management API
    router.get('/logs', this.handleGetAllLogs.bind(this));
    router.get('/logs/:serverName', this.handleGetServerLogs.bind(this));
    router.get('/logs/:serverName/stats', this.handleGetServerStats.bind(this));
    router.delete('/logs/:serverName', this.handleClearServerLogs.bind(this));
    router.get('/logs/:serverName/export', this.handleExportServerLogs.bind(this));
    
    return router;
  }

  private setupRoutes(): void {
    // SPA route support - all non-API routes return index.html
    this.app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(__dirname, '../../web/dist/index.html');
        res.sendFile(indexPath);
      }
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log('Web client connected:', socket.id);
      
      // Send initial status
      this.sendStatusUpdate(socket);
      
      // Client requests status update
      socket.on('request-status', () => {
        this.sendStatusUpdate(socket);
      });
      
      socket.on('disconnect', () => {
        console.log('Web client disconnected:', socket.id);
      });
    });
  }

  private setupMCPServerEvents(): void {
    // Listen for MCP server events, push to web clients in real-time
    this.mcpServer.on('started', () => {
      this.broadcastStatusUpdate();
    });

    this.mcpServer.on('stopped', () => {
      this.broadcastStatusUpdate();
    });

    // Listen for tool router events
    const toolRouter = this.mcpServer.getToolRouter();
    
    toolRouter.on('routes-updated', ({ serverName, toolCount }) => {
      this.io.emit('server-updated', {
        serverName,
        toolCount,
        timestamp: new Date().toISOString()
      });
      this.broadcastStatusUpdate();
    });

    toolRouter.on('tool-called', ({ serverName, toolName, args, result, duration }) => {
      this.io.emit('tool-called', {
        serverName,
        toolName,
        duration,
        timestamp: new Date().toISOString()
      });
    });

    toolRouter.on('error', ({ error, context }) => {
      this.io.emit('error', {
        error: error.message,
        context,
        timestamp: new Date().toISOString()
      });
    });
  }

  // API handlers
  private async handleGetStatus(req: express.Request, res: express.Response): Promise<void> {
    try {
      const status = this.mcpServer.getStatus();
      const toolRouter = this.mcpServer.getToolRouter();
      
      const serversStatus = [];
      for (const adapter of toolRouter.getAllAdapters()) {
        const tools = toolRouter.getToolsByServer(adapter.name);
        serversStatus.push({
          name: adapter.name,
          connected: adapter.isConnected,
          toolCount: tools.length,
          config: adapter.config
        });
      }

      res.json({
        initialized: status.initialized,
        client: status.client,
        servers: serversStatus,
        totalTools: await toolRouter.getAllTools().then(tools => tools.length),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get status',
        message: (error as Error).message
      });
    }
  }

  private async handleGetServers(req: express.Request, res: express.Response): Promise<void> {
    try {
      const servers = this.configManager.getEnabledServers();
      const toolRouter = this.mcpServer.getToolRouter();
      
      const serversWithStatus = Object.entries(servers).map(([name, config]) => {
        const adapter = toolRouter.getAdapter(name);
        const tools = toolRouter.getToolsByServer(name);
        
        return {
          name,
          config,
          connected: adapter?.isConnected || false,
          toolCount: tools.length,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description
          }))
        };
      });

      res.json(serversWithStatus);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get servers',
        message: (error as Error).message
      });
    }
  }

  private async handleGetTools(req: express.Request, res: express.Response): Promise<void> {
    try {
      const toolRouter = this.mcpServer.getToolRouter();
      const tools = await toolRouter.getAllTools(true);
      
      const toolsWithServer = tools.map(tool => {
        const route = toolRouter.findToolRoute(tool.name);
        return {
          ...tool,
          serverName: route?.serverName || 'unknown'
        };
      });

      res.json(toolsWithServer);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get tools',
        message: (error as Error).message
      });
    }
  }

  private async handleCallTool(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const { args } = req.body;
      
      const toolRouter = this.mcpServer.getToolRouter();
      const result = await toolRouter.callTool(name, args || {});
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to call tool',
        message: (error as Error).message
      });
    }
  }

  private async handleGetConfig(req: express.Request, res: express.Response): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get config',
        message: (error as Error).message
      });
    }
  }

  // WebSocket helper methods
  private async sendStatusUpdate(socket: any): Promise<void> {
    try {
      const status = this.mcpServer.getStatus();
      const toolRouter = this.mcpServer.getToolRouter();
      
      const serversStatus = [];
      for (const adapter of toolRouter.getAllAdapters()) {
        const tools = toolRouter.getToolsByServer(adapter.name);
        serversStatus.push({
          name: adapter.name,
          connected: adapter.isConnected,
          toolCount: tools.length,
          config: adapter.config
        });
      }

      socket.emit('status-update', {
        initialized: status.initialized,
        servers: serversStatus,
        totalTools: await toolRouter.getAllTools().then(tools => tools.length),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('error', {
        error: 'Failed to get status',
        message: (error as Error).message
      });
    }
  }

  private broadcastStatusUpdate(): void {
    this.io.sockets.sockets.forEach(socket => {
      this.sendStatusUpdate(socket);
    });
  }

  // Other unimplemented handlers (placeholders)
  private async handleAddServer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name, config } = req.body;
      if (!name || !config) {
        res.status(400).json({ error: 'Server name and config are required' });
        return;
      }
      await this.configManager.addServer(name, config);
      this.broadcastStatusUpdate();
      res.status(201).json({ message: 'Server added successfully', server: { name, ...config } });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add server', message: (error as Error).message });
    }
  }

  private async handleUpdateServer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const updates = req.body;
      if (!name || !updates) {
        res.status(400).json({ error: 'Server name and updates are required' });
        return;
      }
      await this.configManager.updateServer(name, updates);
      this.broadcastStatusUpdate();
      res.json({ message: 'Server updated successfully', server: { name, ...updates } });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update server', message: (error as Error).message });
    }
  }

  private async handleRemoveServer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      if (!name) {
        res.status(400).json({ error: 'Server name is required' });
        return;
      }
      await this.configManager.removeServer(name);
      this.broadcastStatusUpdate();
      res.json({ message: 'Server removed successfully', serverName: name });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove server', message: (error as Error).message });
    }
  }

  private async handleToggleServer(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const { enabled } = req.body;
      if (!name || typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'Server name and enabled status are required' });
        return;
      }
      await this.configManager.toggleServer(name, enabled);
      this.broadcastStatusUpdate();
      res.json({ message: `Server ${enabled ? 'enabled' : 'disabled'} successfully`, serverName: name, enabled });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle server status', message: (error as Error).message });
    }
  }

  private async handleUpdateConfig(req: express.Request, res: express.Response): Promise<void> {
    try {
      const updates = req.body;
      if (!updates) {
        res.status(400).json({ error: 'Config updates are required' });
        return;
      }
      // Directly update the config object and save it
      // This will trigger the config-updated event in ConfigManager
      // which MCPDogServer listens to for reinitialization.
      Object.assign(this.configManager.getConfig(), updates);
      await this.configManager.saveConfig();
      this.broadcastStatusUpdate();
      res.json({ message: 'Configuration updated successfully', config: updates });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update config', message: (error as Error).message });
    }
  }

  // Server control
  async start(): Promise<void> {
    try {
      // Immediately start Web server, do not wait for MCP server
      const webStartPromise = new Promise<void>((resolve) => {
        this.server.listen(this.port, () => {
          console.log(`🌐 MCPDog Web界面启动在端口 ${this.port}`);
          console.log(`📊 管理界面: http://localhost:${this.port}`);
          console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
          console.log(`⚡ MCP server will connect asynchronously in the background...`);
          resolve();
        });
      });
      
      // Simultaneously start MCP server in background, do not block Web interface
      this.startMCPServerInBackground();
      
      // Only wait for Web server to start
      return webStartPromise;
    } catch (error) {
      console.error('Failed to start web server:', error);
      throw error;
    }
  }

  private async startMCPServerInBackground(): Promise<void> {
    try {
      console.log('🔄 Starting MCP server in background...');
      await this.mcpServer.start();
      console.log('✅ MCPDog Server background startup complete');
    } catch (error) {
      console.error('❌ MCP server background startup failed:', error);
      // Do not throw error, let Web interface remain available
    }
  }

  async stop(): Promise<void> {
    try {
      await this.mcpServer.stop();
      
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('MCPDog Web server stopped');
          resolve();
        });
      });
    } catch (error) {
      console.error('Error stopping web server:', error);
      throw error;
    }
  }

  // Log management handlers
  private async handleGetAllLogs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = globalLogManager.getAllRecentLogs(limit);
      const stats = globalLogManager.getAllStats();
      
      res.json({
        logs,
        stats: Object.fromEntries(stats),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting all logs:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }

  private async handleGetServerLogs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { serverName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as string;
      const search = req.query.search as string;

      let logs = globalLogManager.getLogs(serverName, limit);
      
      // Apply filters
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      
      if (search) {
        logs = globalLogManager.searchLogs(serverName, search, {
          level: level as any,
          limit
        });
      }

      const stats = globalLogManager.getStats(serverName);
      
      res.json({
        serverName,
        logs,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting server logs:', error);
      res.status(500).json({ error: 'Failed to get server logs' });
    }
  }

  private async handleGetServerStats(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { serverName } = req.params;
      const stats = globalLogManager.getStats(serverName);
      
      if (!stats) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }

      res.json({
        serverName,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting server stats:', error);
      res.status(500).json({ error: 'Failed to get server stats' });
    }
  }

  private async handleClearServerLogs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { serverName } = req.params;
      globalLogManager.clearLogs(serverName);
      
      res.json({
        message: `Logs cleared for server ${serverName}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clearing server logs:', error);
      res.status(500).json({ error: 'Failed to clear server logs' });
    }
  }

  private async handleExportServerLogs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { serverName } = req.params;
      const format = (req.query.format as string) || 'text';
      
      const exportData = globalLogManager.exportLogs(serverName, format as 'json' | 'text');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${serverName}-logs-${timestamp}.${format === 'json' ? 'json' : 'txt'}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain');
      res.send(exportData);
    } catch (error) {
      console.error('Error exporting server logs:', error);
      res.status(500).json({ error: 'Failed to export server logs' });
    }
  }
}