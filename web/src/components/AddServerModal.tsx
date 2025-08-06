import React, { useState } from 'react';
import { X, FileText, Settings, Plus, Trash2 } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { ServerConfig } from '../types/config';

// Server name validation pattern
const SERVER_NAME_PATTERN = /^[a-zA-Z0-9\-_]+$/;

export const AddServerModal: React.FC = () => {
  const [addMode, setAddMode] = useState<'json' | 'form'>('json');
  const [jsonConfig, setJsonConfig] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverConfig, setServerConfig] = useState<Partial<ServerConfig>>({
    enabled: true,
    transport: 'stdio',
    toolsConfig: { mode: 'all' }
  });
  const [jsonError, setJsonError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nameValidation, setNameValidation] = useState<{ valid: boolean; error?: string; suggestions?: string[] }>({ valid: true });
  
  const { hideAddServer, addServer, saving } = useConfigStore();

  // Validate server name with real-time feedback
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

  // Handle server name input with real-time validation
  const handleServerNameChange = (value: string) => {
    setServerName(value);
    setNameValidation(validateServerName(value));
  };

  // JSON parsing and validation function
  const parseJsonConfig = (jsonText: string) => {
    setJsonError('');
    
    if (!jsonText.trim()) {
      setJsonError('Please enter configuration JSON');
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText);
      
      // Support multiple JSON formats
      let servers: Record<string, any> = {};
      
      if (parsed.mcpServers) {
        // Claude Desktop format: { "mcpServers": { "server-name": {...} } }
        servers = parsed.mcpServers;
      } else if (parsed.servers) {
        // MCPDog format: { "servers": { "server-name": {...} } }
        servers = parsed.servers;
      } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Direct server configuration: { "server-name": {...} }
        servers = parsed;
      } else {
        setJsonError('Invalid configuration format. Please provide valid MCP server configuration JSON');
        return null;
      }

      const serverEntries = Object.entries(servers);
      if (serverEntries.length === 0) {
        setJsonError('No servers found in configuration');
        return null;
      }

      return serverEntries.map(([name, config]) => ({ name, config }));
    } catch (error) {
      setJsonError(`JSON parsing error: ${(error as Error).message}`);
      return null;
    }
  };

  // Validate server configuration
  const validateServerConfig = (name: string, config: any) => {
    const errors: string[] = [];

    // Use the same validation as form mode
    const nameValidation = validateServerName(name);
    if (!nameValidation.valid) {
      errors.push(`Server name "${name}": ${nameValidation.error}`);
    }

    if (!config.command && !config.endpoint) {
      errors.push(`Server "${name}" is missing command or endpoint field`);
    }

    if (config.args && !Array.isArray(config.args)) {
      errors.push(`Server "${name}" args must be an array`);
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push(`Server "${name}" env must be an object`);
    }

    return errors;
  };

  const handleConfigChange = (field: string, value: any) => {
    setServerConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Environment variable management functions
  const handleEnvChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const currentEnv = serverConfig.env || {};
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
      
      handleConfigChange('env', newEnv);
    } else {
      const key = envEntries[index]?.[0];
      if (key) {
        handleConfigChange('env', { ...currentEnv, [key]: newValue });
      }
    }
  };

  // Validate environment variable name
  const isValidEnvVarName = (name: string): boolean => {
    // Environment variable names should start with a letter or underscore, containing only letters, numbers, and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  };

  const addEnvVar = () => {
    const currentEnv = serverConfig.env || {};
    // Create a temporary unique key for new environment variable
    let newKey = 'NEW_VAR';
    let counter = 1;
    while (currentEnv[newKey]) {
      newKey = `NEW_VAR_${counter}`;
      counter++;
    }
    const newEnv = { ...currentEnv, [newKey]: '' };
    handleConfigChange('env', newEnv);
  };

  const removeEnvVar = (index: number) => {
    const currentEnv = serverConfig.env || {};
    const envEntries = Object.entries(currentEnv);
    const keyToRemove = envEntries[index]?.[0];
    if (keyToRemove !== undefined) {
      const newEnv = { ...currentEnv };
      delete newEnv[keyToRemove];
      handleConfigChange('env', newEnv);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (addMode === 'json') {
      // JSON mode processing
      const parsedServers = parseJsonConfig(jsonConfig);
      if (!parsedServers) return;

      // Check existing server names
      let existingNames: string[] = [];
      try {
        const response = await fetch('/api/servers');
        existingNames = Object.keys(await response.json());
      } catch (error) {
        console.warn('Unable to check server name duplicates:', error);
      }

      // Validate all server configurations
      const errors: string[] = [];
      const conflictNames: string[] = [];
      
      for (const { name, config } of parsedServers) {
        const configErrors = validateServerConfig(name, config);
        errors.push(...configErrors);
        
        if (existingNames.includes(name)) {
          conflictNames.push(name);
        }
      }

      if (conflictNames.length > 0) {
        setJsonError(`❌ Server name conflict detected!\n\nThe following server names already exist:\n${conflictNames.map(name => `• ${name}`).join('\n')}\n\nPlease choose different names for these servers.`);
        return;
      }

      if (errors.length > 0) {
        setJsonError(`❌ Configuration errors found:\n\n${errors.join('\n')}`);
        return;
      }

      // Add all servers
      try {
        for (const { name, config } of parsedServers) {
          // Ensure all required fields exist, including transport
          // Prioritize user-specified transport, otherwise infer from configuration
          const transport = config.transport || (config.endpoint ? 'streamable-http' : 'stdio');
          const enabled = config.enabled !== undefined ? config.enabled : true;
          
          const finalConfig: any = {
            ...config, // Apply original config first
            name: name, // Ensure name is correct
            enabled,    // Set enabled status
            transport,  // Set transport type
            toolsConfig: { mode: 'all' } // Set tool configuration
          };
          
          console.log('[AddServerModal] Adding server from JSON:', name, finalConfig);
          await addServer(name, finalConfig);
        }
        console.log('[AddServerModal] All servers added successfully');
        hideAddServer();
      } catch (error) {
        console.error('Failed to add servers:', error);
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('already exists')) {
          setJsonError(`❌ Server name conflict!\n\nA server with this name already exists. Please choose a different name.`);
        } else {
          setJsonError(`❌ Failed to add server:\n\n${errorMessage}`);
        }
      }
    } else {
      // Form mode processing
      if (!serverName.trim()) {
        alert('Please enter a server name');
        return;
      }

      if (!nameValidation.valid) {
        alert(`Invalid server name: ${nameValidation.error}`);
        return;
      }

      try {
        const response = await fetch('/api/servers');
        const existingNames = Object.keys(await response.json());
        
        if (existingNames.includes(serverName.trim())) {
          alert(`❌ Server name "${serverName.trim()}" already exists!\n\nPlease choose a different name.`);
          return;
        }
      } catch (error) {
        console.warn('Unable to check server name duplicates:', error);
      }

      const finalConfig: any = {
        name: serverName,
        ...serverConfig
      };
      
      try {
        console.log('[AddServerModal] Adding server via form:', serverName, finalConfig);
        await addServer(serverName, finalConfig);
        console.log('[AddServerModal] Server added successfully');
        hideAddServer();
      } catch (error) {
        console.error('Failed to add server:', error);
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('already exists')) {
          alert(`❌ Server name conflict!\n\nA server named "${serverName}" already exists. Please choose a different name.`);
        } else {
          alert(`❌ Failed to add server:\n\n${errorMessage}`);
        }
      }
    }
  };

  const isStdio = serverConfig.transport === 'stdio';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add MCP Server</h2>
            <p className="text-sm text-gray-500 mt-1">Configure a new MCP server</p>
          </div>
          <button
            onClick={hideAddServer}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 max-h-[600px] overflow-y-auto">
          {/* Mode switching */}
          <div className="flex border border-gray-200 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setAddMode('json')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                addMode === 'json'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>JSON Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('form')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                addMode === 'form'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Form Configuration</span>
            </button>
          </div>

          {addMode === 'json' ? (
            // JSON Configuration Mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Configuration (JSON)
                </label>
                <textarea
                  value={jsonConfig}
                  onChange={(e) => setJsonConfig(e.target.value)}
                  rows={12}
                  className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder={`{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}`}
                />
                {jsonError && (
                  <div className="mt-2 text-red-600 text-sm bg-red-50 p-3 rounded">
                    {jsonError}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Form Configuration Mode
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Server Name *
                    </label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => handleServerNameChange(e.target.value)}
                      className={`w-full p-3 border rounded-md ${
                        nameValidation.valid 
                          ? 'border-gray-300 focus:border-blue-500' 
                          : 'border-red-300 focus:border-red-500'
                      }`}
                      placeholder="e.g.: playwright, filesystem-server"
                    />
                    {!nameValidation.valid && (
                      <div className="mt-2 text-red-600 text-sm">
                        {nameValidation.error}
                        {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
                          <div className="mt-1">
                            <span className="text-gray-600">Suggestions: </span>
                            {nameValidation.suggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleServerNameChange(suggestion)}
                                className="text-blue-600 hover:text-blue-800 underline mr-2"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Only letters, numbers, hyphens, and underscores allowed
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transport Protocol
                    </label>
                    <select
                      value={serverConfig.transport}
                      onChange={(e) => handleConfigChange('transport', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    >
                      <option value="stdio">Stdio</option>
                      <option value="http-sse">HTTP SSE</option>
                      <option value="streamable-http">Streamable HTTP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={serverConfig.description || ''}
                      onChange={(e) => handleConfigChange('description', e.target.value)}
                      rows={2}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      placeholder="Optional server description..."
                    />
                  </div>
                </div>
              </div>

              {/* Connection Configuration */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Connection Configuration</h4>
                
                {isStdio ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Command *
                      </label>
                      <input
                        type="text"
                        value={serverConfig.command || ''}
                        onChange={(e) => handleConfigChange('command', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md"
                        placeholder="e.g.: npx, node, python"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Arguments (one per line)
                      </label>
                      <textarea
                        value={serverConfig.args?.join('\n') || ''}
                        onChange={(e) => handleConfigChange('args', e.target.value.split('\n').filter(Boolean))}
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-md"
                        placeholder="e.g.:\n@modelcontextprotocol/server-filesystem\n/path/to/directory"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Environment Variables
                      </label>
                      <div className="space-y-2">
                        {Object.entries(serverConfig.env || {}).map(([key, value], index) => (
                          <div key={index} className="flex space-x-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => handleEnvChange(index, 'key', e.target.value)}
                              className="flex-1 p-2 border border-gray-300 rounded text-sm"
                              placeholder="Variable name"
                            />
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                              className="flex-1 p-2 border border-gray-300 rounded text-sm"
                              placeholder="Value"
                            />
                            <button
                              type="button"
                              onClick={() => removeEnvVar(index)}
                              className="p-2 text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addEnvVar}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Environment Variable</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endpoint URL *
                    </label>
                    <input
                      type="url"
                      value={serverConfig.endpoint || ''}
                      onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      placeholder="e.g.: https://api.example.com/mcp"
                    />
                  </div>
                )}
              </div>

              {/* Advanced Options */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Advanced Options</h4>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                  </button>
                </div>
                
                {showAdvanced && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          value={serverConfig.timeout || ''}
                          onChange={(e) => handleConfigChange('timeout', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="30000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Retries
                        </label>
                        <input
                          type="number"
                          value={serverConfig.retries || ''}
                          onChange={(e) => handleConfigChange('retries', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="3"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={hideAddServer}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving || (addMode === 'form' && !nameValidation.valid)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};