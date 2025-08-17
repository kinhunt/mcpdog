import { create } from 'zustand';
import { ServerWithTools, AppConfig, MCPClientConfig } from '../types/config';
import { apiClient } from '../utils/api';

interface ConfigState {
  // Configuration data
  config: AppConfig | null;
  servers: ServerWithTools[];
  selectedServer: string | null;
  
  // UI State
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Auth State
  authRequired: boolean;
  authToken: string | null;
  
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
  
  // Auth actions
  setAuthState: (required: boolean, token?: string | null) => void;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  servers: [],
  selectedServer: null,
  loading: false,
  saving: false,
  error: null,
  authRequired: false,
  authToken: null,
  showAddServerModal: false,
  showClientConfigModal: false,

  // Actions
  loadConfig: async () => {
    console.log('[ConfigStore] Loading config...');
    set({ loading: true, error: null });
    try {
      const config = await apiClient.get('/api/config');
      console.log('[ConfigStore] Fetched config:', config);
      
      // Load servers with tools
      const servers = await apiClient.get('/api/servers');
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
      await apiClient.put('/api/config', config);
      
      set({ saving: false });
      console.log('[ConfigStore] Config saved successfully.');
    } catch (error) {
      console.error('[ConfigStore] Failed to save config:', error);
      set({ error: (error as Error).message, saving: false });
    }
  },

  updateServerConfig: (serverName: string, config: Partial<ServerWithTools>) => {
    console.log('[ConfigStore] Updating server config:', serverName, config);
    set(state => ({
      servers: state.servers.map(server => 
        server.name === serverName 
          ? { ...server, ...config }
          : server
      )
    }));
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
                  // Calculate enabledToolCount based on actual tool states
                  enabledToolCount: newEnabled ? 
                    (server.tools?.filter(tool => tool.enabled).length || 0) : 0,
                  // When disabling, set all tools to disabled to ensure correct global count
                  // When enabling, keep original tool states (they will be restored by WebSocket updates)
                  tools: newEnabled ? server.tools : (server.tools?.map(tool => ({ ...tool, enabled: false })) || [])
                }
              : server
          )
        }));
      }

      console.log('[ConfigStore] Sending toggle API request for', serverName);
      try {
        const data = await apiClient.post(`/api/servers/${serverName}/toggle`);
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
        console.error('[ConfigStore] Toggle API request failed for', serverName);
        // If API call fails, restore original state
        if (targetServer) {
          set(state => ({
            servers: state.servers.map(server => 
              server.name === serverName 
                ? { ...server, enabled: targetServer.enabled, connected: targetServer.connected, toolCount: targetServer.toolCount, enabledToolCount: targetServer.enabledToolCount, tools: targetServer.tools }
                : server
            )
          }));
        }
        throw error;
      }
    } catch (error) {
      console.error('[ConfigStore] Error toggling server:', error);
      set({ error: (error as Error).message });
      throw error; // Re-throw error for caller to handle
    }
  },

  toggleServerTool: async (serverName: string, toolName: string) => {
    console.log('[ConfigStore] Toggling tool:', toolName, 'for server:', serverName);
    try {
      const data = await apiClient.post(`/api/servers/${serverName}/tools/${toolName}/toggle`);
      console.log('[ConfigStore] Tool toggle API response:', data);
      
      // Update local state immediately after successful toggle
      set(state => ({
        servers: state.servers.map(server => 
          server.name === serverName 
            ? {
                ...server,
                tools: server.tools?.map(tool => 
                  tool.name === toolName 
                    ? { ...tool, enabled: !tool.enabled }
                    : tool
                ),
                // Calculate enabledToolCount based on actual tool states
                enabledToolCount: server.tools?.map(tool => 
                  tool.name === toolName 
                    ? { ...tool, enabled: !tool.enabled }
                    : tool
                ).filter(tool => tool.enabled).length || 0
              }
            : server
        )
      }));
      
      console.log('[ConfigStore] Tool toggle state updated locally');
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
      const data = await apiClient.post('/api/servers', { name: serverName, config });
      console.log('[ConfigStore] Add server API response:', data);
      
      // Update local state directly instead of reloading all config
      set(state => ({
        servers: [...state.servers, {
          ...config,
          name: serverName,
          connected: false,
          toolCount: 0,
          enabledToolCount: 0,
          tools: []
        }],
        saving: false,
        showAddServerModal: false
      }));
      
      console.log('[ConfigStore] Server added to local state.');
    } catch (error) {
      console.error('[ConfigStore] Error adding server:', error);
      set({ error: (error as Error).message, saving: false });
      throw error; // Re-throw for modal to handle
    }
  },

  removeServer: async (serverName: string) => {
    console.log('[ConfigStore] Removing server:', serverName);
    set({ saving: true, error: null });
    try {
      const data = await apiClient.delete(`/api/servers/${serverName}`);
      console.log('[ConfigStore] Remove server API response:', data);
      
      // Update local state directly instead of reloading all config
      set(state => ({
        servers: state.servers.filter(server => server.name !== serverName),
        saving: false,
        selectedServer: state.selectedServer === serverName ? null : state.selectedServer
      }));
      
      console.log('[ConfigStore] Server removed from local state.');
    } catch (error) {
      console.error('[ConfigStore] Error removing server:', error);
      set({ error: (error as Error).message, saving: false });
      throw error; // Re-throw for component to handle
    }
  },

  updateServerTools: async (serverName: string, toolsConfig: any) => {
    console.log('[ConfigStore] Updating server tools for', serverName, toolsConfig);
    try {
      const data = await apiClient.put(`/api/servers/${serverName}/tools`, { toolsConfig });
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
                // When server connects, we need to reload tools to restore their enabled state
                // This will be handled by the WebSocket routes-updated event
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
  },

  // Auth actions
  setAuthState: (required: boolean, token?: string | null) => {
    console.log('[ConfigStore] Setting auth state:', { required, hasToken: !!token });
    set({ 
      authRequired: required, 
      authToken: token || localStorage.getItem('mcpdog_token') 
    });
  }
}));