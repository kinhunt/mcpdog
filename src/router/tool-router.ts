import { EventEmitter } from 'events';
import { MCPTool, MCPRequest, MCPResponse, ServerAdapter, MCPServerConfig } from '../types/index.js';
import { ConfigManager } from '../config/config-manager.js';

export interface ToolRoute {
  toolName: string;
  serverName: string;
  adapter: ServerAdapter;
}

export class ToolRouter extends EventEmitter {
  private adapters: Map<string, ServerAdapter> = new Map();
  private toolRoutes: Map<string, ToolRoute> = new Map();
  private toolsByServer: Map<string, MCPTool[]> = new Map();
  private lastStableToolsList: MCPTool[] = []; // Cache the last stable tool list
  private lastStableToolsCount: number = 0;
  private configManager?: ConfigManager;

  constructor(configManager?: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  // Check if tool is enabled
  private isToolEnabled(serverName: string, toolName: string): boolean {
    if (!this.configManager) return true; // If no config manager, default to enabled
    
    const config = this.configManager.getConfig();
    const serverConfig = config.servers[serverName];
    if (!serverConfig) return true;
    
    const toolsConfig = serverConfig.toolsConfig;
    if (!toolsConfig) return true; // No tool config, default to enabled

    const { mode, toolSettings } = toolsConfig;
    const toolSetting = toolSettings?.[toolName];

    switch (mode) {
      case 'all':
        return toolSetting ? toolSetting.enabled : true;
      case 'whitelist':
        return toolSetting ? toolSetting.enabled : false;
      case 'blacklist':
        return toolSetting ? toolSetting.enabled : true;
      default:
        return true;
    }
  }

  addAdapter(adapter: ServerAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter ${adapter.name} already exists`);
    }

    this.adapters.set(adapter.name, adapter);
    
    // Listen for adapter events
    adapter.on('connected', () => {
      this.refreshToolRoutes(adapter.name).catch(error => {
        console.error(`Failed to refresh routes for ${adapter.name}:`, error);
      });
    });

    adapter.on('disconnected', () => {
      this.removeToolRoutes(adapter.name);
    });

    adapter.on('tools-changed', () => {
      this.refreshToolRoutes(adapter.name).catch(error => {
        console.error(`Failed to refresh routes for ${adapter.name}:`, error);
      });
    });

    console.error(`Added adapter: ${adapter.name}`);
  }

  removeAdapter(serverName: string): void {
    const adapter = this.adapters.get(serverName);
    if (!adapter) {
      return;
    }

    // Remove all related routes
    this.removeToolRoutes(serverName);
    
    // Disable adapter to prevent auto-reconnect
    if ('disable' in adapter && typeof adapter.disable === 'function') {
      (adapter as any).disable();
    }
    
    // Disconnect
    if (adapter.isConnected) {
      adapter.disconnect().catch(error => {
        console.error(`Error disconnecting ${serverName}:`, error);
      });
    }

    // Remove event listeners
    adapter.removeAllListeners();

    this.adapters.delete(serverName);
    console.error(`Removed adapter: ${serverName}`);
  }

  getAdapter(serverName: string): ServerAdapter | undefined {
    return this.adapters.get(serverName);
  }

  getAllAdapters(): ServerAdapter[] {
    return Array.from(this.adapters.values());
  }

  getConnectedAdapters(): ServerAdapter[] {
    return Array.from(this.adapters.values()).filter(adapter => adapter.isConnected);
  }

  private async refreshToolRoutes(serverName: string): Promise<void> {
    const adapter = this.adapters.get(serverName);
    if (!adapter || !adapter.isConnected) {
      return;
    }

    try {
      // Get server's tool list
      const tools = await adapter.getTools();
      
      // Remove old routes for this server
      this.removeToolRoutes(serverName);
      
      // Cache tool list
      this.toolsByServer.set(serverName, tools);

      // Create new routes
      for (const tool of tools) {
        const originalToolName = tool.name;
        let prefixedToolName = tool.name;
        
        // Check for name conflict
        const existingRoute = this.toolRoutes.get(originalToolName);
        
        if (existingRoute) {
          console.warn(`Tool name conflict: ${originalToolName} exists in both ${existingRoute.serverName} and ${serverName}`);
          // Resolve conflict by prefixing with server name
          prefixedToolName = `${serverName}-${originalToolName}`;
          console.log(`🔧 Resolving conflict: ${originalToolName} -> ${prefixedToolName}`);
          
          // Also prefix the original tool
          const originalRoute = this.toolRoutes.get(originalToolName);
          if (originalRoute) {
            const originalPrefixedName = `${originalRoute.serverName}-${originalToolName}`;
            this.toolRoutes.set(originalPrefixedName, {
              ...originalRoute,
              toolName: originalPrefixedName
            });
            console.log(`🔧 Original tool renamed: ${originalToolName} -> ${originalPrefixedName}`);
          }
        }

        const route: ToolRoute = {
          toolName: prefixedToolName,
          serverName,
          adapter
        };

        this.toolRoutes.set(prefixedToolName, route);
      }

      console.error(`Refreshed ${tools.length} tool routes for ${serverName}`);
      this.emit('routes-updated', { serverName, toolCount: tools.length });

    } catch (error) {
      console.error(`Failed to refresh tool routes for ${serverName}:`, error);
      this.emit('error', { 
        error: error as Error, 
        context: `refresh-routes-${serverName}` 
      });
    }
  }

  private removeToolRoutes(serverName: string): void {
    // Remove all tool routes for this server
    const toolsToRemove: string[] = [];
    
    for (const [toolName, route] of this.toolRoutes) {
      if (route.serverName === serverName) {
        toolsToRemove.push(toolName);
      }
    }

    for (const toolName of toolsToRemove) {
      this.toolRoutes.delete(toolName);
    }

    // Clear cache
    this.toolsByServer.delete(serverName);

    if (toolsToRemove.length > 0) {
      console.error(`Removed ${toolsToRemove.length} tool routes for ${serverName}`);
      this.emit('routes-updated', { serverName, toolCount: 0 });
    }
  }

  async getAllTools(forceRefresh: boolean = false): Promise<MCPTool[]> {
    const connectedAdapters = this.getConnectedAdapters();

    // If no adapters are connected, return empty tool list (security fix)
    if (connectedAdapters.length === 0) {
      console.error(`📦 No adapters connected, returning empty tools list for security`);
      // Clear stable tool cache to ensure disabled tools are not leaked
      this.lastStableToolsList = [];
      this.lastStableToolsCount = 0;
      return [];
    }

    // Step 1: Collect tools from all servers, with server info
    const allServerTools: Array<{tool: MCPTool, serverName: string}> = [];
    
    for (const adapter of connectedAdapters) {
      let serverTools = this.toolsByServer.get(adapter.name) || [];
      
      // If cache is empty or force refresh, try to get in real-time
      if (serverTools.length === 0 || forceRefresh) {
        try {
          console.error(`Real-time fetching tools from ${adapter.name}...`);
          const freshTools = await Promise.race([
            adapter.getTools(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 8000)
            )
          ]);
          
          if (freshTools.length > 0) {
            this.toolsByServer.set(adapter.name, freshTools);
            serverTools = freshTools;
            console.error(`✅ Got ${freshTools.length} tools from ${adapter.name}`);
          }
        } catch (error) {
          console.error(`⚠️ Failed to fetch tools from ${adapter.name}: ${(error as Error).message}`);
          // Continue with cached tools (if any)
        }
      }
      
      // Add enabled tools to the list
      for (const tool of serverTools) {
        if (this.isToolEnabled(adapter.name, tool.name)) {
          allServerTools.push({ tool, serverName: adapter.name });
        }
      }
    }

    // Step 2: Detect tool name conflicts
    const toolNameCounts = new Map<string, number>();
    for (const {tool} of allServerTools) {
      const count = toolNameCounts.get(tool.name) || 0;
      toolNameCounts.set(tool.name, count + 1);
    }

    // Step 3: Resolve conflicts, generate final tool list
    const allTools: MCPTool[] = [];
    for (const {tool, serverName} of allServerTools) {
      const originalToolName = tool.name;
      let finalToolName = originalToolName;
      
      // If there's a conflict, use server name as prefix
      if (toolNameCounts.get(originalToolName)! > 1) {
        finalToolName = `${serverName}-${originalToolName}`;
      }
      
      allTools.push({
        ...tool,
        name: finalToolName,
        // Add server info to tool description
        description: `[${serverName}] ${tool.description}`
      });
    }

    // If a reasonable number of tools are obtained, update the stable cache
    if (allTools.length >= this.lastStableToolsCount * 0.8) { // At least 80% of tools
      this.lastStableToolsList = [...allTools];
      this.lastStableToolsCount = allTools.length;
      console.error(`💾 Updated stable tools cache: ${allTools.length} tools`);
    }
    
    // Security fix: always return currently available tools, do not use cache
    // This ensures disabled servers/tools are not visible to MCP clients

    return allTools;
  }

  getToolsByServer(serverName: string): MCPTool[] {
    return this.toolsByServer.get(serverName) || [];
  }

  getEnabledToolsByServer(serverName: string): MCPTool[] {
    const serverTools = this.toolsByServer.get(serverName) || [];
    return serverTools.filter(tool => this.isToolEnabled(serverName, tool.name));
  }

  findToolRoute(toolName: string): ToolRoute | undefined {
    return this.toolRoutes.get(toolName);
  }

  async callTool(toolName: string, args: any): Promise<MCPResponse> {
    const route = this.toolRoutes.get(toolName);
    
    if (!route) {
      // If tool not found, try to force refresh all tools
      console.error(`Tool ${toolName} not found, refreshing tools...`);
      await this.getAllTools(true); // Force refresh
      
      const refreshedRoute = this.toolRoutes.get(toolName);
      if (!refreshedRoute) {
        return {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32601,
            message: `Tool not found: ${toolName}`,
            data: { availableTools: Array.from(this.toolRoutes.keys()) }
          }
        };
      }
      // Use refreshed route
      return this.callTool(toolName, args);
    }

    if (!route.adapter.isConnected) {
      return {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32000,
          message: `Server not connected: ${route.serverName}`,
          data: { serverName: route.serverName }
        }
      };
    }

    try {
      console.error(`Routing tool call: ${toolName} -> ${route.serverName}`);
      
      // Extract the original tool name by removing the server prefix
      const originalToolName = toolName.includes('-') 
        ? toolName.split('-').slice(1).join('-')  // Handle nested dashes
        : toolName;
      
      if (originalToolName !== toolName) {
        console.error(`Stripping prefix: ${toolName} -> ${originalToolName}`);
      }
      
      const startTime = Date.now();
      const response = await route.adapter.callTool(originalToolName, args);
      const duration = Date.now() - startTime;

      console.error(`Tool call completed: ${toolName} (${duration}ms)`);
      
      this.emit('tool-called', {
        serverName: route.serverName,
        toolName,
        args,
        result: response.result,
        duration
      });

      return response;

    } catch (error) {
      console.error(`Tool call failed: ${toolName} -> ${route.serverName}:`, error);
      
      this.emit('tool-call-failed', {
        serverName: route.serverName,
        toolName,
        args,
        error: error as Error
      });

      return {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32000,
          message: `Tool call failed: ${(error as Error).message}`,
          data: { 
            toolName, 
            serverName: route.serverName,
            originalError: (error as Error).message 
          }
        }
      };
    }
  }

  async connectAll(options?: { 
    timeout?: number; 
    maxConcurrent?: number; 
  }): Promise<void> {
    const { timeout = 8000, maxConcurrent = 3 } = options || {};
    
    const adaptersToConnect = Array.from(this.adapters.values())
      .filter(adapter => !adapter.isConnected);

    if (adaptersToConnect.length === 0) {
      console.error("[ROUTER] No adapters to connect.");
      return;
    }

    console.error(`[ROUTER] Starting parallel connection of ${adaptersToConnect.length} adapters (timeout: ${timeout}ms, max concurrent: ${maxConcurrent})`);

    // Batch parallel connection, limit concurrency
    const batches: any[][] = [];
    for (let i = 0; i < adaptersToConnect.length; i += maxConcurrent) {
      batches.push(adaptersToConnect.slice(i, i + maxConcurrent));
    }

    let connectedCount = 0;
    let failedCount = 0;

    for (const batch of batches) {
      const batchPromises = batch.map(async adapter => {
        const startTime = Date.now();
        try {
          // Add timeout control for each connection
          await this.connectWithTimeout(adapter, timeout);
          const duration = Date.now() - startTime;
          console.error(`[ROUTER] ✅ ${adapter.name} connection successful (${duration}ms)`);
          connectedCount++;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`[ROUTER] ❌ ${adapter.name} connection failed (${duration}ms):`, (error as Error).message);
          failedCount++;
        }
      });

      await Promise.allSettled(batchPromises);
    }

    console.error(`[ROUTER] Connection completed: ${connectedCount} successful, ${failedCount} failed`);
  }

  private async connectWithTimeout(adapter: any, timeout: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout (${timeout}ms)`));
      }, timeout);

      try {
        await adapter.connect();
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async disconnectAll(): Promise<void> {
    const disconnectionPromises = Array.from(this.adapters.values())
      .filter(adapter => adapter.isConnected)
      .map(async adapter => {
        try {
          await adapter.disconnect();
        } catch (error) {
          console.error(`Failed to disconnect ${adapter.name}:`, error);
        }
      });

    await Promise.allSettled(disconnectionPromises);
  }

  getRouteStatus(): {
    totalAdapters: number;
    connectedAdapters: number;
    totalTools: number;
    toolsByServer: Record<string, number>;
    toolConflicts: string[];
  } {
    const connectedAdapters = this.getConnectedAdapters();
    const toolsByServer: Record<string, number> = {};
    const toolNames = new Set<string>();
    const toolConflicts: string[] = [];

    for (const adapter of this.adapters.values()) {
      const tools = this.toolsByServer.get(adapter.name) || [];
      toolsByServer[adapter.name] = tools.length;

      for (const tool of tools) {
        if (toolNames.has(tool.name)) {
          toolConflicts.push(tool.name);
        } else {
          toolNames.add(tool.name);
        }
      }
    }

    return {
      totalAdapters: this.adapters.size,
      connectedAdapters: connectedAdapters.length,
      totalTools: this.toolRoutes.size,
      toolsByServer,
      toolConflicts: Array.from(new Set(toolConflicts))
    };
  }

  // Tool search and filtering
  searchTools(query: string): MCPTool[] {
    const allTools = Array.from(this.toolsByServer.values()).flat();
    const lowerQuery = query.toLowerCase();

    return allTools.filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  // Enable/disable tools by server
  async enableServerTools(serverName: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await this.refreshToolRoutes(serverName);
    } else {
      this.removeToolRoutes(serverName);
    }
  }

  // Manually reconnect specific server (for SIGKILL etc. issues)
  async forceReconnectServer(serverName: string): Promise<boolean> {
    const adapter = this.adapters.get(serverName);
    if (!adapter) {
      console.error(`Server ${serverName} not found`);
      return false;
    }

    try {
      console.error(`🔄 Force reconnecting server: ${serverName}`);
      
      // If adapter supports force reconnect, use dedicated method
      if ('forceReconnect' in adapter && typeof adapter.forceReconnect === 'function') {
        await (adapter as any).forceReconnect();
      } else {
        // Otherwise use standard reconnect process
        if (adapter.isConnected) {
          await adapter.disconnect();
        }
        await adapter.connect();
      }

      console.error(`✅ ${serverName} reconnected successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to reconnect ${serverName}:`, (error as Error).message);
      return false;
    }
  }

  // Get server health status
  getServerHealth(): Record<string, {
    connected: boolean;
    toolCount: number;
    lastSeen: string;
    status: 'healthy' | 'unstable' | 'failed';
  }> {
    const health: Record<string, any> = {};

    for (const [name, adapter] of this.adapters) {
      const tools = this.toolsByServer.get(name) || [];
      
      let status: 'healthy' | 'unstable' | 'failed' = 'healthy';
      if (!adapter.isConnected) {
        status = 'failed';
      } else if (tools.length === 0) {
        status = 'unstable';
      }

      health[name] = {
        connected: adapter.isConnected,
        toolCount: tools.length,
        lastSeen: new Date().toISOString(),
        status
      };
    }

    return health;
  }

  // Auto-heal unhealthy servers
  async autoHealUnhealthyServers(): Promise<void> {
    const health = this.getServerHealth();
    
    for (const [serverName, healthInfo] of Object.entries(health)) {
      if (healthInfo.status === 'failed') {
        console.error(`🩹 Auto-healing failed server: ${serverName}`);
        await this.forceReconnectServer(serverName);
      }
    }
  }

  // Get crash statistics for all servers
  getAllCrashStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, adapter] of this.adapters) {
      if ('getCrashStats' in adapter && typeof adapter.getCrashStats === 'function') {
        stats[name] = (adapter as any).getCrashStats();
      }
    }
    
    return stats;
  }

  // Clear blacklist for specific server
  clearServerBlacklist(serverName: string): boolean {
    const adapter = this.adapters.get(serverName);
    if (!adapter) {
      console.error(`Server ${serverName} not found`);
      return false;
    }

    if ('clearBlacklist' in adapter && typeof adapter.clearBlacklist === 'function') {
      (adapter as any).clearBlacklist();
      console.error(`🟢 Cleared blacklist for ${serverName}`);
      return true;
    }

    return false;
  }

  // Clear all server blacklists
  clearAllBlacklists(): void {
    console.error('🟢 Clearing all server blacklists...');
    
    for (const [name, adapter] of this.adapters) {
      if ('clearBlacklist' in adapter && typeof adapter.clearBlacklist === 'function') {
        (adapter as any).clearBlacklist();
      }
    }
  }

  // Get number of connected servers (for MCPDogServer)
  getConnectedServerCount(): number {
    return this.getConnectedAdapters().length;
  }

  // Get total number of servers (for MCPDogServer)
  getTotalServerCount(): number {
    return this.adapters.size;
  }

  // Get tool distribution (for MCPDogServer)
  getToolDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const [serverName, tools] of this.toolsByServer) {
      distribution[serverName] = tools.length;
    }
    
    return distribution;
  }

  async updateServerTools(serverName: string): Promise<void> {
    console.log(`[ROUTER] Updating tools for server: ${serverName}`);
    await this.refreshToolRoutes(serverName);
  }
}