import React, { useState } from 'react';
import { Zap, Play, Settings, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ToolInfo } from '../types';

export const ToolsManagement: React.FC = () => {
  const { tools, selectedTool, setSelectedTool } = useAppStore();
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testArgs, setTestArgs] = useState('{}');

  const handleToolSelect = (toolName: string) => {
    setSelectedTool(selectedTool === toolName ? null : toolName);
    setTestResult(null);
  };

  const handleTestTool = async (toolName: string) => {
    setTesting(true);
    try {
      const args = JSON.parse(testArgs);
      const response = await fetch(`/api/tools/${toolName}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args }),
      });
      
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
    setTesting(false);
  };

  const renderSchema = (schema: any) => {
    if (!schema) return 'No parameters';
    
    return (
      <div className="bg-gray-100 p-3 rounded text-xs font-mono">
        <pre>{JSON.stringify(schema, null, 2)}</pre>
      </div>
    );
  };

  const groupToolsByServer = (tools: ToolInfo[]) => {
    return tools.reduce((groups: Record<string, ToolInfo[]>, tool) => {
      const serverName = tool.serverName || 'unknown';
      if (!groups[serverName]) {
        groups[serverName] = [];
      }
      groups[serverName].push(tool);
      return groups;
    }, {});
  };

  const toolGroups = groupToolsByServer(tools);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Zap className="h-5 w-5 mr-2" />
          Tool Management and Testing
        </h2>
        <span className="text-sm text-gray-500">{tools.length} tools</span>
      </div>

      <div className="space-y-6">
        {Object.keys(toolGroups).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No tools available</p>
          </div>
        ) : (
          Object.entries(toolGroups).map(([serverName, serverTools]) => (
            <div key={serverName} className="border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  {serverName}
                  <span className="ml-2 text-sm text-gray-500">({serverTools.length} tools)</span>
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {serverTools.map((tool: ToolInfo) => (
                  <div key={tool.name} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900">{tool.name}</h4>
                          <button
                            onClick={() => handleToolSelect(tool.name)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                      </div>
                      
                      <button
                        onClick={() => handleToolSelect(tool.name)}
                        className="btn-primary btn-sm flex items-center space-x-2"
                      >
                        <Play className="h-3 w-3" />
                        <span>Test</span>
                      </button>
                    </div>

                    {/* Expanded tool details and testing area */}
                    {selectedTool === tool.name && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                        {/* Parameter schema */}
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Parameter Schema:</h5>
                          {renderSchema(tool.inputSchema)}
                        </div>

                        {/* Testing area */}
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Test Parameters:</h5>
                          <textarea
                            value={testArgs}
                            onChange={(e) => setTestArgs(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
                            rows={4}
                            placeholder="Enter JSON format test parameters, e.g.: {}"
                          />
                          
                          <div className="flex space-x-2 mt-2">
                            <button
                              onClick={() => handleTestTool(tool.name)}
                              disabled={testing}
                              className="btn-primary btn-sm"
                            >
                              {testing ? 'Testing...' : 'Execute Test'}
                            </button>
                            <button
                              onClick={() => setTestArgs(JSON.stringify({}, null, 2))}
                              className="btn-secondary btn-sm"
                            >
                              Reset Parameters
                            </button>
                          </div>
                        </div>

                        {/* Test results */}
                        {testResult && (
                          <div>
                            <h5 className="font-medium text-gray-700 mb-2 flex items-center">
                              Test Results:
                              {testResult.error ? (
                                <AlertCircle className="h-4 w-4 ml-2 text-red-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 ml-2 text-green-500" />
                              )}
                            </h5>
                            <div className={`p-3 rounded-md ${
                              testResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                            }`}>
                              <pre className="text-xs font-mono overflow-x-auto">
                                {JSON.stringify(testResult, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};