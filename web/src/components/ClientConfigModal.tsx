import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useConfigStore } from '../store/configStore';

export const ClientConfigModal: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stdio' | 'http'>('stdio');
  
  const { hideClientConfig, authRequired, authToken } = useConfigStore();

  // Use auth state from store - only include headers if auth is required AND we have a token
  const shouldIncludeAuth = authRequired && authToken;

  const handleCopyConfig = async (config: string, type: string) => {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // STDIO configuration
  const stdioConfig = {
    "mcpServers": {
      "mcpdog": {
        "command": "npx",
        "args": ["mcpdog@latest"]
      }
    }
  };

  // HTTP Streamable configuration
  const httpConfig = {
    "mcpServers": {
      "mcpdog-http": {
        "type": "streamable-http",
        "url": "http://localhost:4000",
        ...(shouldIncludeAuth && {
          "headers": {
            "Authorization": `Bearer ${authToken}`
          }
        })
      }
    }
  };

  const configs = {
    stdio: {
      title: 'STDIO Connection',
      description: 'Standard input/output connection for MCP clients like Claude Desktop',
      config: JSON.stringify(stdioConfig, null, 2)
    },
    http: {
      title: 'HTTP Streamable Connection',
      description: 'HTTP-based connection with streamable transport',
      config: JSON.stringify(httpConfig, null, 2)
    }
  };

  const currentConfig = configs[activeTab];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div>
            <h2 className="text-xl font-bold text-base-content">Connect To MCPDOG</h2>
            <p className="text-sm text-base-content/70 mt-1">
              Use these JSON configurations to connect your MCP clients to MCPDog
            </p>
          </div>
          <button
            onClick={hideClientConfig}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {/* Tabs */}
          <div className="tabs tabs-boxed justify-center mb-6">
            <button 
              className={`tab ${activeTab === 'stdio' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('stdio')}
            >
              STDIO Connection
            </button>
            <button 
              className={`tab ${activeTab === 'http' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('http')}
            >
              HTTP Streamable
            </button>
          </div>

          {/* Current Config Display */}
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="card-title text-base-content">{currentConfig.title}</h3>
                  <p className="text-sm text-base-content/70 mt-1">{currentConfig.description}</p>
                </div>
                <button
                  onClick={() => handleCopyConfig(currentConfig.config, activeTab)}
                  className="btn btn-outline btn-sm"
                >
                  {copied === activeTab ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              
              {/* Configuration JSON */}
              <div className="mockup-code">
                <pre className="text-sm"><code>{currentConfig.config}</code></pre>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};