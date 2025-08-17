// API utility for handling authenticated requests

class APIClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : window.location.origin;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('mcpdog_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      // Token is invalid or missing, clear it but don't redirect
      // Let the React app handle the authentication state
      localStorage.removeItem('mcpdog_token');
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get(endpoint: string) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async post(endpoint: string, data?: any) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse(response);
  }

  async put(endpoint: string, data?: any) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse(response);
  }

  async delete(endpoint: string) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('mcpdog_token');
  }

  // Get the stored token
  getToken(): string | null {
    return localStorage.getItem('mcpdog_token');
  }

  // Clear authentication
  logout(): void {
    localStorage.removeItem('mcpdog_token');
    window.location.reload();
  }

  // Check authentication status with server
  async checkAuthStatus(): Promise<{ authenticated: boolean; required: boolean }> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/status`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      return await response.json();
    } catch (error) {
      // If we can't reach the server, assume auth is not required
      return { authenticated: false, required: false };
    }
  }

  // Login with token
  async login(token: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error || 'Login failed');
    }

    // Store the token on successful login
    localStorage.setItem('mcpdog_token', token);
  }
}

// Export singleton instance
export const apiClient = new APIClient();