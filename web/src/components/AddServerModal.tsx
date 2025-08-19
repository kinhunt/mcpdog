import React, { useState } from 'react';
import { X, FileText, Settings, Plus, Trash2 } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { ServerConfig } from '../types/config';
import { apiClient } from '../utils/api';

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

    if (!config.command && !config.endpoint && !config.url) {
      errors.push(`Server "${name}" is missing command or URL field`);
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

  // Headers management functions (similar to environment variables)
  const handleHeaderChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const currentHeaders = serverConfig.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    
    if (field === 'key') {
      const oldKey = headerEntries[index]?.[0];
      const value = headerEntries[index]?.[1] || '';
      const newHeaders = { ...currentHeaders };
      
      // Delete old key
      if (oldKey) delete newHeaders[oldKey];
      
      // Add new key (if valid)
      if (newValue.trim()) {
        newHeaders[newValue] = value;
      }
      
      handleConfigChange('headers', newHeaders);
    } else {
      const key = headerEntries[index]?.[0];
      if (key) {
        handleConfigChange('headers', { ...currentHeaders, [key]: newValue });
      }
    }
  };

  const addHeader = () => {
    const currentHeaders = serverConfig.headers || {};
    // Create a temporary unique key for new header
    let newKey = 'Header-Name';
    let counter = 1;
    while (currentHeaders[newKey]) {
      newKey = `Header-Name-${counter}`;
      counter++;
    }
    const newHeaders = { ...currentHeaders, [newKey]: '' };
    handleConfigChange('headers', newHeaders);
  };

  const removeHeader = (index: number) => {
    const currentHeaders = serverConfig.headers || {};
    const headerEntries = Object.entries(currentHeaders);
    const keyToRemove = headerEntries[index]?.[0];
    
    if (keyToRemove) {
      const newHeaders = { ...currentHeaders };
      delete newHeaders[keyToRemove];
      handleConfigChange('headers', Object.keys(newHeaders).length > 0 ? newHeaders : undefined);
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
        const servers = await apiClient.get('/api/servers');
        existingNames = Object.keys(servers);
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
          let transport = config.transport;
          if (!transport) {
            if (config.url || config.endpoint) {
              // Has URL/endpoint field
              if (config.type === 'sse' || config.transport === 'http-sse') {
                transport = 'http-sse';
              } else {
                transport = 'streamable-http';  // Default HTTP transport
              }
            } else if (config.command) {
              // Has command field
              transport = 'stdio';
            } else {
              // Fallback to stdio if neither URL nor command is specified
              transport = 'stdio';
            }
          }
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
        const servers = await apiClient.get('/api/servers');
        const existingNames = Object.keys(servers);
        
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
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-4xl h-[90vh] max-h-none bg-base-100">
        {/* Modal header */}
        <div className="flex items-center justify-between pb-6 border-b border-base-300">
          <div>
            <h2 className="text-xl font-bold text-base-content">Add MCP Server</h2>
            <p className="text-sm text-base-content/70 mt-1">Configure a new MCP server</p>
          </div>
          <button
            onClick={hideAddServer}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="py-6 max-h-[600px] overflow-y-auto">
          {/* Mode switching */}
          <div className="tabs tabs-boxed mb-6">
            <button
              type="button"
              onClick={() => setAddMode('json')}
              className={`tab flex items-center gap-2 ${
                addMode === 'json' ? 'tab-active' : ''
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>JSON Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode('form')}
              className={`tab flex items-center gap-2 ${
                addMode === 'form' ? 'tab-active' : ''
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
                <label className="label">
                  <span className="label-text font-medium">Server Configuration (JSON)</span>
                </label>
                <textarea
                  value={jsonConfig}
                  onChange={(e) => setJsonConfig(e.target.value)}
                  rows={12}
                  className="textarea textarea-bordered w-full font-mono text-sm"
                  placeholder={`{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`}
                />
                {jsonError && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm whitespace-pre-wrap">
                      {jsonError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Form Configuration Mode
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h4 className="card-title text-base">Basic Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text font-medium">Server Name *</span>
                      </label>
                      <input
                        type="text"
                        value={serverName}
                        onChange={(e) => handleServerNameChange(e.target.value)}
                        className={`input input-bordered w-full ${
                          !nameValidation.valid ? 'input-error' : ''
                        }`}
                        placeholder="e.g.: playwright, filesystem-server"
                      />
                      {!nameValidation.valid && (
                        <div className="mt-2 text-error text-sm">
                          {nameValidation.error}
                          {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
                            <div className="mt-1">
                              <span className="text-base-content/70">Suggestions: </span>
                              {nameValidation.suggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleServerNameChange(suggestion)}
                                  className="btn btn-link btn-xs p-0 mr-2"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="label">
                        <span className="label-text-alt">Only letters, numbers, hyphens, and underscores allowed</span>
                      </div>
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text font-medium">Transport Protocol</span>
                      </label>
                      <select
                        value={serverConfig.transport}
                        onChange={(e) => handleConfigChange('transport', e.target.value)}
                        className="select select-bordered w-full"
                      >
                        <option value="stdio">Stdio</option>
                        <option value="http-sse">HTTP SSE</option>
                        <option value="streamable-http">Streamable HTTP</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text font-medium">Description</span>
                      </label>
                      <textarea
                        value={serverConfig.description || ''}
                        onChange={(e) => handleConfigChange('description', e.target.value)}
                        rows={2}
                        className="textarea textarea-bordered w-full"
                        placeholder="Optional server description..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection Configuration */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h4 className="card-title text-base">Connection Configuration</h4>
                  
                  {isStdio ? (
                    <div className="space-y-4">
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">Command *</span>
                        </label>
                        <input
                          type="text"
                          value={serverConfig.command || ''}
                          onChange={(e) => handleConfigChange('command', e.target.value)}
                          className="input input-bordered w-full"
                          placeholder="e.g.: npx, node, python"
                        />
                      </div>
                      
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">Arguments (one per line)</span>
                        </label>
                        <textarea
                          value={serverConfig.args?.join('\n') || ''}
                          onChange={(e) => handleConfigChange('args', e.target.value.split('\n').filter(Boolean))}
                          rows={3}
                          className="textarea textarea-bordered w-full"
                          placeholder="e.g.:\n@modelcontextprotocol/server-filesystem\n/path/to/directory"
                        />
                      </div>
                      
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">Environment Variables</span>
                        </label>
                        <div className="space-y-2">
                          {Object.entries(serverConfig.env || {}).map(([key, value], index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => handleEnvChange(index, 'key', e.target.value)}
                                className="input input-bordered input-sm flex-1"
                                placeholder="Variable name"
                              />
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                                className="input input-bordered input-sm flex-1"
                                placeholder="Value"
                              />
                              <button
                                type="button"
                                onClick={() => removeEnvVar(index)}
                                className="btn btn-ghost btn-sm btn-square text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addEnvVar}
                            className="btn btn-ghost btn-sm gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Environment Variable</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">URL *</span>
                        </label>
                        <input
                          type="url"
                          value={serverConfig.url || serverConfig.endpoint || ''}
                          onChange={(e) => handleConfigChange('url', e.target.value)}
                          className="input input-bordered w-full"
                          placeholder="e.g.: https://api.example.com/mcp"
                        />
                      </div>
                      
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">Headers</span>
                        </label>
                        <div className="space-y-2">
                          {Object.entries(serverConfig.headers || {}).map(([key, value], index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                className="input input-bordered input-sm flex-1"
                                placeholder="Header name"
                              />
                              <input
                                type="text"
                                value={value as string}
                                onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                className="input input-bordered input-sm flex-1"
                                placeholder="Header value"
                              />
                              <button
                                type="button"
                                onClick={() => removeHeader(index)}
                                className="btn btn-ghost btn-sm btn-square text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addHeader}
                            className="btn btn-ghost btn-sm gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Header</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="card-title text-base">Advanced Options</h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="btn btn-ghost btn-sm"
                    >
                      {showAdvanced ? 'Hide' : 'Show'} Advanced
                    </button>
                  </div>
                  
                  {showAdvanced && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label">
                            <span className="label-text font-medium">Timeout (ms)</span>
                          </label>
                          <input
                            type="number"
                            value={serverConfig.timeout || ''}
                            onChange={(e) => handleConfigChange('timeout', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="input input-bordered w-full"
                            placeholder="30000"
                          />
                        </div>
                        <div>
                          <label className="label">
                            <span className="label-text font-medium">Retries</span>
                          </label>
                          <input
                            type="number"
                            value={serverConfig.retries || ''}
                            onChange={(e) => handleConfigChange('retries', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="input input-bordered w-full"
                            placeholder="3"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="modal-action pt-6 border-t border-base-300">
            <button
              type="button"
              onClick={hideAddServer}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving || (addMode === 'form' && !nameValidation.valid)}
              className="btn btn-primary"
            >
              {saving ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};