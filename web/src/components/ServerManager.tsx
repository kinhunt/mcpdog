import React, { useEffect } from 'react';
import { Plus, Copy, Settings, LogOut } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { useAppStore } from '../store/useAppStore';
import { ServerListItem } from './ServerListItem';
import { ServerPanel } from './ServerPanel';
import { AddServerModal } from './AddServerModal';
import { ClientConfigModal } from './ClientConfigModal';
import { ThemeToggle } from './ThemeToggle';
import { ServerStatus } from '../types/index';

interface ServerManagerProps {
  refreshServerTools: (serverName?: string) => void;
  onLogout?: () => void;
}

export const ServerManager: React.FC<ServerManagerProps> = ({ refreshServerTools, onLogout }) => {
  const {
    servers: configuredServers,
    selectedServer,
    setSelectedServer,
    loading,
    error,
    showAddServer,
    showClientConfig,
    showAddServerModal,
    showClientConfigModal,
    loadConfig,
  } = useConfigStore();

  // Load config on component mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const { systemStatus } = useAppStore(); // Get systemStatus from useAppStore
  const liveServers = systemStatus?.servers || []; // Extract live servers

  // Merge configured servers with live status
  const mergedServers = configuredServers.map(configServer => {
    const liveServer = liveServers.find((ls: ServerStatus) => ls.name === configServer.name);
    return {
      ...configServer,
      connected: liveServer?.connected ?? configServer.connected, // Use live status if available
      toolCount: liveServer?.toolCount ?? configServer.toolCount, // Use live toolCount if available
      enabledToolCount: liveServer?.enabledToolCount ?? configServer.enabledToolCount, // Use live enabledToolCount if available
      tools: liveServer?.tools ?? configServer.tools // Use live tools if available
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
          <p className="text-base-content/70">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 className="font-medium">Configuration loading failed</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const connectedServersCount = mergedServers.filter(s => s?.connected).length;
  const enabledServersCount = mergedServers.filter(s => s?.enabled).length;
  
  // Calculate enabled tools count - only count tools from enabled and connected servers
  const enabledToolsCount = mergedServers.reduce((sum, s) => {
    // Only count tools from servers that are both enabled and connected
    if (!s?.enabled || !s?.connected || !s?.tools) return sum;
    return sum + s.tools.filter(tool => tool.enabled).length;
  }, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Top action bar */}
      <div className="bg-base-100 border-b border-base-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-base-content">MCP Server Management</h1>
            <div className="flex items-center space-x-6 mt-2 text-sm text-base-content/70">
              <span>Total: {mergedServers.length} servers</span>
              <span>Enabled: {enabledServersCount}</span>
              <span>Connected: {connectedServersCount}</span>
              <span>Enabled Tools: {enabledToolsCount}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            
            {onLogout && (
              <button
                onClick={onLogout}
                className="btn btn-outline btn-error btn-sm flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            )}
            
            <button
              onClick={showClientConfig}
              className="btn btn-outline btn-sm flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Connect To MCPDOG</span>
            </button>
            
            <button
              onClick={showAddServer}
              className="btn btn-primary btn-sm flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Server</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left server list */}
        <div className="w-80 bg-base-100 border-r border-base-300 flex flex-col">
          <div className="p-4 border-b border-base-300">
            <h2 className="font-medium text-base-content">Server List</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {mergedServers.length === 0 ? (
              <div className="p-6 text-center text-base-content/70">
                <Settings className="h-12 w-12 mx-auto mb-4 text-base-content/40" />
                <p className="mb-2">No configured servers</p>
                <p className="text-sm mb-4">Add your first MCP server to get started</p>
                <button
                  onClick={showAddServer}
                  className="btn btn-primary btn-sm"
                >
                  Add Server
                </button>
              </div>
            ) : (
              <div className="divide-y divide-base-300">
                {mergedServers.map((server) => (
                  <ServerListItem
                    key={server.name}
                    server={server}
                    selectedServer={selectedServer}
                    setSelectedServer={setSelectedServer}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right detail panel */}
        <div className="flex-1 flex flex-col">
          {selectedServer && mergedServers.find(s => s.name === selectedServer) ? (
            <ServerPanel 
              server={mergedServers.find(s => s.name === selectedServer)!} 
              refreshServerTools={refreshServerTools}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-base-200">
              <div className="text-center text-base-content/70">
                <Settings className="h-16 w-16 mx-auto mb-4 text-base-content/40" />
                <h3 className="text-lg font-medium mb-2">Select a server</h3>
                <p className="text-sm">Choose a server from the left list to view and edit its configuration</p>
                
                {mergedServers.length === 0 && (
                  <div className="mt-8">
                    <button
                      onClick={showAddServer}
                      className="btn btn-primary"
                    >
                      Add Server
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal windows */}
      {showAddServerModal && <AddServerModal />}
      {showClientConfigModal && <ClientConfigModal />}
    </div>
  );
};