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
      className={`p-4 cursor-pointer hover:bg-base-200 transition-colors relative ${
        selectedServer === server.name ? 'bg-primary/10' : ''
      }`}
      onClick={() => setSelectedServer(server.name)}
    >
      {/* Blue border for selected item */}
      {selectedServer === server.name && (
        <div className="absolute top-0 right-0 bottom-0 w-1 bg-primary"></div>
      )}
      
      <div className="flex items-center space-x-3 mb-2">
        <div className={`w-3 h-3 rounded-full ${
          server?.connected ? 'bg-green-500' : 
          server?.enabled ? 'bg-yellow-500' : 'bg-gray-400'
        }`} />
        <h3 className="font-medium text-base-content truncate">{server?.name || 'Unknown'}</h3>
      </div>
      
      <div className="text-sm text-base-content/70 mb-2">
        {server?.description || 'No description'}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          {server?.enabled && (
            <span className="text-base-content/70">
              {server?.connected 
                ? `${server?.enabledToolCount || 0}/${server?.toolCount || 0} tools`
                : `${server?.toolCount || 0} tools`
              }
            </span>
          )}
        </div>
        
        <span className={`badge ${
          server?.connected ? 'badge-success' :
          server?.enabled ? 'badge-warning' :
          'badge-neutral'
        }`}>
          {server?.connected ? 'Connected' : 
           server?.enabled ? 'Waiting' : 'Disabled'}
        </span>
      </div>
    </div>
  );
});
