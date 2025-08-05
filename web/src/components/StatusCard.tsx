import React from 'react';
import { Activity, Server, Zap, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const StatusCard: React.FC = () => {
  const { systemStatus, connected } = useAppStore();

  if (!systemStatus) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading system status...</div>
        </div>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {/* Connection status */}
      <div className="card">
        <div className="flex items-center">
          <div className={`p-2 rounded-full ${connected ? 'bg-green-100' : 'bg-red-100'}`}>
            <Activity className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Connection Status</p>
            <p className={`text-lg font-semibold ${connected ? 'text-green-600' : 'text-red-600'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
      </div>

      {/* Server count */}
      <div className="card">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-blue-100">
            <Server className="h-5 w-5 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">MCP Servers</p>
            <p className="text-lg font-semibold text-gray-900">
              {systemStatus.servers.length} servers
            </p>
            <p className="text-xs text-gray-500">
              {systemStatus.servers.filter(s => s.connected).length} connected
            </p>
          </div>
        </div>
      </div>

      {/* Tool count */}
      <div className="card">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-purple-100">
            <Zap className="h-5 w-5 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Available Tools</p>
            <p className="text-lg font-semibold text-gray-900">
              {systemStatus.enabledTools} tools
            </p>
          </div>
        </div>
      </div>

      {/* Uptime */}
      <div className="card">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-orange-100">
            <Clock className="h-5 w-5 text-orange-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">Uptime</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatUptime(systemStatus.uptime)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};