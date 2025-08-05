import React, { useState } from 'react';
import { X, Copy, Download, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { useConfigStore } from '../store/configStore';

export const ClientConfigModal: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState<string>('claude-desktop');
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);
  
  const { 
    servers, 
    hideClientConfig, 
    generateClientConfig 
  } = useConfigStore();

  const enabledServers = servers.filter(s => s.enabled);

  const handleGenerateConfig = () => {
    try {
      const serversToInclude = selectedServers.length > 0 ? selectedServers : 
                               enabledServers.map(s => s.name);
      const config = generateClientConfig(selectedClient, serversToInclude);
      setGeneratedConfig(config);
    } catch (error) {
      console.error('Failed to generate config:', error);
    }
  };

  const handleCopyConfig = async () => {
    if (!generatedConfig) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(generatedConfig.config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownloadConfig = () => {
    if (!generatedConfig) return;
    
    const filename = selectedClient === 'claude-desktop' ? 
                    'claude_desktop_config.json' : 
                    'mcp_config.json';
    
    const blob = new Blob([JSON.stringify(generatedConfig.config, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clientOptions = [
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      description: 'Anthropic\'s official Claude desktop application',
      icon: '🤖',
      supported: true
    },
    {
      id: 'cursor',
      name: 'Cursor Editor',
      description: 'Code editor with AI capabilities',
      icon: '✏️',
      supported: true
    },
    {
      id: 'vscode',
      name: 'VS Code',
      description: 'Visual Studio Code (via extension)',
      icon: '📝',
      supported: false
    },
    {
      id: 'continue',
      name: 'Continue',
      description: 'Open source AI code assistant for VS Code',
      icon: '🔄',
      supported: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">MCP Client Configuration Generator</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate configuration files for your MCP clients to easily connect to servers managed by MCPDog
            </p>
          </div>
          <button
            onClick={hideClientConfig}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Left configuration options */}
          <div className="w-1/2 border-r border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Client selection */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Select MCP Client</h3>
                <div className="space-y-2">
                  {clientOptions.map((client) => (
                    <label
                      key={client.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedClient === client.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${!client.supported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="client"
                        value={client.id}
                        checked={selectedClient === client.id}
                        onChange={(e) => setSelectedClient(e.target.value)}
                        disabled={!client.supported}
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-2xl">{client.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center space-x-2">
                            <span>{client.name}</span>
                            {!client.supported && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                Coming Soon
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{client.description}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Server selection */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Select Servers to Include</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Leave empty to include all enabled servers
                </p>
                
                {enabledServers.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No enabled servers</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {enabledServers.map((server) => (
                      <label
                        key={server.name}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedServers.includes(server.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServers([...selectedServers, server.name]);
                            } else {
                              setSelectedServers(selectedServers.filter(s => s !== server.name));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{server.name}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              server?.connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {server?.connected ? 'Connected' : 'Waiting'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {server?.description || 'No description'} • {server?.toolCount || 0} tools
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerateConfig}
                disabled={enabledServers.length === 0}
                className="w-full btn-primary"
              >
                Generate Configuration File
              </button>
            </div>
          </div>

          {/* Right configuration preview */}
          <div className="w-1/2 p-6 bg-gray-50 overflow-y-auto">
            {!generatedConfig ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Copy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Click "Generate Configuration File" to view configuration content</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Configuration file preview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{generatedConfig.name}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCopyConfig}
                        className="btn-secondary btn-sm flex items-center space-x-2"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={handleDownloadConfig}
                        className="btn-secondary btn-sm flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 overflow-x-auto">
                      {JSON.stringify(generatedConfig.config, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Installation instructions */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>Installation Instructions</span>
                  </h3>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                      {generatedConfig.instructions.map((instruction: string, index: number) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Important notes */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Important Notes</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Ensure the MCPDog daemon is running</li>
                        <li>Paths and commands in the configuration file need to be valid on the target machine</li>
                        <li>Some MCP servers may require additional dependencies or setup</li>
                        <li>After modifying configuration, you usually need to restart the MCP client</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              The configuration generator creates client configuration files based on your current MCPDog settings
            </div>
            <button
              onClick={hideClientConfig}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};