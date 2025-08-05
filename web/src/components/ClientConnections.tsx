import React, { useState, useEffect } from 'react';
import { Users, Monitor, Smartphone, Globe, Clock, Activity } from 'lucide-react';

interface ClientInfo {
  id: string;
  type: string;
  lastSeen: string;
}

export const ClientConnections: React.FC = () => {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/daemon/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClientIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'claude':
      case 'claude-desktop':
        return <Monitor className="h-5 w-5 text-purple-500" />;
      case 'cursor':
        return <Monitor className="h-5 w-5 text-blue-500" />;
      case 'cli':
        return <Monitor className="h-5 w-5 text-green-500" />;
      case 'web':
        return <Globe className="h-5 w-5 text-orange-500" />;
      case 'mobile':
        return <Smartphone className="h-5 w-5 text-pink-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getClientTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'claude':
      case 'claude-desktop':
        return 'Claude Desktop';
      case 'cursor':
        return 'Cursor Editor';
      case 'cli':
        return 'CLI Client';
      case 'web':
        return 'Web Interface';
      case 'mobile':
        return 'Mobile';
      default:
        return type;
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }
  };

  const getConnectionStatus = (lastSeen: string) => {
    const diffInSeconds = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
    
    if (diffInSeconds < 30) {
      return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-700' };
    } else if (diffInSeconds < 300) {
      return { status: 'idle', label: 'Idle', color: 'bg-yellow-100 text-yellow-700' };
    } else {
      return { status: 'inactive', label: 'Away', color: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading client information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Connected Clients
        </h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">{clients.length} connections</span>
          <button
            onClick={fetchClients}
            className="btn-secondary btn-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No client connections</p>
          <p className="text-sm mt-2">Start MCP clients like Claude Desktop or Cursor to establish connections</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const connectionStatus = getConnectionStatus(client.lastSeen);
            
            return (
              <div
                key={client.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {getClientIcon(client.type)}
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {getClientTypeLabel(client.type)}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {client.id.substring(0, 8)}...
                      </span>
                      <span>•</span>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatLastSeen(client.lastSeen)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${connectionStatus.color}`}>
                    {connectionStatus.label}
                  </span>
                  
                  <div className={`w-3 h-3 rounded-full ${
                    connectionStatus.status === 'active' ? 'bg-green-500' :
                    connectionStatus.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection statistics */}
      {clients.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {clients.filter(c => getConnectionStatus(c.lastSeen).status === 'active').length}
              </div>
              <div className="text-sm text-gray-500">Active connections</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {clients.filter(c => getConnectionStatus(c.lastSeen).status === 'idle').length}
              </div>
              <div className="text-sm text-gray-500">Idle connections</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {clients.filter(c => getConnectionStatus(c.lastSeen).status === 'inactive').length}
              </div>
              <div className="text-sm text-gray-500">Offline connections</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};