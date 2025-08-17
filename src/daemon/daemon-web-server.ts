/**
 * Daemon Web Server
 * Connects directly to the daemon instance instead of creating a separate MCPServer
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPDogDaemon } from './mcpdog-daemon.js';
import { ConfigManager } from '../config/config-manager.js';
import { globalLogManager } from '../logging/server-log-manager.js';
import { ServerNameValidator } from '../utils/server-name-validator.js';
import { createExpressAuthMiddleware } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DaemonWebServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private daemon: MCPDogDaemon;
  private port: number;
  private configManager: ConfigManager; // Add configManager property

  constructor(daemon: MCPDogDaemon, port: number) {
    this.daemon = daemon;
    this.port = port;
    this.configManager = daemon.getConfigManager(); // Use daemon's configManager
    
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
    this.setupDaemonEvents();
  }

  private setupMiddleware() {
    // CORS support
    this.app.use(cors());
    
    // JSON parsing
    this.app.use(express.json());
    
    // Authentication middleware (if token is configured)
    const authToken = process.env.MCPDOG_AUTH_TOKEN;
    if (authToken) {
      console.log('[DAEMON-WEB] Authentication enabled');
      
      // Add authentication check endpoint (before auth middleware)
      this.app.get('/api/auth/status', (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.json({ authenticated: false, required: true });
        }
        
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          return res.json({ authenticated: false, required: true });
        }
        
        const token = parts[1];
        const isAuthorized = Buffer.compare(Buffer.from(token), Buffer.from(authToken)) === 0;
        
        if (!isAuthorized) {
          return res.json({ authenticated: false, required: true });
        }
        
        res.json({ authenticated: true, required: true });
      });
      
      // Add login endpoint (before auth middleware)
      this.app.post('/api/auth/login', (req, res) => {
        const { token } = req.body;
        
        if (!token) {
          return res.status(400).json({ error: 'Token is required' });
        }
        
        const isAuthorized = Buffer.compare(Buffer.from(token), Buffer.from(authToken)) === 0;
        
        if (!isAuthorized) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        res.json({ success: true, message: 'Login successful' });
      });
      
      this.app.use(createExpressAuthMiddleware(authToken));
    } else {
      // When auth is disabled, return auth not required
      this.app.get('/api/auth/status', (req, res) => {
        res.json({ authenticated: true, required: false });
      });
    }
    
    // Static file serving
    const staticPath = path.join(__dirname, '../../web/dist');
    this.app.use(express.static(staticPath));
    
    // API route prefix
    this.app.use('/api', this.createAPIRouter());
  }

  private createAPIRouter() {
    const router = express.Router();
    
    // System status API
    router.get('/status', this.handleGetStatus.bind(this));
    
    // Server management API
    router.get('/servers', this.handleGetServers.bind(this));
    router.post('/servers', this.handleAddServer.bind(this));
    router.put('/servers/:name', this.handleUpdateServer.bind(this));
    router.delete('/servers/:name', this.handleRemoveServer.bind(this));
    router.post('/servers/:name/toggle', this.handleToggleServer.bind(this));
    
    // Tool-level control API
    router.get('/servers/:name/tools', this.handleGetServerTools.bind(this));
    router.post('/servers/:name/tools/:tool/toggle', this.handleToggleServerTool.bind(this));
    router.put('/servers/:name/tools', this.handleUpdateServerTools.bind(this));
    
    // Tool management API
    router.get('/tools', this.handleGetTools.bind(this));
    router.post('/tools/:name/call', this.handleCallTool.bind(this));
    
    // Config management API
    router.get('/config', this.handleGetConfig.bind(this));
    router.put('/config', this.handleUpdateConfig.bind(this));
    
    // Daemon-specific API
    router.get('/daemon/clients', this.handleGetClients.bind(this));
    router.post('/daemon/reload', this.handleReloadConfig.bind(this));
    
    // Log management API
    router.get('/logs', this.handleGetAllLogs.bind(this));
    router.get('/logs/:serverName', this.handleGetServerLogs.bind(this));
    router.delete('/logs/:serverName', this.handleClearServerLogs.bind(this));
    router.get('/logs/:serverName/stats', this.handleGetServerLogStats.bind(this));
    
    return router;
  }

  private setupRoutes() {
    // SPA route support - all non-API routes return index.html
    this.app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(__dirname, '../../web/dist/index.html');
        res.sendFile(indexPath);
      }
    });
  }

  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('[DAEMON-WEB] Web client connected:', socket.id);
      
      // Send initial status
      this.sendStatusUpdate(socket);
      
      // Client requests status update
      socket.on('request-status', () => {
        this.sendStatusUpdate(socket);
      });

      socket.on('disconnect', () => {
        console.log('[DAEMON-WEB] Web client disconnected:', socket.id);
      });
    });
  }

  private setupDaemonEvents() {
    // Listen for daemon events, push to web clients in real-time
    this.daemon.on('server-started', (data) => {
      console.log(`[DAEMON-WEB] Server started event received: ${data.serverName}`);
      
      // Delay sending composite event to ensure adapter status is fully updated
      setTimeout(() => {
        const systemStatus = this.getSystemStatus();
        if (systemStatus) {
          console.log(`[DAEMON-WEB] Sending server-status-changed event for: ${data.serverName}`);
          this.io.emit('server-status-changed', {
            event: 'server-started',
            serverName: data.serverName,
            systemStatus: systemStatus,
            originalData: data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } else {
          // If status retrieval fails, fall back to original method
          this.io.emit('server-started', data);
          this.broadcastStatusUpdate();
        }
      }, 1000); // Delay to ensure status synchronization
    });

    this.daemon.on('server-stopped', (data) => {
      console.log(`[DAEMON-WEB] Server stopped event received: ${data.serverName}`);
      
      // Immediately get and send status
      const systemStatus = this.getSystemStatus();
      if (systemStatus) {
        console.log(`[DAEMON-WEB] Sending server-status-changed event for: ${data.serverName}`);
        this.io.emit('server-status-changed', {
          event: 'server-stopped',
          serverName: data.serverName,
          systemStatus: systemStatus,
          originalData: data,
          timestamp: data.timestamp || new Date().toISOString()
        });
      } else {
        // If status retrieval fails, fall back to original method
        this.io.emit('server-stopped', data);
        this.broadcastStatusUpdate();
      }
    });

    this.daemon.on('routes-updated', (data) => {
      this.io.emit('server-updated', {
        serverName: data.serverName,
        toolCount: data.toolCount,
        timestamp: new Date().toISOString()
      });
      // Delay broadcasting status update to ensure tool routes are fully updated
      setTimeout(() => {
        console.log(`[DAEMON-WEB] Broadcasting delayed status update after routes-updated for: ${data.serverName}`);
        this.broadcastStatusUpdate();
      }, 500); // 500ms delay
    });

    this.daemon.on('server-connected', (data) => {
      console.log(`[DAEMON-WEB] Server connected event received: ${data.serverName}`);
      
      // Delay sending composite event to ensure adapter status is fully updated
      setTimeout(() => {
        const systemStatus = this.getSystemStatus();
        if (systemStatus) {
          console.log(`[DAEMON-WEB] Sending server-status-changed event for: ${data.serverName}`);
          this.io.emit('server-status-changed', {
            event: 'server-connected',
            serverName: data.serverName,
            systemStatus: systemStatus,
            originalData: data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        } else {
          // If status retrieval fails, fall back to original method
          this.io.emit('server-connected', data);
          this.broadcastStatusUpdate();
        }
      }, 1000); // Delay to ensure status synchronization
    });

    this.daemon.on('server-disconnected', (data) => {
      console.log(`[DAEMON-WEB] Server disconnected event received: ${data.serverName}`);
      
      // Immediately get and send status, as disconnection status changes are immediate
      const systemStatus = this.getSystemStatus();
      if (systemStatus) {
        console.log(`[DAEMON-WEB] Sending server-status-changed event for: ${data.serverName}`);
        this.io.emit('server-status-changed', {
          event: 'server-disconnected',
          serverName: data.serverName,
          systemStatus: systemStatus,
          originalData: data,
          timestamp: data.timestamp || new Date().toISOString()
        });
      } else {
        // If status retrieval fails, fall back to original method
        this.io.emit('server-disconnected', data);
        this.broadcastStatusUpdate();
      }
    });

    this.daemon.on('server-error', (data) => {
      this.io.emit('server-error', data);
    });

    this.daemon.on('server-log', (data) => {
      this.io.emit('server-log', data);
    });

    this.daemon.on('tool-called', (data) => {
      this.io.emit('tool-called', {
        serverName: data.serverName,
        toolName: data.toolName,
        duration: data.duration,
        timestamp: new Date().toISOString()
      });
    });

    this.daemon.on('error', (data) => {
      this.io.emit('error', {
        error: data.error,
        context: data.context,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for config change events - this is the critical part for fixing!
    this.daemon.on('config-changed', (config) => {
      console.log('[DAEMON-WEB] Config changed event received, broadcasting to WebSocket clients');
      this.io.emit('config-changed', {
        config,
        timestamp: new Date().toISOString()
      });
      // Broadcast latest status after config change
      this.broadcastStatusUpdate();
    });

    // Listen for log manager events, push logs to web clients in real-time
    globalLogManager.on('log-added', (data) => {
      this.io.emit('enhanced-log-added', {
        serverName: data.serverName,
        logEntry: data.logEntry,
        timestamp: data.logEntry.timestamp
      });
    });

    globalLogManager.on('server-error', (data) => {
      this.io.emit('server-log-error', data);
    });

    globalLogManager.on('connection-status-changed', (data) => {
      this.io.emit('server-connection-status', data);
    });

    this.daemon.on('server-toggled', (data) => {
      console.log(`[DAEMON-WEB] Server toggled event received: ${data.name} enabled: ${data.enabled}`);
      const systemStatus = this.getSystemStatus();
      if (systemStatus) {
        this.io.emit('server-status-changed', {
          event: data.enabled ? 'server-enabled' : 'server-disabled',
          serverName: data.name,
          systemStatus: systemStatus,
          originalData: data,
          timestamp: new Date().toISOString()
        });
      } else {
        this.broadcastStatusUpdate();
      }
    });
  }

  // API handlers
  private async handleGetStatus(req: express.Request, res: express.Response) {
    try {
      const status = this.daemon['getFullStatus'](); // Access private method of daemon
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get status',
        message: (error as Error).message
      });
    }
  }

  private async handleGetServers(req: express.Request, res: express.Response) {
    try {
      // Get all servers from config file to merge configuration information
      const configManager = this.daemon['configManager'];
      const config = configManager.getConfig();
      const configServers = config.servers || {};
      
      // Get runtime status
      const status = this.daemon['getFullStatus']();
      const runtimeServers = status.servers || [];
      const toolRouter = this.daemon['mcpServer'].getToolRouter();
      
      // Create runtime status map
      const runtimeMap = new Map();
      (status.servers || []).forEach((server: any) => {
        runtimeMap.set(server.name, server);
      });
      
      // Merge configuration and runtime information
      const serversWithTools = Object.entries(configServers).map(([serverName, serverConfig]: [string, any]) => {
        const runtimeInfo = runtimeMap.get(serverName);
        const isConnected = !!runtimeInfo?.connected;
        const tools = isConnected ? toolRouter.getToolsByServer(serverName) : [];
        const enabledTools = isConnected ? toolRouter.getEnabledToolsByServer(serverName) : [];
        
        return {
          // Include all ServerConfig properties and ensure name is set correctly
          ...serverConfig,
          name: serverName, // Always use the key as the definitive name
          // Add server runtime status
          connected: isConnected,
          toolCount: tools.length,
          enabledToolCount: enabledTools.length,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            enabled: this.isToolEnabled(serverConfig, tool.name),
            inputSchema: tool.inputSchema,
            settings: {}
          }))
        };
      });
      
      res.json(serversWithTools);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get servers',
        message: (error as Error).message
      });
    }
  }

  private async handleGetTools(req: express.Request, res: express.Response) {
    try {
      const mcpServer = this.daemon['mcpServer'];
      const toolRouter = mcpServer.getToolRouter();
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

  private async handleCallTool(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const { args } = req.body;
      
      const mcpServer = this.daemon['mcpServer'];
      const toolRouter = mcpServer.getToolRouter();
      const result = await toolRouter.callTool(name, args || {});
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to call tool',
        message: (error as Error).message
      });
    }
  }

  private async handleGetConfig(req: express.Request, res: express.Response) {
    try {
      const configManager = this.daemon['configManager'];
      const config = configManager.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get config',
        message: (error as Error).message
      });
    }
  }

  private async handleGetClients(req: express.Request, res: express.Response) {
    try {
      const clients = this.daemon['clients'];
      const clientList = Array.from(clients.values()).map(c => ({
        id: c.id,
        type: c.type,
        lastSeen: c.lastSeen
      }));
      res.json(clientList);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get clients',
        message: (error as Error).message
      });
    }
  }

  private async handleReloadConfig(req: express.Request, res: express.Response) {
    try {
      await this.daemon['reloadConfig']();
      res.json({ success: true, message: 'Config reloaded' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to reload config',
        message: (error as Error).message
      });
    }
  }

  // WebSocket helper methods
  private async sendStatusUpdate(socket: any) {
    try {
      const status = this.daemon['getFullStatus']();
      
      // Get all servers from config file to merge configuration information
      const configManager = this.daemon['configManager'];
      const config = configManager.getConfig();
      const configServers = config.servers || {};
      const toolRouter = this.daemon['mcpServer'].getToolRouter();
      
      // Get latest adapter status directly from toolRouter to avoid caching issues
      const allAdapters = toolRouter.getAllAdapters();
      const runtimeMap = new Map();
      allAdapters.forEach((adapter: any) => {
        runtimeMap.set(adapter.name, {
          connected: adapter.isConnected,
          toolCount: toolRouter.getToolsByServer(adapter.name).length,
          enabledToolCount: toolRouter.getEnabledToolsByServer(adapter.name).length
        });
      });
      
      // Merge configuration and runtime information
      const serversWithTools = Object.entries(configServers).map(([serverName, serverConfig]: [string, any]) => {
        const runtimeInfo = runtimeMap.get(serverName);
        const isConnected = runtimeInfo ? !!runtimeInfo.connected : false;
        const toolCount = runtimeInfo ? runtimeInfo.toolCount : 0;
        const enabledToolCount = runtimeInfo ? runtimeInfo.enabledToolCount : 0;
        const tools = isConnected ? toolRouter.getToolsByServer(serverName) : [];
        
        return {
          // Include all ServerConfig properties and ensure name is set correctly
          ...serverConfig,
          name: serverName, // Always use the key as the definitive name
          // Add server runtime status
          connected: isConnected,
          toolCount: toolCount,
          enabledToolCount: enabledToolCount,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            enabled: this.isToolEnabled(serverConfig, tool.name),
            inputSchema: tool.inputSchema,
            settings: {}
          }))
        };
      });
      
      // Send status update with structure consistent with /api/servers
      const enhancedStatus = {
        ...status,
        servers: serversWithTools
      };
      
      console.log(`[DAEMON-WEB] Broadcasting status update: ${serversWithTools.map(s => `${s.name}(connected:${s.connected}, tools:${s.toolCount})`).join(', ')}`);
      socket.emit('status-update', enhancedStatus);
    } catch (error) {
      console.error('[DAEMON-WEB] Error sending status update:', error);
      socket.emit('error', {
        error: 'Failed to get status',
        message: (error as Error).message
      });
    }
  }

  private broadcastStatusUpdate() {
    this.io.sockets.sockets.forEach(socket => {
      this.sendStatusUpdate(socket);
    });
  }

  // Get complete system status
  private getSystemStatus() {
    try {
      const toolRouter = this.daemon['mcpServer'].getToolRouter();
      const configManager = this.daemon['configManager'];
      const config = configManager.getConfig();
      
      const serversConfig = config?.servers || {};
      const enabledServers = Object.keys(serversConfig).filter(name => serversConfig[name].enabled !== false);
      
      // Get latest adapter status directly from toolRouter to avoid caching issues
      const allAdapters = toolRouter.getAllAdapters();
      const runtimeMap = new Map();
      allAdapters.forEach((adapter: any) => {
        runtimeMap.set(adapter.name, {
          connected: adapter.isConnected,
          toolCount: toolRouter.getToolsByServer(adapter.name).length,
          enabledToolCount: toolRouter.getEnabledToolsByServer(adapter.name).length
        });
      });

      const connectedCount = allAdapters.filter((adapter: any) => adapter.isConnected).length;
      const totalTools = allAdapters.reduce((sum: number, adapter: any) => {
        return sum + toolRouter.getToolsByServer(adapter.name).length;
      }, 0);
      const totalEnabledTools = allAdapters.reduce((sum: number, adapter: any) => {
        return sum + toolRouter.getEnabledToolsByServer(adapter.name).length;
      }, 0);

      const serversWithTools = enabledServers.map(serverName => {
        const serverConfig = { ...serversConfig[serverName], name: serverName };
        const runtimeInfo = runtimeMap.get(serverName);
        const isConnected = runtimeInfo ? runtimeInfo.connected : false;
        const toolCount = runtimeInfo ? runtimeInfo.toolCount : 0;
        const enabledToolCount = runtimeInfo ? runtimeInfo.enabledToolCount : 0;
        const tools = isConnected ? toolRouter.getToolsByServer(serverConfig.name) : [];
        
        return {
          ...serverConfig,
          connected: isConnected,
          toolCount: toolCount,
          enabledToolCount: enabledToolCount,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            enabled: this.isToolEnabled(serverConfig, tool.name),
            inputSchema: tool.inputSchema,
            settings: {}
          }))
        };
      });

      return {
        total: enabledServers.length,
        connected: connectedCount,
        totalTools: totalTools, // This should be total tools
        enabledTools: totalEnabledTools, // This should be enabled tools
        servers: serversWithTools
      };
    } catch (error) {
      console.error('[DAEMON-WEB] Error getting system status:', error);
      return null;
    }
  }

  private async handleAddServer(req: express.Request, res: express.Response) {
    try {
      const { name, config } = req.body;
      const configManager = this.daemon['configManager'];

      // Validate server name
      const nameValidation = ServerNameValidator.validateServerName(name);
      if (!nameValidation.valid) {
        return res.status(400).json({ 
          error: 'Invalid server name', 
          details: nameValidation.error,
          suggestions: nameValidation.suggestions
        });
      }

      // Check for name conflicts
      if (configManager.checkServerNameConflict(name)) {
        return res.status(409).json({ 
          error: 'Server name already exists',
          existingName: name
        });
      }

      try {
        // Add the server
        configManager.addServer(name, config);
        await configManager.saveConfig();
        await configManager.loadConfig();
        
        // Only start the server if it's enabled, without reloading all config
        if (config.enabled) {
          console.log(`[DAEMON-WEB] Server ${name} is enabled, starting it directly`);
          // Use configManager's toggleServer method to start the server
          configManager.toggleServer(name, true);
        } else {
          console.log(`[DAEMON-WEB] Server ${name} is disabled, skipping start`);
        }

        // Emit a server-added event for the specific server
        const systemStatus = this.getSystemStatus();
        if (systemStatus) {
          this.io.emit('server-status-changed', {
            event: 'server-added',
            serverName: name,
            systemStatus: systemStatus,
            originalData: { name, ...config },
            timestamp: new Date().toISOString()
          });
        }

        res.json({ 
          success: true, 
          message: `Server ${name} added successfully`,
          server: { name, ...config }
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to add server',
          message: (error as Error).message
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to add server',
        message: (error as Error).message
      });
    }
  }

  private async handleUpdateServer(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const serverConfig = req.body;
      const configManager = this.daemon['configManager'];

      // If name is being updated, validate the new name
      if (serverConfig.name && serverConfig.name !== name) {
        const nameValidation = ServerNameValidator.validateServerName(serverConfig.name);
        if (!nameValidation.valid) {
          return res.status(400).json({ 
            error: 'Invalid server name', 
            details: nameValidation.error,
            suggestions: nameValidation.suggestions
          });
        }

        // Check for name conflicts with other servers
        if (configManager.checkServerNameConflict(serverConfig.name)) {
          return res.status(409).json({ 
            error: 'Server name already exists',
            existingName: serverConfig.name
          });
        }
      }

      try {
        // Get the old server config to check if it was enabled
        const oldConfig = configManager.getServerConfig(name);
        const wasEnabled = oldConfig?.enabled || false;
        const nameChanged = serverConfig.name && serverConfig.name !== name;
        
        // Update the server configuration
        configManager.updateServer(name, serverConfig);
        await configManager.saveConfig();
        await configManager.loadConfig();
        
        // Get the new server config
        const newConfig = configManager.getServerConfig(serverConfig.name || name);
        const isEnabled = newConfig?.enabled || false;
        
        // Always restart the server if it was enabled, regardless of what changed
        // This ensures any config change (command, args, env, etc.) takes effect
        if (wasEnabled) {
          console.log(`[DAEMON-WEB] Server ${name} config updated, restarting server`);
          
          if (nameChanged) {
            // Name changed: disable old server and enable new server
            console.log(`[DAEMON-WEB] Disabling old server: ${name}`);
            configManager.toggleServer(name, false);
            
            console.log(`[DAEMON-WEB] Enabling new server: ${serverConfig.name}`);
            configManager.toggleServer(serverConfig.name, true);
          } else {
            // Config changed but name is the same: restart the server
            console.log(`[DAEMON-WEB] Restarting server ${name} due to config change`);
            configManager.toggleServer(name, false);
            configManager.toggleServer(name, true);
          }
        } else if (wasEnabled !== isEnabled) {
          // Only enabled status changed
          console.log(`[DAEMON-WEB] Toggling server ${serverConfig.name || name} to ${isEnabled}`);
          configManager.toggleServer(serverConfig.name || name, isEnabled);
        } else {
          console.log(`[DAEMON-WEB] Server ${name} updated but was not enabled, no restart needed`);
        }

        // Emit a server-updated event for the specific server
        const systemStatus = this.getSystemStatus();
        if (systemStatus) {
          this.io.emit('server-status-changed', {
            event: 'server-updated',
            serverName: serverConfig.name || name,
            systemStatus: systemStatus,
            originalData: { name: serverConfig.name || name, ...serverConfig },
            timestamp: new Date().toISOString()
          });
        }

        // Rely on daemon events to broadcast status update
        res.json({ 
          success: true, 
          message: `Server ${name} updated successfully`,
          server: { name: serverConfig.name || name, ...serverConfig }
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to update server',
          message: (error as Error).message
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update server',
        message: (error as Error).message
      });
    }
  }

  private async handleRemoveServer(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const configManager = this.daemon['configManager'];

      // Get the server config before removing it to check if it was enabled
      const serverConfig = configManager.getServerConfig(name);
      const wasEnabled = serverConfig?.enabled || false;

      await configManager.removeServer(name);
      await configManager.saveConfig();
      await configManager.loadConfig();
      
      // Only stop the server if it was enabled, without reloading all config
      if (wasEnabled) {
        console.log(`[DAEMON-WEB] Server ${name} was enabled, stopping it directly`);
        // Use configManager's toggleServer method to stop the server
        configManager.toggleServer(name, false);
      } else {
        console.log(`[DAEMON-WEB] Server ${name} was disabled, skipping stop`);
      }

      // Emit a server-removed event for the specific server
      const systemStatus = this.getSystemStatus();
      if (systemStatus) {
        this.io.emit('server-status-changed', {
          event: 'server-removed',
          serverName: name,
          systemStatus: systemStatus,
          originalData: { name },
          timestamp: new Date().toISOString()
        });
      }

      // Rely on daemon events to broadcast status update
      res.json({ success: true, message: `Server ${name} removed successfully` });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to remove server',
        message: (error as Error).message
      });
    }
  }

  private async handleToggleServer(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const configManager = this.daemon['configManager'];
      
      const config = configManager.getConfig();
      const serverConfig = config.servers[name];
      
      if (!serverConfig) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Use configManager's toggleServer method, which automatically emits events
      const oldEnabled = serverConfig.enabled;
      await configManager.toggleServer(name, !oldEnabled);
      
      // Save configuration to persist the change
      await configManager.saveConfig();
      
      console.log(`[DAEMON-WEB] Server ${name} toggled: ${oldEnabled} -> ${!oldEnabled}`);
      
      // ConfigManager's toggleServer method emits a server-toggled event
      // MCPDogServer already listens to this event and automatically handles server start/stop
      // No need to manually call reloadConfig() or manually connect/disconnect servers
      
      // Send composite event, including toggle operation and latest status
      setTimeout(() => {
        const systemStatus = this.getSystemStatus();
        if (systemStatus) {
          console.log(`[DAEMON-WEB] Sending server-status-changed event for toggle: ${name}`);
          this.io.emit('server-status-changed', {
            event: serverConfig.enabled ? 'server-enabled' : 'server-disabled',
            serverName: name,
            systemStatus: systemStatus,
            originalData: { enabled: serverConfig.enabled },
            timestamp: new Date().toISOString()
          });
        } else {
          // If status retrieval fails, fall back to original method
          this.broadcastStatusUpdate();
        }
      }, 100); // Short delay to ensure config is saved
      
      res.json({ 
        success: true, 
        server: name,
        enabled: serverConfig.enabled,
        message: `Server ${name} ${serverConfig.enabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to toggle server',
        message: (error as Error).message
      });
    }
  }

  private async handleUpdateConfig(req: express.Request, res: express.Response) {
    try {
      const newConfig = req.body;
      const configManager = this.daemon['configManager'];
      
      // Update config
      configManager['config'] = newConfig; // Directly set config
      await configManager.saveConfig();
      
      // Reload daemon configuration
      await this.daemon['reloadConfig']();
      
      res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update config',
        message: (error as Error).message
      });
    }
  }

  // New tool-level control API handler
  private async handleGetServerTools(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const mcpServer = this.daemon['mcpServer'];
      const configManager = this.daemon['configManager'];
      
      const serverConfig = configManager.getServerConfig(name);
      if (!serverConfig) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      const toolRouter = mcpServer.getToolRouter();
      const allTools = toolRouter.getToolsByServer(name);
      
      // Apply tool filtering config
      const toolsWithConfig = allTools.map(tool => ({
        ...tool,
        enabled: this.isToolEnabled(serverConfig, tool.name),
        settings: serverConfig.toolsConfig?.toolSettings?.[tool.name] || {}
      }));
      
      res.json({
        serverName: name,
        toolsConfig: serverConfig.toolsConfig || { mode: 'all' },
        tools: toolsWithConfig
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get server tools',
        message: (error as Error).message
      });
    }
  }

  private async handleToggleServerTool(req: express.Request, res: express.Response) {
    try {
      const { name, tool } = req.params;
      const configManager = this.daemon['configManager'];
      
      const config = configManager.getConfig();
      const serverConfig = config.servers[name];
      
      if (!serverConfig) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Initialize tool config
      if (!serverConfig.toolsConfig) {
        serverConfig.toolsConfig = { mode: 'all' };
      }
      
      if (!serverConfig.toolsConfig.toolSettings) {
        serverConfig.toolsConfig.toolSettings = {};
      }
      
      // Toggle tool status
      const currentEnabled = this.isToolEnabled(serverConfig, tool);
      serverConfig.toolsConfig.toolSettings[tool] = {
        ...serverConfig.toolsConfig.toolSettings[tool],
        enabled: !currentEnabled
      };
      
      // If mode is 'all', switch to 'blacklist' or 'whitelist' mode
      if (serverConfig.toolsConfig.mode === 'all') {
        serverConfig.toolsConfig.mode = currentEnabled ? 'blacklist' : 'whitelist';
      }
      
      // Save configuration with tool-toggle context to avoid server reconnection
      await configManager.saveConfig();
      
      // Just broadcast status update instead of full reload
      this.broadcastStatusUpdate();
      
      res.json({ 
        success: true, 
        tool,
        enabled: !currentEnabled,
        message: `Tool ${tool} ${!currentEnabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to toggle tool',
        message: (error as Error).message
      });
    }
  }

  private async handleUpdateServerTools(req: express.Request, res: express.Response) {
    try {
      const { name } = req.params;
      const { toolsConfig } = req.body;
      const configManager = this.daemon['configManager'];
      
      const config = configManager.getConfig();
      const serverConfig = config.servers[name];
      
      if (!serverConfig) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Update tool config
      serverConfig.toolsConfig = toolsConfig;
      
      // Save configuration with tool-config-update context to avoid server reconnection
      await configManager.saveConfig();
      
      // Just broadcast status update instead of full reload
      this.broadcastStatusUpdate();
      
      res.json({ success: true, message: 'Server tools configuration updated' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update server tools',
        message: (error as Error).message
      });
    }
  }

  // Helper method: check if tool is enabled
  private isToolEnabled(serverConfig: any, toolName: string): boolean {
    const toolsConfig = serverConfig.toolsConfig;
    
    if (!toolsConfig) {
      return true; // Default to all enabled
    }
    
    // Check specific tool settings
    const toolSettings = toolsConfig.toolSettings?.[toolName];
    if (toolSettings !== undefined) {
      return toolSettings.enabled;
    }
    
    // Determine based on mode
    switch (toolsConfig.mode) {
      case 'all':
        return true;
      case 'whitelist':
        return toolsConfig.enabledTools?.includes(toolName) || false;
      case 'blacklist':
        return !toolsConfig.disabledTools?.includes(toolName);
      default:
        return true;
    }
  }

  // Log API handlers
  private async handleGetAllLogs(req: express.Request, res: express.Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = globalLogManager.getAllRecentLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get logs',
        message: (error as Error).message
      });
    }
  }

  private async handleGetServerLogs(req: express.Request, res: express.Response) {
    try {
      const { serverName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as string;
      const source = req.query.source as string;
      const search = req.query.search as string;
      
      let logs;
      if (search) {
        logs = globalLogManager.searchLogs(serverName, search, { level: level as any, source: source as any, limit });
      } else {
        logs = globalLogManager.getLogs(serverName, limit);
      }
      
      res.json(logs);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get server logs',
        message: (error as Error).message
      });
    }
  }

  private async handleClearServerLogs(req: express.Request, res: express.Response) {
    try {
      const { serverName } = req.params;
      globalLogManager.clearLogs(serverName);
      res.json({ success: true, message: `Logs cleared for ${serverName}` });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to clear server logs',
        message: (error as Error).message
      });
    }
  }

  private async handleGetServerLogStats(req: express.Request, res: express.Response) {
    try {
      const { serverName } = req.params;
      const stats = globalLogManager.getStats(serverName);
      if (!stats) {
        return res.status(404).json({ error: 'Server not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get server log stats',
        message: (error as Error).message
      });
    }
  }

  // Server control
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`[DAEMON-WEB] Web interface started on port ${this.port}`);
        console.log(`[DAEMON-WEB] Dashboard: http://localhost:${this.port}`);
        console.log(`[DAEMON-WEB] WebSocket: ws://localhost:${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error: any) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[DAEMON-WEB] Web server stopped');
        resolve();
      });
    });
  }
}