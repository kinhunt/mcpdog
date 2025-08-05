import React from 'react';
import { ServerWithTools } from '../types/config';


interface ServerListItemProps {
  server: ServerWithTools;
  selectedServer: string | null;
  setSelectedServer: (serverName: string | null) => void;
}

export const ServerListItem: React.FC<ServerListItemProps> = React.memo(({ server, selectedServer, setSelectedServer }) => {
  console.log(`[ServerListItem] Rendering: ${server.name}`);

  return (
    <div
      key={server.name}
      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
        selectedServer === server.name ? 'bg-blue-50 border-r-2 border-blue-500' : ''
      }`}
      onClick={() => setSelectedServer(server.name)}
    >
      <div className="flex items-center space-x-3 mb-2">
        <div className={`w-3 h-3 rounded-full ${
          server?.connected ? 'bg-green-500' : 
          server?.enabled ? 'bg-yellow-500' : 'bg-gray-400'
        }`} />
        <h3 className="font-medium text-gray-900 truncate">{server?.name || 'Unknown'}</h3>
      </div>
      
      <div className="text-sm text-gray-500 mb-2">
        {server?.description || 'No description'}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 rounded-full font-medium ${
            server?.transport === 'stdio' ? 'bg-blue-100 text-blue-700' :
            server?.transport === 'http-sse' ? 'bg-green-100 text-green-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {server?.transport || 'unknown'}
          </span>
          {server?.enabled && (
            <span className="text-gray-500">
              {server?.connected 
                ? `${server?.enabledToolCount || 0}/${server?.toolCount || 0} tools`
                : `${server?.toolCount || 0} tools`
              }
            </span>
          )}
        </div>
        
        <span className={`px-2 py-1 rounded-full font-medium ${
          server?.connected ? 'bg-green-100 text-green-700' :
          server?.enabled ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {server?.connected ? 'Connected' : 
           server?.enabled ? 'Waiting' : 'Disabled'}
        </span>
      </div>
    </div>
  );
});
