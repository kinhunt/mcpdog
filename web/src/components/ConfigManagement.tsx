import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Plus, Trash2, Edit, Eye, EyeOff } from 'lucide-react';
import { MCPServerConfig } from '../types';

interface ConfigData {
  version: string;
  servers: Record<string, MCPServerConfig>;
  web?: {
    enabled: boolean;
    port: number;
    host: string;
  };
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}

export const ConfigManagement: React.FC = () => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [rawConfigText, setRawConfigText] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
      setRawConfigText(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configToSave = showRawConfig ? JSON.parse(rawConfigText) : config;
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave),
      });
      
      if (response.ok) {
        await fetchConfig();
        // Reload configuration
        await fetch('/api/daemon/reload', { method: 'POST' });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleServerEnabled = (serverName: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      servers: {
        ...config.servers,
        [serverName]: {
          ...config.servers[serverName],
          enabled: !config.servers[serverName].enabled
        }
      }
    });
  };

  const getTransportColor = (transport: string) => {
    switch (transport) {
      case 'stdio':
        return 'bg-blue-100 text-blue-700';
      case 'http-sse':
        return 'bg-green-100 text-green-700';
      case 'streamable-http':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading configuration...</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="card">
        <div className="text-center py-8 text-red-500">
          <Settings className="h-12 w-12 mx-auto mb-4" />
          <p>Failed to load configuration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Configuration Management
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRawConfig(!showRawConfig)}
            className="btn-secondary btn-sm flex items-center space-x-1"
          >
            {showRawConfig ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showRawConfig ? 'Form Mode' : 'Raw Config'}</span>
          </button>
          <button
            onClick={fetchConfig}
            className="btn-secondary btn-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="btn-primary btn-sm flex items-center space-x-1"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {showRawConfig ? (
        // Raw configuration edit mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raw Configuration (JSON format)
            </label>
            <textarea
              value={rawConfigText}
              onChange={(e) => setRawConfigText(e.target.value)}
              className="w-full h-96 p-3 border border-gray-300 rounded-md font-mono text-sm"
              placeholder="Enter JSON format configuration..."
            />
          </div>
        </div>
      ) : (
        // Form edit mode
        <div className="space-y-6">
          {/* Basic information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Version:</span>
                <span className="ml-2 text-gray-900">{config.version}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Server Count:</span>
                <span className="ml-2 text-gray-900">{Object.keys(config.servers).length}</span>
              </div>
            </div>
          </div>

          {/* Web configuration */}
          {config.web && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Web Interface Configuration</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    config.web.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {config.web.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Port:</span>
                  <span className="ml-2 text-gray-900">{config.web.port}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Host:</span>
                  <span className="ml-2 text-gray-900">{config.web.host}</span>
                </div>
              </div>
            </div>
          )}

          {/* Server configuration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">MCP Server Configuration</h3>
              <button className="btn-secondary btn-sm flex items-center space-x-1">
                <Plus className="h-4 w-4" />
                <span>Add Server</span>
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(config.servers).map(([name, serverConfig]) => (
                <div
                  key={name}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransportColor(serverConfig.transport)}`}>
                        {serverConfig.transport}
                      </span>
                      <button
                        onClick={() => toggleServerEnabled(name)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          serverConfig.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {serverConfig.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingServer(editingServer === name ? null : name)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    {serverConfig.description || 'No description'}
                  </div>

                  {serverConfig.command && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Command:</span>
                      <div className="mt-1 bg-gray-100 p-2 rounded font-mono text-xs">
                        {serverConfig.command} {serverConfig.args?.join(' ')}
                      </div>
                    </div>
                  )}

                  {serverConfig.endpoint && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Endpoint:</span>
                      <div className="mt-1 bg-gray-100 p-2 rounded font-mono text-xs">
                        {serverConfig.endpoint}
                      </div>
                    </div>
                  )}

                  {/* Expanded edit area */}
                  {editingServer === name && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        Edit functionality is under development...
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};