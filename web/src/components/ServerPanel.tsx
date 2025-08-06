import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Trash2, 
  Save, 
  RefreshCw, 
  ToggleLeft,
  ToggleRight,
  Loader2,
  Zap,
  Plus
} from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { ServerWithTools } from '../types/config';
import { ToolsPanel } from './ToolsPanel';
import { ServerLogs } from './ServerLogs';

// Server name validation pattern
const SERVER_NAME_PATTERN = /^[a-zA-Z0-9\-_]+$/;

interface ServerPanelProps {
  server: ServerWithTools;
  refreshServerTools: (serverName?: string) => void;
}

export const ServerPanel: React.FC<ServerPanelProps> = ({ server, refreshServerTools }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'tools' | 'logs'>('tools');
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState<any>(server);
  const [isToggling, setIsToggling] = useState(false);
  const [nameValidation, setNameValidation] = useState<{ valid: boolean; error?: string; suggestions?: string[] }>({ valid: true });
  
  const { 
    updateServerConfig, 
    toggleServer, 
    removeServer, 
    saving 
  } = useConfigStore();

  // Reset editing state when server changes
  useEffect(() => {
    setEditedConfig(server);
    setIsEditing(false);
    setNameValidation({ valid: true });
    setActiveTab('tools'); // Switch to Tool List tab when server changes
  }, [server.name]); // Use server.name as dependency to detect server changes

  // Auto-enter edit mode when switching to config tab
  useEffect(() => {
    if (activeTab === 'config') {
      setIsEditing(true);
    }
  }, [activeTab]);

  // Validate server name
  const validateServerName = (name: string) => {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Server name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Server name too long (max 50 characters)' };
    }

    if (!SERVER_NAME_PATTERN.test(name)) {
      const suggestions = generateNameSuggestions(name);
      return { 
        valid: false, 
        error: 'Server name can only contain letters, numbers, hyphens, and underscores',
        suggestions
      };
    }

    return { valid: true };
  };

  // Generate suggestions for invalid names
  const generateNameSuggestions = (invalidName: string): string[] => {
    const suggestions: string[] = [];

    // Remove special characters and replace with hyphens
    let cleaned = invalidName
      .replace(/[^a-zA-Z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (cleaned && SERVER_NAME_PATTERN.test(cleaned)) {
      suggestions.push(cleaned);
    }

    // Convert to lowercase and replace spaces with hyphens
    let lowerCase = invalidName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');

    if (lowerCase && SERVER_NAME_PATTERN.test(lowerCase)) {
      suggestions.push(lowerCase);
    }

    return suggestions.slice(0, 3);
  };

  const handleToggleServer = async () => {
    setIsToggling(true);
    try {
      await toggleServer(server?.name || '', () => refreshServerTools(server?.name));
      // Status will be automatically updated through global store
    } catch (error) {
      console.error('Failed to toggle server:', error);
    } finally {
      // Delay removing loading state to give user time to see connection process
      setTimeout(() => {
        setIsToggling(false);
      }, 1500);
    }
  };

  const handleSave = async () => {
    // Validate server name if it has changed
    if (editedConfig.name !== server.name) {
      const validation = validateServerName(editedConfig.name);
      if (!validation.valid) {
        alert(`Invalid server name: ${validation.error}`);
        return;
      }

      // Check for name conflicts with other servers
      try {
        const response = await fetch('/api/servers');
        const existingNames = Object.keys(await response.json());
        const otherNames = existingNames.filter(name => name !== server.name);
        
        if (otherNames.includes(editedConfig.name)) {
          alert(`Server name "${editedConfig.name}" already exists`);
          return;
        }
      } catch (error) {
        console.warn('Unable to check server name conflicts:', error);
      }
    }

    // Validate environment variables
    if (editedConfig.env && editedConfig.transport === 'stdio') {
      const envEntries = Object.entries(editedConfig.env);
      const invalidEnvVars = envEntries.filter(([key]) => !key.trim() || !isValidEnvVarName(key));
      const envKeys = envEntries.map(([key]) => key);
      const duplicateKeys = envKeys.filter((key, index) => envKeys.indexOf(key) !== index);
      
      if (invalidEnvVars.length > 0) {
        alert('Please correct invalid environment variable names');
        return;
      }
      
      if (duplicateKeys.length > 0) {
        alert('Environment variable names cannot be duplicated');
        return;
      }
    }
    
    // Clean up empty environment variables
    const cleanedConfig = { ...editedConfig };
    if (cleanedConfig.env) {
      const cleanedEnv: Record<string, string> = {};
      Object.entries(cleanedConfig.env).forEach(([key, value]) => {
        if (key.trim() && isValidEnvVarName(key)) {
          cleanedEnv[key] = String(value);
        }
      });
      cleanedConfig.env = Object.keys(cleanedEnv).length > 0 ? cleanedEnv : undefined;
    }
    
    try {
      console.log('[ServerPanel] Saving server config:', server?.name, cleanedConfig);
      console.log('[ServerPanel] Environment variables:', cleanedConfig.env);
      
      // Call the dedicated server update API endpoint
      const response = await fetch(`/api/servers/${server?.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedConfig)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Server name already exists') {
          alert(`❌ Server name conflict!\n\nA server named "${cleanedConfig.name}" already exists. Please choose a different name.`);
        } else {
          throw new Error(errorData.error || errorData.message || 'Failed to update server');
        }
        return;
      }
      
      const result = await response.json();
      console.log('[ServerPanel] Server update response:', result);
      
      // Update local state with the response data
      if (result.server) {
        updateServerConfig(server?.name || '', result.server);
      }
      
      console.log('[ServerPanel] Config saved successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update server config:', error);
      alert(`❌ Failed to save configuration:\n\n${(error as Error).message}`);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    const newConfig = { ...editedConfig, [field]: value };
    setEditedConfig(newConfig);
    
    // Validate name if it's being changed
    if (field === 'name') {
      setNameValidation(validateServerName(value));
    }
  };

  // Environment variable management functions
  const handleEnvChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const currentEnv = editedConfig.env || {};
    const envEntries = Object.entries(currentEnv);
    
    if (field === 'key') {
      const oldKey = envEntries[index]?.[0];
      const value = envEntries[index]?.[1] || '';
      const newEnv = { ...currentEnv };
      
      // Delete old key
      if (oldKey) delete newEnv[oldKey];
      
      // Add new key (if valid)
      if (newValue.trim() && isValidEnvVarName(newValue)) {
        newEnv[newValue] = value;
      }
      
      setEditedConfig({ ...editedConfig, env: newEnv });
    } else {
      const key = envEntries[index]?.[0];
      if (key) {
        setEditedConfig({ 
          ...editedConfig, 
          env: { ...currentEnv, [key]: newValue } 
        });
      }
    }
  };

  // Validate environment variable name
  const isValidEnvVarName = (name: string): boolean => {
    // Environment variable names should start with a letter or underscore, containing only letters, numbers, and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const addEnvVar = () => {
    const currentEnv = editedConfig.env || {};
    // Create a temporary unique key for new environment variable
    let newKey = 'NEW_VAR';
    let counter = 1;
    while (currentEnv[newKey]) {
      newKey = `NEW_VAR_${counter}`;
      counter++;
    }
    const newEnv = { ...currentEnv, [newKey]: '' };
    setEditedConfig({ ...editedConfig, env: newEnv });
  };

  const removeEnvVar = (index: number) => {
    const currentEnv = editedConfig.env || {};
    const envEntries = Object.entries(currentEnv);
    const keyToRemove = envEntries[index]?.[0];
    if (keyToRemove !== undefined) {
      const newEnv = { ...currentEnv };
      delete newEnv[keyToRemove];
      setEditedConfig({ ...editedConfig, env: newEnv });
    }
  };

  const handleRemoveServer = async () => {
    if (!confirm(`Are you sure you want to remove server "${server?.name}"?`)) {
      return;
    }

    try {
      await removeServer(server?.name || '');
      console.log('[ServerPanel] Server removed successfully');
    } catch (error) {
      console.error('Failed to remove server:', error);
      alert(`Failed to remove server: ${(error as Error).message}`);
    }
  };

  const isStdio = editedConfig.transport === 'stdio';

  return (
    <div className="flex flex-col h-full">
      {/* Server header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {server?.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {server?.description || 'No description'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Delete button */}
          <button
            onClick={handleRemoveServer}
            className="p-3 rounded-md transition-colors text-red-600 hover:bg-red-100"
            title="Delete server"
          >
            <Trash2 className="h-8 w-8" />
          </button>
          
          {/* Toggle server button */}
          <button
            onClick={handleToggleServer}
            className={`p-3 rounded-md transition-colors ${
              server?.enabled 
                ? 'text-green-600 hover:bg-green-100' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={server?.enabled ? 'Disable server' : 'Enable server'}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : server?.enabled ? (
              <ToggleRight className="h-8 w-8" />
            ) : (
              <ToggleLeft className="h-8 w-8" />
            )}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'tools', label: 'Tool List', icon: Zap },
            { id: 'config', label: 'Server Configuration', icon: Settings },
            { id: 'logs', label: 'Runtime Logs', icon: RefreshCw }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'config' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Server Configuration</h3>
              <div className="flex items-center space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-primary btn-sm"
                  >
                    Edit Configuration
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving || !nameValidation.valid}
                    className="btn-primary btn-sm flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Basic configuration */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Server Name
                    </label>
                    <input
                      type="text"
                      value={editedConfig.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditing}
                      className={`w-full p-3 border rounded-md disabled:bg-gray-100 ${
                        nameValidation.valid 
                          ? 'border-gray-300 focus:border-blue-500' 
                          : 'border-red-300 focus:border-red-500'
                      }`}
                    />
                    {!nameValidation.valid && isEditing && (
                      <div className="mt-1 text-red-600 text-sm">
                        {nameValidation.error}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transport Protocol
                    </label>
                    <select
                      value={editedConfig.transport}
                      onChange={(e) => handleInputChange('transport', e.target.value)}
                      disabled={!isEditing}
                      className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                    >
                      <option value="stdio">Stdio</option>
                      <option value="http-sse">HTTP SSE</option>
                      <option value="streamable-http">Streamable HTTP</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editedConfig.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      disabled={!isEditing}
                      rows={2}
                      className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                      placeholder="Server description..."
                    />
                  </div>
                </div>
              </div>

              {/* Connection configuration */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Connection Configuration</h4>
                
                {isStdio ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Command
                      </label>
                      <input
                        type="text"
                        value={editedConfig.command || ''}
                        onChange={(e) => handleInputChange('command', e.target.value)}
                        disabled={!isEditing}
                        className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                        placeholder="e.g.: npx, node, python"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Arguments (one per line)
                      </label>
                      <textarea
                        value={editedConfig.args?.join('\n') || ''}
                        onChange={(e) => handleInputChange('args', e.target.value.split('\n').filter(Boolean))}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                        placeholder="e.g.:\n@modelcontextprotocol/server-filesystem\n/path/to/directory"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Environment Variables
                      </label>
                      <div className="space-y-2">
                        {Object.entries(editedConfig.env || {}).map(([key, value], index) => (
                          <div key={index} className="flex space-x-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => handleEnvChange(index, 'key', e.target.value)}
                              disabled={!isEditing}
                              className="flex-1 p-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                              placeholder="Variable name"
                            />
                            <input
                              type="text"
                              value={String(value)}
                              onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                              disabled={!isEditing}
                              className="flex-1 p-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                              placeholder="Value"
                            />
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => removeEnvVar(index)}
                                className="p-2 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={addEnvVar}
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Environment Variable</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={editedConfig.endpoint || ''}
                      onChange={(e) => handleInputChange('endpoint', e.target.value)}
                      disabled={!isEditing}
                      className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                      placeholder="e.g.: https://api.example.com/mcp"
                    />
                  </div>
                )}
              </div>

              {/* Advanced options - always show */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Advanced Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={editedConfig.timeout || ''}
                      onChange={(e) => handleInputChange('timeout', e.target.value ? parseInt(e.target.value) : undefined)}
                      disabled={!isEditing}
                      className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                      placeholder="30000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retries
                    </label>
                    <input
                      type="number"
                      value={editedConfig.retries || ''}
                      onChange={(e) => handleInputChange('retries', e.target.value ? parseInt(e.target.value) : undefined)}
                      disabled={!isEditing}
                      className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100"
                      placeholder="3"
                    />
                  </div>
                </div>
              </div>

              {/* Save button at bottom */}
              {isEditing && (
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={saving || !nameValidation.valid}
                    className="btn-primary btn-sm flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <ToolsPanel server={server} />
        )}

        {activeTab === 'logs' && (
          <ServerLogs serverName={server?.name} />
        )}
      </div>
    </div>
  );
};