import React, { useEffect } from 'react';
import { Plus, Copy, Settings } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { useAppStore } from '../store/useAppStore';
import { ServerListItem } from './ServerListItem';
import { ServerPanel } from './ServerPanel';
import { AddServerModal } from './AddServerModal';
import { ClientConfigModal } from './ClientConfigModal';
import { ServerStatus } from '../types/index';

interface ServerManagerProps {
  refreshServerTools: (serverName?: string) => void;
}

export const ServerManager: React.FC<ServerManagerProps> = ({ refreshServerTools }) => {
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-500 mr-3">⚠️</div>
          <div>
            <h3 className="text-red-800 font-medium">Configuration loading failed</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MCP Server Management</h1>
            <div className="flex items-center space-x-6 mt-2 text-sm text-gray-500">
              <span>Total: {mergedServers.length} servers</span>
              <span>Enabled: {enabledServersCount}</span>
              <span>Connected: {connectedServersCount}</span>
              <span>Enabled Tools: {enabledToolsCount}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={showClientConfig}
              className="btn-secondary btn-sm flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Generate Client Config</span>
            </button>
            
            <button
              onClick={showAddServer}
              className="btn-primary btn-sm flex items-center space-x-2"
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
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-medium text-gray-900">Server List</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {mergedServers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="mb-2">No configured servers</p>
                <p className="text-sm mb-4">Add your first MCP server to get started</p>
                <button
                  onClick={showAddServer}
                  className="btn-primary btn-sm"
                >
                  Add Server
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
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
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <Settings className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Select a server</h3>
                <p className="text-sm">Choose a server from the left list to view and edit its configuration</p>
                
                {mergedServers.length === 0 && (
                  <div className="mt-8">
                    <button
                      onClick={showAddServer}
                      className="btn-primary"
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