import React from 'react';
import { Activity, AlertCircle, Zap, Server } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { RealtimeEvent } from '../types';

export const EventLog: React.FC = () => {
  const { events } = useAppStore();

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'server-updated':
        return <Server className="h-4 w-4 text-blue-500" />;
      case 'tool-called':
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventDescription = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'server-updated':
        return `Server ${event.data.serverName} updated ${event.data.toolCount} tools`;
      case 'tool-called':
        return `Called tool ${event.data.toolName} (${event.data.serverName}) - ${event.data.duration}ms`;
      case 'error':
        return `Error: ${event.data.error} (${event.data.context})`;
      case 'status-update':
        return 'System status updated';
      default:
        return 'Unknown event';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Real-time Event Log
        </h2>
        <span className="text-sm text-gray-500">{events.length} events</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No event records</p>
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getEventIcon(event.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {getEventDescription(event)}
                </p>
                <div className="flex items-center mt-1 space-x-2">
                  <span className="text-xs text-gray-500">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    event.type === 'error'
                      ? 'bg-red-100 text-red-700'
                      : event.type === 'tool-called'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {event.type}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};