import { create } from 'zustand';
import { ServerWithTools, AppConfig, MCPClientConfig } from '../types/config';

interface ConfigState {
  // Configuration data
  config: AppConfig | null;
  servers: ServerWithTools[];
  selectedServer: string | null;
  
  // UI State
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Modal states
  showAddServerModal: boolean;
  showClientConfigModal: boolean;
  
  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  updateServerConfig: (serverName: string, config: Partial<ServerWithTools>) => void;
  setServers: (servers: ServerWithTools[]) => void; // Add this line
  toggleServer: (serverName: string, refreshToolsCallback?: () => void) => Promise<void>;
  toggleServerTool: (serverName: string, toolName: string) => Promise<void>;
  addServer: (serverName: string, config: ServerWithTools) => Promise<void>;
  removeServer: (serverName: string) => Promise<void>;
  
  // UI Actions
  setSelectedServer: (serverName: string | null) => void;
  showAddServer: () => void;
  hideAddServer: () => void;
  showClientConfig: () => void;
  hideClientConfig: () => void;
  
  // Tool management
  updateServerTools: (serverName: string, toolsConfig: any) => Promise<void>;
  
  // Realtime sync
  syncServerStatus: (serverName: string, updates: { connected?: boolean; toolCount?: number; enabledToolCount?: number; }) => void;
  
  // Client config generation
  generateClientConfig: (clientType: string, servers?: string[]) => MCPClientConfig;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  servers: [],
  selectedServer: null,
  loading: false,
  saving: false,
  error: null,
  showAddServerModal: false,
  showClientConfigModal: false,

