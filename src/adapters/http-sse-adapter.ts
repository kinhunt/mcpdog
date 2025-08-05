import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import * as EventSourceLib from 'eventsource';
// @ts-ignore - CommonJS module in ESM context
const EventSource = (EventSourceLib as any).EventSource;
import { MCPServerConfig, MCPTool, MCPRequest, MCPResponse, ServerAdapter } from '../types/index.js';

export class HttpSseAdapter extends EventEmitter implements ServerAdapter {
  public readonly name: string;
  public readonly config: MCPServerConfig;
  public isConnected: boolean = false;

  private httpClient: AxiosInstance;
  private sseEventSource?: any; // Use any type to avoid EventSource type complexity
  private requestId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private baseUrl: string;
  private sseUrl: string;
  private dynamicEndpoint?: string; // Dynamic endpoint obtained from SSE
  private sessionId?: string; // MCP Session ID
  private sessionMode: 'auto' | 'required' | 'disabled' = 'auto'; // Session mode
  private reconnectTimer?: NodeJS.Timeout;
  private isReconnecting: boolean = false;
  private isDisabled: boolean = false; // Whether disabled, should not auto-reconnect if disabled

  constructor(name: string, config: MCPServerConfig) {
    super();
    this.name = name;
    this.config = config;

    if (config.transport !== 'http-sse') {
      throw new Error(`Invalid transport for HttpSseAdapter: ${config.transport}`);
    }

    if (!config.endpoint) {
      throw new Error('Endpoint is required for http-sse transport');
    }

    this.baseUrl = config.endpoint;
    this.sseUrl = config.sseEndpoint || `${this.baseUrl}/sse`;
    
    // Set session mode
    this.sessionMode = (config as any).sessionMode || 'auto';

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
        ...(config.headers || {}),
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      console.error(`Connecting to ${this.name} via HTTP+SSE: ${this.baseUrl}`);

      // 1. Establish SSE connection
      await this.connectSSE();

      // 2. Wait for dynamic endpoint to be set (give some time to receive endpoint event)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. Initialize handshake
      await this.initialize();

      // Mark as connected, let router manage tool list fetching
      this.isConnected = true;
      console.error(`Connected to ${this.name}`);
      this.emit('connected', { serverName: this.name });

    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to connect to ${this.name}: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    console.error(`Disconnecting from ${this.name}`);

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    this.cleanup();
    this.isConnected = false;

    console.error(`Disconnected from ${this.name}`);
    this.emit('disconnected', { serverName: this.name });
  }

  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const sseOptions: any = {
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...(this.config.headers || {}),
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          }
        };

        console.error(`Establishing SSE connection to ${this.sseUrl}`);
        
        this.sseEventSource = new EventSource(this.sseUrl, sseOptions);
        
        // Set event handler
        this.setupSSEHandlers(resolve, reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupSSEHandlers(resolve?: () => void, reject?: (error: Error) => void): void {
    if (!this.sseEventSource) {
      reject?.(new Error('SSE EventSource not initialized'));
      return;
    }

    // Connection successful
    this.sseEventSource.onopen = (event: any) => {
      console.error(`SSE connection opened for ${this.name}`);
      if (resolve) {
        resolve();
        resolve = undefined; // Avoid duplicate calls
      }
    };

    // Receive message
    this.sseEventSource.onmessage = (event: any) => {
      try {
        // Handle typed SSE events
        if (event.type === 'endpoint' || event.lastEventId === 'endpoint') {
          this.dynamicEndpoint = event.data;
          console.error(`Updated dynamic endpoint for ${this.name}: ${this.dynamicEndpoint}`);
          return;
        }
        
        const message = JSON.parse(event.data);
        this.handleSSEMessage(message);
        
        // Check if it's an MCP response
        if (message.id && (message.result || message.error)) {
          this.handleMCPResponse(message);
        }
      } catch (error) {
        // May be plain text message, try to handle as endpoint
        if (event.data && event.data.startsWith('/mcp/messages/')) {
          this.dynamicEndpoint = event.data;
          console.error(`Updated dynamic endpoint from text for ${this.name}: ${this.dynamicEndpoint}`);
        } else {
          console.error(`Failed to parse SSE message from ${this.name}:`, event.data);
        }
      }
    };

    // Connection error
    this.sseEventSource.onerror = (event: any) => {
      console.error(`SSE connection error for ${this.name}:`, event);
      
      if (reject) {
        reject(new Error(`SSE connection failed for ${this.name}`));
        reject = undefined;
      } else if (this.isConnected && !this.isReconnecting) {
        // Connection lost, try to reconnect
        this.handleSSEDisconnection();
      }
    };

    // Listen for MCP response messages
    this.sseEventSource.addEventListener('mcp-response', (event: any) => {
      try {
        const response = JSON.parse(event.data);
        this.handleMCPResponse(response);
      } catch (error) {
        console.error(`Failed to parse MCP response from ${this.name}:`, event.data);
      }
    });

    // Listen for MCP notifications
    this.sseEventSource.addEventListener('mcp-notification', (event: any) => {
      try {
        const notification = JSON.parse(event.data);
        this.handleMCPNotification(notification);
      } catch (error) {
        console.error(`Failed to parse MCP notification from ${this.name}:`, event.data);
      }
    });

    // Listen for endpoint events
    this.sseEventSource.addEventListener('endpoint', (event: any) => {
      this.dynamicEndpoint = event.data;
      console.error(`Received endpoint event for ${this.name}: ${this.dynamicEndpoint}`);
      
      // Extract sessionId (if exists)
      this.extractSessionId();
    });
  }

  private extractSessionId(): void {
    if (!this.dynamicEndpoint) {
      return;
    }

    try {
      // Extract sessionId from URL query parameters
      const url = new URL(this.dynamicEndpoint, this.baseUrl);
      const urlSessionId = url.searchParams.get('sessionId');
      
      if (urlSessionId) {
        this.sessionId = urlSessionId;
        console.error(`Extracted sessionId from URL for ${this.name}: ${this.sessionId}`);
        return;
      }

      // Extract sessionId from path (e.g., /mcp/messages/session-id-here)
      const pathMatch = this.dynamicEndpoint.match(/\/mcp\/messages\/([^/?]+)/);
      if (pathMatch && pathMatch[1]) {
        this.sessionId = pathMatch[1];
        console.error(`Extracted sessionId from path for ${this.name}: ${this.sessionId}`);
        return;
      }

      // If sessionMode is required but no sessionId found, log warning
      if (this.sessionMode === 'required' && !this.sessionId) {
        console.error(`Warning: Session mode is required but no sessionId found in endpoint: ${this.dynamicEndpoint}`);
      }

    } catch (error) {
      console.error(`Failed to extract sessionId from endpoint ${this.dynamicEndpoint}:`, error);
    }
  }

  private async initialize(): Promise<void> {
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'mcpdog',
          version: '2.0.0'
        }
      }
    };

    const response = await this.sendRequest(initRequest);

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Send initialized notification
    await this.sendNotification({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });
  }


  async getTools(): Promise<MCPTool[]> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Failed to get tools: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  async callTool(name: string, args: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    return this.sendRequest(request);
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    // Allow sending initialize request during connection process
    if (!this.isConnected && !this.sseEventSource) {
      throw new Error(`Not connected to ${this.name}`);
    }

    return new Promise<MCPResponse>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for ${this.name}`));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout
      });

      try {
        // Use dynamic endpoint or fall back to default endpoint
        let endpoint = this.dynamicEndpoint || '/mcp';
        console.error(`Sending request to ${this.name} via: ${endpoint}`);
        
        // If dynamic endpoint and relative path, need to construct full URL
        if (this.dynamicEndpoint && this.dynamicEndpoint.startsWith('/')) {
          const url = new URL(this.dynamicEndpoint, this.baseUrl);
          endpoint = url.pathname + url.search;
        }
        
        // Prepare request headers, including session info (if any)
        const requestHeaders: Record<string, string> = {};
        if (this.sessionId && this.sessionMode !== 'disabled') {
          requestHeaders['Mcp-Session-Id'] = this.sessionId;
          console.error(`Adding session header for ${this.name}: Mcp-Session-Id=${this.sessionId}`);
        }
        
        // Send request via HTTP POST
        const response = await this.httpClient.post(endpoint, request, {
          headers: requestHeaders
        });
        
        // Handle synchronous response
        if (response.data && response.data.id === request.id) {
          const pending = this.pendingRequests.get(request.id);
          if (pending) {
            this.pendingRequests.delete(request.id);
            clearTimeout(pending.timeout);
            pending.resolve(response.data as MCPResponse);
          }
        }
      } catch (error) {
        this.pendingRequests.delete(request.id);
        clearTimeout(timeout);
        
        // Check for session-related errors
        if ((error as any).response?.status === 404 && this.sessionId) {
          console.error(`Session expired for ${this.name}, sessionId: ${this.sessionId}`);
          // Clear expired sessionId, trigger reconnect to get new session
          this.sessionId = undefined;
          this.handleSSEDisconnection();
        }
        
        reject(new Error(`Failed to send request to ${this.name}: ${(error as Error).message}`));
      }
    });
  }

  private async sendNotification(notification: any): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      // Use dynamic endpoint or fall back to default endpoint
      let endpoint = this.dynamicEndpoint || '/mcp';
      
      // Prepare request headers, including session info (if any)
      const requestHeaders: Record<string, string> = {};
      if (this.sessionId && this.sessionMode !== 'disabled') {
        requestHeaders['Mcp-Session-Id'] = this.sessionId;
      }
      
      await this.httpClient.post(endpoint, notification, {
        headers: requestHeaders
      });
    } catch (error) {
      console.error(`Failed to send notification to ${this.name}:`, error);
    }
  }

  private getNextRequestId(): number {
    return this.requestId++;
  }

  private handleSSEMessage(message: any): void {
    // Handle generic SSE message
    console.error(`Received SSE message from ${this.name}:`, message);
    
    // Check if it's an endpoint message
    if (message.endpoint) {
      this.dynamicEndpoint = message.endpoint;
      console.error(`Updated dynamic endpoint for ${this.name}: ${this.dynamicEndpoint}`);
    }
  }

  private handleMCPResponse(response: MCPResponse): void {
    // Handle MCP response
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      clearTimeout(pending.timeout);
      pending.resolve(response);
    } else {
      console.warn(`Received response for unknown request ID: ${response.id}`);
    }
  }

  private handleMCPNotification(notification: any): void {
    console.error(`Received MCP notification from ${this.name}:`, notification.method);
    
    if (notification.method === 'notifications/tools/list_changed') {
      // Tool list changed, notify router for unified handling
      this.emit('tools-changed', { serverName: this.name });
    }
    
    // Forward notification to upper layer
    this.emit('notification', { serverName: this.name, notification });
  }

  private handleSSEDisconnection(): void {
    if (this.isReconnecting) {
      return;
    }

    // If server is disabled, should not auto-reconnect
    if (this.isDisabled) {
      console.error(`❌ ${this.name} is disabled, no auto-reconnect`);
      this.isConnected = false;
      this.emit('disconnected', { 
        serverName: this.name,
        error: new Error('SSE connection lost - server disabled')
      });
      return;
    }

    this.isConnected = false;
    this.isReconnecting = true;
    
    console.error(`SSE connection lost for ${this.name}, attempting reconnection...`);
    this.emit('disconnected', { 
      serverName: this.name,
      error: new Error('SSE connection lost')
    });

    // Start reconnect timer
    const reconnectInterval = this.config.sseReconnectInterval || 5000;
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnection();
    }, reconnectInterval);
  }

  private async attemptReconnection(): Promise<void> {
    if (!this.isReconnecting) {
      return;
    }

    try {
      console.error(`Attempting to reconnect ${this.name}...`);
      
      // Clean up old connection
      this.cleanup();
      
      // Reconnect
      await this.connect();
      
      this.isReconnecting = false;
      console.error(`Successfully reconnected ${this.name}`);
      
    } catch (error) {
      console.error(`Reconnection failed for ${this.name}:`, (error as Error).message);
      
      // Continue trying to reconnect
      const reconnectInterval = this.config.sseReconnectInterval || 5000;
      this.reconnectTimer = setTimeout(() => {
        this.attemptReconnection();
      }, reconnectInterval * 2); // Exponential backoff
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = undefined;
    }
  }

  // Get current tool list (fetch in real-time from server)
  async getCachedTools(): Promise<MCPTool[]> {
    if (!this.isConnected) return [];
    return await this.getTools();
  }

  // Check if specific tool is available (check in real-time from server)
  async hasTools(toolName: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const tools = await this.getTools();
    return tools.some(tool => tool.name === toolName);
  }

  // Get connection status information
  getStatus(): {
    name: string;
    connected: boolean;
    toolCount: number;
    pendingRequests: number;
    endpoint: string;
  } {
    return {
      name: this.name,
      connected: this.isConnected,
      toolCount: 0, // Tool count managed by router
      pendingRequests: this.pendingRequests.size,
      endpoint: this.baseUrl
    };
  }

  // Disable adapter, prevent auto-reconnect
  disable(): void {
    console.error(`🚫 Disabling ${this.name} - no auto-reconnect`);
    this.isDisabled = true;
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.isReconnecting = false;
  }

  // Re-enable adapter, allow auto-reconnect
  enable(): void {
    console.error(`✅ Enabling ${this.name} - auto-reconnect allowed`);
    this.isDisabled = false;
  }
}