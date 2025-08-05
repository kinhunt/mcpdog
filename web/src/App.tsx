import { ServerManager } from './components/ServerManager';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppStore } from './store/useAppStore';

function App() {
  const { connected } = useAppStore();
  
  // 连接WebSocket并获取刷新功能
  const { refreshServerTools } = useWebSocket(process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : window.location.origin);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Status Alert */}
        {!connected && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Connection Disconnected
                </h3>
                <div className="mt-1 text-sm text-yellow-700">
                  <p>Unable to connect to MCPDog server. Please ensure the server is running and check your network connection.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server Management Interface */}
        <div className="h-full">
          <ServerManager refreshServerTools={refreshServerTools} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>MCPDog v2.0.0 - MCP Server Manager</p>
            <p>Real-time Monitoring • Configuration Management • Tool Testing</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;