  // Actions
  loadConfig: async () => {
    console.log('[ConfigStore] Loading config...');
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/config');
      if (!response.ok) throw new Error('Failed to load config');
      
      const config = await response.json();
      console.log('[ConfigStore] Fetched config:', config);
      
      // Load servers with tools
      const serversResponse = await fetch('/api/servers');
      if (!serversResponse.ok) throw new Error('Failed to load servers');
      
      const servers = await serversResponse.json();
      console.log('[ConfigStore] Fetched servers:', servers);
      
      set({ config, servers, loading: false });
      console.log('[ConfigStore] Config and servers loaded successfully.');
    } catch (error) {
      console.error('[ConfigStore] Failed to load config:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  saveConfig: async () => {
    const { config } = get();
    if (!config) return;
    
    console.log('[ConfigStore] Saving config...', config);
    set({ saving: true, error: null });
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) throw new Error('Failed to save config');
      
      set({ saving: false });
      console.log('[ConfigStore] Config saved successfully.');
    } catch (error) {
      console.error('[ConfigStore] Failed to save config:', error);
      set({ error: (error as Error).message, saving: false });
    }
  },

  updateServerConfig: (serverName: string, updates: Partial<ServerWithTools>) => {
    console.log('[ConfigStore] Updating server config for', serverName, updates);
    set(state => ({
      config: state.config ? {
        ...state.config,
        servers: {
          ...state.config.servers,
          [serverName]: { ...state.config.servers[serverName], ...updates }
        }
      } : null,
      servers: state.servers.map(server => 
        server.name === serverName ? { ...server, ...updates } : server
      )
    }));
    console.log('[ConfigStore] Server config updated locally.');
  },

  toggleServer: async (serverName: string, refreshToolsCallback?: () => void) => {
    console.log('[ConfigStore] Toggling server:', serverName);
    try {
      // Update local state first for immediate response
      const { servers } = get();
      const targetServer = servers.find(s => s.name === serverName);
      if (targetServer) {
        const newEnabled = !targetServer.enabled;
        console.log('[ConfigStore] Local state update for toggle:', serverName, 'enabled:', newEnabled);
        set(state => ({
          servers: state.servers.map(server => 
            server.name === serverName 
              ? { 
                  ...server, 
                  enabled: newEnabled,
                  // When disabling, immediately set connected to false
                  // When enabling, keep current connection status until WebSocket updates
                  connected: newEnabled ? server.connected : false,
                  // Reset tool count when disabling
                  toolCount: newEnabled ? server.toolCount : 0,
                  enabledToolCount: newEnabled ? server.enabledToolCount : 0
                }
              : server
          )
        }));
      }

      console.log('[ConfigStore] Sending toggle API request for', serverName);
      const response = await fetch(`/api/servers/${serverName}/toggle`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('[ConfigStore] Toggle API request failed for', serverName);
        // If API call fails, restore original state
        if (targetServer) {
          set(state => ({
            servers: state.servers.map(server => 
              server.name === serverName 
                ? { ...server, enabled: targetServer.enabled, connected: targetServer.connected, toolCount: targetServer.toolCount, enabledToolCount: targetServer.enabledToolCount }
                : server
            )
          }));
        }
        throw new Error('Failed to toggle server');
      }
      
      const data = await response.json();
      console.log('[ConfigStore] Server toggle API response:', data);
      
      // If server was enabled and refresh callback provided, delay call to refresh tool list
      if (targetServer && !targetServer.enabled && refreshToolsCallback) {
        console.log('[ConfigStore] Server was enabled, scheduling tool refresh');
        setTimeout(() => {
          refreshToolsCallback();
        }, 1500); // Wait for server to fully start and connect
      }
      
      // No need to immediately reload config, let WebSocket updates handle real-time status
      // WebSocket will automatically update toolCount and connected status when servers connect/disconnect
    } catch (error) {
      console.error('[ConfigStore] Error toggling server:', error);
      set({ error: (error as Error).message });
      throw error; // Re-throw error for caller to handle
    }
  },

  toggleServerTool: async (serverName: string, toolName: string) => {
    console.log('[ConfigStore] Toggling tool:', toolName, 'for server:', serverName);
    try {
      const response = await fetch(`/api/servers/${serverName}/tools/${toolName}/toggle`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to toggle tool');
      
      const data = await response.json();
      console.log('[ConfigStore] Tool toggle API response:', data);
      
      // Don't auto-reload, let caller decide if reload is needed
      // This avoids UI flickering and tool disappearance issues
    } catch (error) {
      console.error('[ConfigStore] Error toggling tool:', error);
      set({ error: (error as Error).message });
      throw error; // Re-throw error for caller to handle
    }
  },

  addServer: async (serverName: string, config: ServerWithTools) => {
    console.log('[ConfigStore] Adding server:', serverName, config);
    set({ saving: true, error: null });
    try {
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serverName, config })
      });
      
      if (!response.ok) throw new Error('Failed to add server');
      
      const data = await response.json();
      console.log('[ConfigStore] Add server API response:', data);
      await get().loadConfig(); // Reload config
      set({ saving: false, showAddServerModal: false });
      console.log('[ConfigStore] Server added and config reloaded.');
    } catch (error) {
      console.error('[ConfigStore] Error adding server:', error);
      set({ error: (error as Error).message, saving: false });
    }
  },

  removeServer: async (serverName: string) => {
    console.log('[ConfigStore] Removing server:', serverName);
    set({ saving: true, error: null });
    try {
      const response = await fetch(`/api/servers/${serverName}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to remove server');
      
      const data = await response.json();
      console.log('[ConfigStore] Remove server API response:', data);
      await get().loadConfig(); // Reload config
      set({ saving: false, selectedServer: null });
      console.log('[ConfigStore] Server removed and config reloaded.');
    } catch (error) {
      console.error('[ConfigStore] Error removing server:', error);
      set({ error: (error as Error).message, saving: false });
    }
  },

  updateServerTools: async (serverName: string, toolsConfig: any) => {
    console.log('[ConfigStore] Updating server tools for', serverName, toolsConfig);
    try {
      const response = await fetch(`/api/servers/${serverName}/tools`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolsConfig })
      });
      
      if (!response.ok) throw new Error('Failed to update server tools');
      
      const data = await response.json();
      console.log('[ConfigStore] Update server tools API response:', data);
      get().updateServerConfig(serverName, { toolsConfig });
      console.log('[ConfigStore] Server tools updated locally.');
    } catch (error) {
      console.error('[ConfigStore] Error updating server tools:', error);
      set({ error: (error as Error).message });
    }
  },

  syncServerStatus: (serverName: string, updates: { connected?: boolean; toolCount?: number; enabledToolCount?: number }) => {
    console.log('[ConfigStore] Syncing server status for', serverName, updates);
    set(state => ({
      servers: state.servers.map(server => 
        server.name === serverName 
          ? (updates.connected !== undefined && updates.connected !== server.connected) ||
            (updates.toolCount !== undefined && updates.toolCount !== server.toolCount) ||
            (updates.enabledToolCount !== undefined && updates.enabledToolCount !== server.enabledToolCount)
            ? {
                ...server,
                connected: updates.connected !== undefined ? updates.connected : server.connected,
                toolCount: updates.toolCount !== undefined ? updates.toolCount : server.toolCount,
                enabledToolCount: updates.enabledToolCount !== undefined ? updates.enabledToolCount : server.enabledToolCount,
              }
            : server
          : server
      )
    }));
    console.log('[ConfigStore] Server status synced locally.');
  },

  setServers: (servers: ServerWithTools[]) => {
    console.log('[ConfigStore] Setting servers:', servers);
    set({ servers });
  },

  // UI Actions
  setSelectedServer: (serverName: string | null) => {
    console.log('[ConfigStore] Setting selected server:', serverName);
    set({ selectedServer: serverName });
  },

  showAddServer: () => {
    console.log('[ConfigStore] Showing add server modal.');
    set({ showAddServerModal: true });
  },
  hideAddServer: () => {
    console.log('[ConfigStore] Hiding add server modal.');
    set({ showAddServerModal: false });
  },
  showClientConfig: () => {
    console.log('[ConfigStore] Showing client config modal.');
    set({ showClientConfigModal: true });
  },
  hideClientConfig: () => {
    console.log('[ConfigStore] Hiding client config modal.');
    set({ showClientConfigModal: false });
  },

  // Client config generation
  generateClientConfig: (clientType: string, servers?: string[]): MCPClientConfig => {
    console.log('[ConfigStore] Generating client config for', clientType);
    const { config } = get();
    if (!config) throw new Error('No configuration available');
    
    const selectedServers = servers || Object.keys(config.servers);
    const mcpServers: any = {};
    
    selectedServers.forEach(serverName => {
      const serverConfig = config.servers[serverName];
      if (serverConfig && serverConfig.enabled) {
        if (serverConfig.transport === 'stdio') {
          mcpServers[serverName] = {
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env
          };
        } else if (serverConfig.transport === 'http-sse') {
          mcpServers[serverName] = {
            type: "sse",
            url: serverConfig.endpoint
          };
        }
      }
    });
    
    switch (clientType) {
      case 'claude-desktop':
        return {
          type: 'claude-desktop',
          name: 'Claude Desktop Configuration',
          config: {
            mcpServers
          },
          instructions: [
            '1. Open Claude Desktop application',
            '2. Go to Settings -> Developer',
            '3. Find the "Edit Config" button',
            '4. Paste the configuration into the mcpServers section',
            '5. Restart Claude Desktop'
          ]
        };
        
      case 'cursor':
        return {
          type: 'cursor',
          name: 'Cursor Configuration',
          config: {
            "mcp": {
              "mcpServers": mcpServers
            }
          },
          instructions: [
            '1. Open Cursor editor',
            '2. Press Cmd/Ctrl + Shift + P to open command palette',
            '3. Search for "Preferences: Open Settings (JSON)"',
            '4. Add the configuration to the settings file',
            '5. Restart Cursor'
          ]
        };
        
      default:
        throw new Error(`Unsupported client type: ${clientType}`);
    }
  }
}));