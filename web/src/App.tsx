import React, { useState, useEffect } from 'react';
import { ServerManager } from './components/ServerManager';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppStore } from './store/useAppStore';
import { useConfigStore } from './store/configStore';
import { apiClient } from './utils/api';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const { connected } = useAppStore();
  const { setAuthState } = useConfigStore();
  const [authState, setLocalAuthState] = useState<{
    loading: boolean;
    authenticated: boolean;
    required: boolean;
  }>({ loading: true, authenticated: false, required: false });
  
  // 连接WebSocket并获取刷新功能
  const { refreshServerTools } = useWebSocket(process.env.NODE_ENV === 'development' ? 'http://localhost:38881' : window.location.origin);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await apiClient.checkAuthStatus();
      setLocalAuthState({
        loading: false,
        authenticated: status.authenticated,
        required: status.required
      });
      
      // Update global store
      setAuthState(status.required, status.authenticated ? localStorage.getItem('mcpdog_token') : null);
    } catch (error) {
      console.error('Auth status check failed:', error);
      setLocalAuthState({
        loading: false,
        authenticated: false,
        required: false
      });
      
      // Update global store
      setAuthState(false, null);
    }
  };

  const handleLogin = async (token: string) => {
    try {
      await apiClient.login(token);
      setLocalAuthState(prev => ({ ...prev, authenticated: true }));
      
      // Update global store
      setAuthState(true, token);
    } catch (error) {
      throw error; // Let the login component handle the error
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    setLocalAuthState(prev => ({ ...prev, authenticated: false }));
    
    // Update global store
    setAuthState(true, null);
  };

  // Show loading screen while checking auth
  if (authState.loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-base-100 flex items-center justify-center">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="mt-2 text-base-content">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show login screen if auth is required but user is not authenticated
  if (authState.required && !authState.authenticated) {
    return (
      <ThemeProvider>
        <LoginPage onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-base-100">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Global Status Alert */}
          {!connected && (
            <div className="alert alert-warning mb-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium">
                    Connection Disconnected
                  </h3>
                  <div className="mt-1 text-sm">
                    <p>Unable to connect to MCPDog server. Please ensure the server is running and check your network connection.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Server Management Interface */}
          <div className="h-full">
            <ServerManager 
              refreshServerTools={refreshServerTools} 
              onLogout={authState.required ? handleLogout : undefined}
            />
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

// Login Page Component
function LoginPage({ onLogin }: { onLogin: (token: string) => Promise<void> }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onLogin(token.trim());
    } catch (error) {
      setError((error as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-base-content">
            MCPDog Authentication
          </h2>
          <p className="mt-2 text-sm text-base-content/70">
            Please enter your authentication token to continue
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="token" className="sr-only">
              Authentication Token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              required
              className="input input-bordered w-full"
              placeholder="Enter authentication token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <div className="flex items-center">
                  <span className="loading loading-spinner loading-sm mr-2"></span>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;