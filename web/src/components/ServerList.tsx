import React from 'react';
import { Server } from 'lucide-react';
import { useConfigStore } from '../store/configStore'; // Import useConfigStore
import { ServerWithTools } from '../types/config'; // Import ServerWithTools

export const ServerList = React.memo(() => {
  const { servers, selectedServer, setSelectedServer } = useConfigStore(); // Use useConfigStore

  

  const handleServerSelect = (serverName: string) => {
    setSelectedServer(serverName); // Use setSelectedServer from useConfigStore
  };


  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'stdio':
        return '📡';
      case 'http':
        return '🌐';
      case 'websocket':
        return '🔌';
      default:
        return '❓';
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Server className="h-5 w-5 mr-2" />
          MCP Server List
        </h2>
        <span className="text-sm text-gray-500">{servers.length} servers</span>
      </div>

      <div className="space-y-4">
        {servers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No configured servers</p>
          </div>
        ) : (
          servers.map((server: ServerWithTools) => (
            <div
              key={server.name}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedServer === server.name
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleServerSelect(server.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {server?.connected ? (
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    ) : server?.enabled ? (
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900">{server.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="text-xs">{getTransportIcon(server?.transport || 'unknown')} {server?.transport || 'unknown'}</span>
                      <span className="text-xs">• {
                        server?.connected ? 'Connected' : 
                        server?.enabled ? 'Connecting' : 'Disabled'
                      }</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Expanded server details */}
              {selectedServer === server.name && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Command:</span>
                      <p className="text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded mt-1">
                        {server.command} {server.args?.join(' ')}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Description:</span>
                      <p className="text-gray-700 mt-1">
                        {server.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <button className="btn-secondary text-xs">
                      Restart Server
                    </button>
                    <button className="btn-secondary text-xs">
                      View Logs
                    </button>
                    <button className="btn-secondary text-xs">
                      Test Connection
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});