import { EventEmitter } from 'events';
import { ConfigManager } from '../config/config-manager.js';
import { ToolRouter } from '../router/tool-router.js';
import { AdapterFactory } from '../adapters/adapter-factory.js';
import { 
  MCPRequest, 
  MCPResponse, 
  MCPNotification, 
  ClientCapabilities, 
  ServerAdapter,
  MCPServerConfig 
} from '../types/index.js';

export class MCPDogServer extends EventEmitter {
  private configManager: ConfigManager;
  private toolRouter: ToolRouter;
  private clientCapabilities?: ClientCapabilities;
  private isInitialized: boolean = false;
  private requestId: number = 1;
  private handledRequests: Set<string> = new Set(); // Server-level request deduplication
  private isStarted: boolean = false; // Prevent duplicate starts

  constructor(configManager: ConfigManager) {
    super();
    
    console.error(`[SERVER] Creating MCPDogServer instance (PID: ${process.pid})`);
    
    this.configManager = configManager;
    this.toolRouter = new ToolRouter(this.configManager);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Config change handling
    this.configManager.on('config-updated', (data) => {
      const changeType = data.context?.changeType;
      const serverName = data.context?.serverName;

      // If it's a server or tool related toggle, skip full reinitialization
      if (changeType === 'server-toggle') {
        console.log(`[SERVER] Skipping adapter reinitialization for server toggle: ${serverName}`);
      } else if (changeType === 'tool-toggle' || changeType === 'tool-config-update') {
        console.log(`[SERVER] Skipping adapter reinitialization for tool update on: ${serverName}`);
      } else {
        this.handleConfigUpdate().catch((error: any) => {
          console.error('Error handling config update:', error);
        });
      }
    });

    

    // Listen for single server toggle status changes
    this.configManager.on('server-toggled', async ({ name, enabled }) => {
      console.error(`[SERVER] Server ${name} toggled to ${enabled}`);
      const serverConfig = this.configManager.getServerConfig(name);
      if (!serverConfig) {
        console.error(`[SERVER] Toggled server ${name} not found in config.`);
        return;
      }

      if (enabled) {
        // Enable server: create and add adapter if not exists; if exists but not connected, try to connect
        let adapter = this.toolRouter.getAdapter(name);
        if (!adapter) {
          try {
            adapter = AdapterFactory.createAdapter(name, serverConfig);
            this.setupAdapterEvents(adapter);
            this.toolRouter.addAdapter(adapter);
            console.error(`[SERVER] Created and added adapter for ${name}`);
          } catch (error) {
            console.error(`[SERVER] Failed to create adapter for ${name}:`, error);
            return;
          }
        }
        if (adapter && !adapter.isConnected) {
          try {
            await adapter.connect();
            console.error(`[SERVER] Connected adapter for ${name}`);
          } catch (error) {
            console.error(`[SERVER] Failed to connect adapter for ${name}:`, error);
          }
        }
      } else {
        // Disable server: remove adapter
        this.toolRouter.removeAdapter(name);
        console.error(`[SERVER] Removed adapter for ${name}`);
      }
      this.notifyToolsChanged().catch(error => {
        console.error('Error notifying tools changed after toggle:', error);
      });
    });

    // Tool router event handling
    this.toolRouter.on('routes-updated', ({ serverName, toolCount }) => {
      console.error(`Tools updated for ${serverName}: ${toolCount} tools`);
      this.notifyToolsChanged().catch(error => {
        console.error('Error notifying tools changed:', error);
      });
    });

    this.toolRouter.on('tool-called', ({ serverName, toolName, args, result, duration }) => {
      console.error(`Tool executed: ${serverName}.${toolName} (${duration}ms)`);
    });

    this.toolRouter.on('error', ({ error, context }) => {
      console.error(`Router error [${context}]:`, error);
      this.emit('error', { error, context });
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.error(`[SERVER] MCPDog Server already started, ignoring duplicate start() call`);
      return;
    }
    
    try {
      console.error(`[SERVER] Starting MCPDog Server... (PID: ${process.pid})`);
      this.isStarted = true;
      
      // Load config
      await this.configManager.loadConfig();
      console.error(`[SERVER] Config loaded in MCPDogServer: ${JSON.stringify(this.configManager.getConfig().servers)}`);
      
      // Start watching config file changes
      this.configManager.startWatching();
      
      // Initialize adapters
      await this.initializeAdapters();
      
      console.error(`[SERVER] MCPDog Server started successfully (PID: ${process.pid})`);
      this.emit('started');
      
    } catch (error) {
      this.isStarted = false; // Reset status, allow retry
      console.error('Failed to start MCPDog Server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.error('Stopping MCPDog Server...');
      
      // Stop config watching
      this.configManager.stopWatching();
      
      // Disconnect all adapters
      await this.toolRouter.disconnectAll();
      
      // Cleanup
      this.isInitialized = false;
      this.clientCapabilities = undefined;
      
      console.error('MCPDog Server stopped');
      this.emit('stopped');
      
    } catch (error) {
      console.error('Error stopping MCPDog Server:', error);
      throw error;
    }
  }

  private async initializeAdapters(): Promise<void> {
    const config = this.configManager.getConfig();
    const enabledServers = this.configManager.getEnabledServers();

    console.error(`[SERVER] Initializing ${Object.keys(enabledServers).length} enabled servers from config: ${JSON.stringify(enabledServers)}`);

    // First create all adapters (fast operation)
    for (const [serverName, serverConfig] of Object.entries(enabledServers)) {
      try {
        await this.createAndAddAdapter(serverName, serverConfig);
      } catch (error) {
        console.error(`Failed to initialize adapter ${serverName}:`, error);
      }
    }

    // Asynchronously connect all adapters, do not wait for completion
    console.error(`[SERVER] Starting asynchronous connection of ${Object.keys(enabledServers).length} servers...`);
    this.connectAdaptersInBackground();
  }

  private connectAdaptersInBackground(): void {
    // Do not use await, let connections happen in the background
    this.toolRouter.connectAll({
      timeout: 5000,  // 5 second timeout to avoid long waits for problematic servers
      maxConcurrent: 2  // Limit concurrency to avoid excessive system resource usage
    }).then(() => {
      console.error(`[SERVER] ✅ Background server connection process completed`);
    }).catch(error => {
      console.error(`[SERVER] ❌ Error during background server connection:`, error);
      // Do not throw error, let server continue running
    });
  }

  private async createAndAddAdapter(serverName: string, config: MCPServerConfig): Promise<void> {
    try {
      // Use adapter factory to create adapter
      const adapter = AdapterFactory.createAdapter(serverName, config);
      
      // Listen for adapter events
      this.setupAdapterEvents(adapter);
      
      this.toolRouter.addAdapter(adapter);
      console.error(`Added adapter: ${serverName} (${config.transport})`);
    } catch (error) {
      console.error(`Failed to create adapter ${serverName}:`, (error as Error).message);
      throw error;
    }
  }

  private setupAdapterEvents(adapter: ServerAdapter): void {
    // Listen for connection events
    adapter.on('connected', (data) => {
      console.error(`Connected to ${adapter.name}`);
      const eventData = {
        serverName: adapter.name,
        timestamp: new Date().toISOString(),
        ...data
      };
      console.error(`[SERVER] Emitting server-connected event:`, eventData);
      this.emit('server-connected', eventData);
    });

    // Listen for disconnection events
    adapter.on('disconnected', (data) => {
      console.error(`Disconnected from ${adapter.name}`);
      this.emit('server-disconnected', {
        serverName: adapter.name,
        timestamp: new Date().toISOString(),
        ...data
      });
    });

    // Listen for error events
    adapter.on('error', (error) => {
      console.error(`Adapter error for ${adapter.name}:`, error);
      this.emit('server-error', {
        serverName: adapter.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for log events
    adapter.on('log', (log) => {
      this.emit('server-log', { 
        serverName: adapter.name, 
        ...log, 
        timestamp: new Date().toISOString() 
      });
    });
  }

  

  

  

  

  

  private async reinitializeAdapters(): Promise<void> {
    // Stop all existing adapters
    const existingAdapters = this.toolRouter.getAllAdapters();
    for (const adapter of existingAdapters) {
      this.toolRouter.removeAdapter(adapter.name);
    }

    // Reinitialize adapters
    const enabledServers = this.configManager.getEnabledServers();
    for (const [serverName, serverConfig] of Object.entries(enabledServers)) {
      try {
        const adapter = AdapterFactory.createAdapter(serverName, serverConfig);
        this.setupAdapterEvents(adapter);
        this.toolRouter.addAdapter(adapter);
      } catch (error: any) {
        console.error(`Failed to create adapter ${serverName} during reinitialization:`, error);
      }
    }
    this.connectAdaptersInBackground();
  }

  private async handleConfigUpdate(): Promise<void> {
    // Overall config file update, reinitialize all adapters
    await this.reinitializeAdapters();
  }

  

  // Config management proxy methods
  async addServer(name: string, config: Omit<MCPServerConfig, 'name'>): Promise<void> {
    const fullConfig: MCPServerConfig = { ...config, name };
    await this.configManager.addServer(name, fullConfig);
    const serverConfig = this.configManager.getServerConfig(name)!;
    if (serverConfig.enabled) {
      try {
        const adapter = AdapterFactory.createAdapter(name, serverConfig);
        this.setupAdapterEvents(adapter);
        this.toolRouter.addAdapter(adapter);
        await adapter.connect();
      } catch (error: any) {
        console.error(`Failed to add and connect server ${name}:`, error);
      }
    }
    this.notifyToolsChanged().catch((error: any) => {
      console.error('Error notifying tools changed after addServer:', error);
    });
  }

  async removeServer(name: string): Promise<void> {
    this.toolRouter.removeAdapter(name);
    await this.configManager.removeServer(name);
    this.notifyToolsChanged().catch((error: any) => {
      console.error('Error notifying tools changed after removeServer:', error);
    });
  }

  async toggleServer(name: string, enabled?: boolean): Promise<void> {
    const serverConfig = this.configManager.getServerConfig(name);
    if (!serverConfig) {
      throw new Error(`Server ${name} not found`);
    }

    const newEnabled = enabled !== undefined ? enabled : !serverConfig.enabled;
    await this.configManager.toggleServer(name, newEnabled);
    
    // Status change is handled by configManager's server-toggled event, no extra logic needed here
  }

  async updateServerTools(serverName: string): Promise<void> {
    console.log(`[SERVER] Updating tools for server: ${serverName}`);
    await this.toolRouter.updateServerTools(serverName);
    this.notifyToolsChanged().catch(error => {
      console.error(`Error notifying tools changed after tool update for ${serverName}:`, error);
    });
  }

  // MCP protocol handling methods
  async handleRequest(request: MCPRequest, clientId?: string): Promise<MCPResponse> {
    try {
      // For initialize requests, allow multiple clients to initialize, but do not re-initialize the server
      if (request.method === 'initialize') {
        return await this.handleInitialize(request);
      }

      // For other requests, perform deduplication check (including client ID to support multiple clients)
      const requestKey = `${clientId || 'unknown'}_${request.method}_${request.id}`;
      if (this.handledRequests.has(requestKey)) {
        console.error(`[DEDUP] Duplicate request from client ${clientId}, ignoring: ${request.method} (id: ${request.id})`);
        // Throw special error to prevent response sending
        throw new Error('DUPLICATE_REQUEST_IGNORED');
      }
      
      this.handledRequests.add(requestKey);
      
      // Clean up old request records
      if (this.handledRequests.size > 300) {
        const entries = Array.from(this.handledRequests);
        entries.slice(0, 150).forEach(key => this.handledRequests.delete(key));
      }
      
      console.error(`Handling request: ${request.method} (id: ${request.id})`);

      switch (request.method) {
        case 'initialize':
          // This branch will never be executed, as it's handled above
          return await this.handleInitialize(request);
        
        case 'tools/list':
          return await this.handleToolsList(request);
        
        case 'tools/call':
          return await this.handleToolCall(request);
        
        case 'resources/list':
          return await this.handleResourcesList(request);
        
        case 'prompts/list':
          return await this.handlePromptsList(request);
        
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
      }
    } catch (error) {
      console.error(`Error handling request ${request.method}:`, error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: `Internal error: ${(error as Error).message}`
        }
      };
    }
  }

  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params || {};
    
    // Record current client capabilities, but do not overwrite previous ones (supports multiple clients)
    const clientCapabilities = {
      supportsNotifications: params.capabilities?.notifications !== undefined,
      clientName: params.clientInfo?.name || 'unknown',
      clientVersion: params.clientInfo?.version || 'unknown'
    };

    console.error(`Client connected: ${clientCapabilities.clientName} v${clientCapabilities.clientVersion}`);
    console.error(`Notifications supported: ${clientCapabilities.supportsNotifications}`);

    // If it's the first client, set primary capabilities; otherwise retain existing capabilities
    if (!this.isInitialized) {
      this.clientCapabilities = clientCapabilities;
      this.isInitialized = true;
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {},
          notifications: {
            tools: {
              listChanged: true
            }
          }
        },
        serverInfo: {
          name: 'mcpdog',
          version: '2.0.0'
        }
      }
    };
  }

  private async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    if (!this.isInitialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32002,
          message: 'Server not initialized'
        }
      };
    }

    // Smart waiting mechanism: give slower servers more connection time
    const waitTime = this.calculateOptimalWaitTime();
    if (waitTime > 0) {
      console.error(`⏳ Waiting ${waitTime}ms for all servers to connect...`);
      // For health checks, use a shorter wait time
      const maxWaitTime = Math.min(waitTime, 3000); // Wait at most 3 seconds
      await new Promise(resolve => setTimeout(resolve, maxWaitTime));
    }

    // Try multiple times to get a stable tool list
    let tools = await this.toolRouter.getAllTools(true); // Force refresh
    let attempts = 1;
    const maxAttempts = 3;
    
    // Calculate expected minimum number of tools based on configured servers (at least 5 tools per server)
    const enabledServers = Object.keys(this.configManager.getEnabledServers()).length;
    const expectedMinTools = Math.max(5, enabledServers * 5);
    
    // If tool count is too low, some servers might not be fully connected, try again
    while (attempts < maxAttempts && tools.length < expectedMinTools && enabledServers > 1) {
      console.error(`🔄 Tools count low (${tools.length}), retrying... (attempt ${attempts + 1})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      tools = await this.toolRouter.getAllTools(true);
      attempts++;
    }

    // Log current tool distribution
    const toolsByServer = this.toolRouter.getToolDistribution();
    console.error(`📊 Current tool distribution:`, toolsByServer);
    console.error(`🔢 Total tools returned: ${tools.length}`);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools
      }
    };
  }

  private calculateOptimalWaitTime(): number {
    const connectedServers = this.toolRouter.getConnectedServerCount();
    const totalServers = this.toolRouter.getTotalServerCount();
    
    // If all servers are connected, no need to wait
    if (connectedServers >= totalServers) {
      return 0;
    }
    
    // For health checks, prioritize shorter wait times
    // If most servers are connected (>=50%), respond quickly
    const connectionRatio = connectedServers / totalServers;
    if (connectionRatio >= 0.5) {
      return 1000; // 1 second quick response
    }
    
    // Even if few servers are connected, prioritize quick response over waiting for all servers
    if (connectedServers > 0) {
      return 2000; // 2 second medium response time
    }
    
    // Only use longer wait time if no servers are connected
    return Math.min(3000, totalServers * 800); // At most 3 seconds, 800ms per server
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    if (!this.isInitialized) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32002,
          message: 'Server not initialized'
        }
      };
    }

    const params = request.params || {};
    const toolName = params.name;
    const args = params.arguments || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Tool name is required'
        }
      };
    }

    const response = await this.toolRouter.callTool(toolName, args);
    
    // Use original request ID
    return {
      ...response,
      id: request.id
    };
  }

  private async notifyToolsChanged(): Promise<void> {
    if (!this.isInitialized || !this.clientCapabilities?.supportsNotifications) {
      return;
    }

    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed'
    };

    this.emit('notification', notification);
  }

  

  // Status query method
  getStatus(): {
    initialized: boolean;
    client?: ClientCapabilities;
    config: any;
    routes: any;
  } {
    return {
      initialized: this.isInitialized,
      client: this.clientCapabilities,
      config: {
        servers: Object.keys(this.configManager.getConfig().servers).length,
        enabled: Object.keys(this.configManager.getEnabledServers()).length
      },
      routes: this.toolRouter.getRouteStatus()
    };
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  getToolRouter(): ToolRouter {
    return this.toolRouter;
  }

  /**
   * Public method to handle config updates
   * This is called by the daemon when config is reloaded
   */
  async handleConfigReload(): Promise<void> {
    await this.handleConfigUpdate();
  }

  private async handleResourcesList(request: MCPRequest): Promise<MCPResponse> {
    // MCPDog currently does not provide resources, return empty list for Cursor compatibility
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: []
      }
    };
  }

  private async handlePromptsList(request: MCPRequest): Promise<MCPResponse> {
    // MCPDog currently does not provide prompt templates, return empty list for Cursor compatibility
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        prompts: []
      }
    };
  }

  async waitForToolsReady(): Promise<void> {
    const maxAttempts = 10;
    const delay = 500; // 500ms
    const startTime = Date.now();
    
    for (let i = 0; i < maxAttempts; i++) {
      const enabledServersCount = Object.keys(this.configManager.getEnabledServers()).length;
      const connectedAdaptersCount = this.toolRouter.getConnectedServerCount();
      const totalTools = (await this.toolRouter.getAllTools()).length;

      // If no enabled servers, return directly
      if (enabledServersCount === 0) {
        console.error(`[SERVER] No enabled servers, skipping wait.`);
        return;
      }

      // If all servers are connected, or enough tools are available
      if (enabledServersCount === connectedAdaptersCount || 
          (connectedAdaptersCount > 0 && totalTools >= connectedAdaptersCount * 2)) {
        console.error(`[SERVER] ${connectedAdaptersCount}/${enabledServersCount} servers connected and ${totalTools} tools loaded.`);
        return;
      }

      console.error(`[SERVER] Waiting for tools to be ready. Connected: ${connectedAdaptersCount}/${enabledServersCount}, Tools: ${totalTools}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const elapsedTime = Date.now() - startTime;
    const connectedCount = this.toolRouter.getConnectedServerCount();
    const totalCount = Object.keys(this.configManager.getEnabledServers()).length;
    
    console.error(`[SERVER] Timeout after ${elapsedTime}ms. ${connectedCount}/${totalCount} servers connected.`);
    
    // Do not throw error, but warn and continue running
    if (connectedCount > 0) {
      console.error(`[SERVER] Proceeding with ${connectedCount} connected servers (some servers may have failed to start).`);
      return;
    } else {
      console.error(`[SERVER] Warning: No servers connected, but proceeding anyway.`);
      // Even if no servers are connected, do not throw an error, let the system continue to run
      return;
    }
  }
}