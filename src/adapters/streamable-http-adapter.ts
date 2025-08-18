import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { MCPServerConfig, MCPTool, MCPRequest, MCPResponse, ServerAdapter } from '../types/index.js';

export class StreamableHttpAdapter extends EventEmitter implements ServerAdapter {
  public readonly name: string;
  public readonly config: MCPServerConfig;
  public isConnected: boolean = false;

  private httpClient: AxiosInstance;
  private requestId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private endpoint: string;
  private endpointPath: string = '/'; // Path part of the endpoint URL
  private sessionId?: string; // MCP Session ID (optional)
  private sessionMode: 'auto' | 'required' | 'disabled' = 'auto';

  constructor(name: string, config: MCPServerConfig) {
    super();
    this.name = name;
    this.config = config;

    if (config.transport !== 'streamable-http') {
      throw new Error(`Invalid transport for StreamableHttpAdapter: ${config.transport}`);
    }

    const httpUrl = config.url || config.endpoint;
    if (!httpUrl) {
      throw new Error('URL or endpoint is required for streamable-http transport');
    }

    this.endpoint = httpUrl;
    
    // Set session mode
    this.sessionMode = (config as any).sessionMode || 'auto';

    // Parse URL to separate base and path
    const url = new URL(httpUrl);
    const baseURL = `${url.protocol}//${url.host}`;
    const endpointPath = url.pathname + url.search + url.hash;

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'User-Agent': 'MCPDog/2.0.1-StreamableHTTP',
        ...(config.headers || {}),
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    // Store the endpoint path for requests
    this.endpointPath = endpointPath;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      console.error(`Connecting to ${this.name} via Streamable HTTP: ${this.endpoint}`);

      // 1. Initialize handshake
      await this.initialize();

      // Mark as connected, let router manage tool list fetching
      this.isConnected = true;
      console.error(`Connected to ${this.name}`);
      this.emit('connected', { serverName: this.name });

    } catch (error) {
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

    this.isConnected = false;
    console.error(`Disconnected from ${this.name}`);
    this.emit('disconnected', { serverName: this.name });
  }

  private async initialize(): Promise<void> {
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        clientInfo: {
          name: 'MCPClient',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(initRequest);

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Check for session ID (get from extended properties)
    if ((response as any).sessionId) {
      this.sessionId = (response as any).sessionId;
      console.error(`Received session ID for ${this.name}: ${this.sessionId}`);
    }

    // Send initialized notification (some servers like GitHub Copilot may not support this)
    try {
      await this.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
      console.error(`Sent initialized notification to ${this.name}`);
    } catch (error) {
      console.warn(`Failed to send initialized notification to ${this.name} (this is normal for some servers like GitHub Copilot):`, (error as Error).message);
      // Don't throw error - some servers don't support this notification
    }
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
    if (!this.isConnected && request.method !== 'initialize') {
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
        console.error(`Sending request to ${this.name}: ${request.method}`);
        
        // Prepare request headers, including session info (if any)
        const requestHeaders: Record<string, string> = {};
        if (this.sessionId && this.sessionMode !== 'disabled') {
          requestHeaders['Mcp-Session-Id'] = this.sessionId;
        }
        
        // Send HTTP POST request to the correct endpoint path
        const response = await this.httpClient.post(this.endpointPath, request, {
          headers: requestHeaders,
          responseType: 'text' // Receive raw text to handle SSE
        });
        
        // Handle response
        await this.handleResponse(response, request.id);
        
      } catch (error) {
        this.pendingRequests.delete(request.id);
        clearTimeout(timeout);
        
        // Check for session-related errors
        if ((error as any).response?.status === 404 && this.sessionId) {
          console.error(`Session expired for ${this.name}, sessionId: ${this.sessionId}`);
          this.sessionId = undefined;
        }
        
        reject(new Error(`Failed to send request to ${this.name}: ${(error as Error).message}`));
      }
    });
  }

  private async handleResponse(response: any, requestId: string | number): Promise<void> {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    try {
      // Extract session ID from response headers (for GitHub Copilot and similar servers)
      const sessionId = response.headers['mcp-session-id'];
      if (sessionId) {
        this.sessionId = sessionId;
        console.error(`Extracted session ID from response headers for ${this.name}: ${this.sessionId}`);
      }

      const contentType = response.headers['content-type'] || '';
      
      if (contentType.includes('text/event-stream')) {
        // Handle SSE streaming response
        await this.handleSSEResponse(response.data, requestId);
      } else if (contentType.includes('application/json')) {
        // Handle single JSON response
        const jsonResponse = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data;
        
        this.handleJSONResponse(jsonResponse, requestId);
      } else {
        throw new Error(`Unsupported response content type: ${contentType}`);
      }
    } catch (error) {
      pending.reject(new Error(`Failed to handle response: ${(error as Error).message}`));
      this.pendingRequests.delete(requestId);
      clearTimeout(pending.timeout);
    }
  }

  private async handleSSEResponse(sseData: string, requestId: string | number): Promise<void> {
    const lines = sseData.split('\n');
    let eventType = 'message';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.substring(5).trim();
        
        if (eventType === 'message' && data) {
          try {
            const message = JSON.parse(data);
            
            // Check for session ID
            if ((message as any).sessionId) {
              this.sessionId = (message as any).sessionId;
              console.error(`Updated session ID for ${this.name}: ${this.sessionId}`);
            }
            
            // Handle MCP response
            if (message.id === requestId) {
              this.handleJSONResponse(message, requestId);
            } else if (message.method) {
              // Handle server-pushed notifications
              this.handleServerNotification(message);
            }
          } catch (error) {
            console.error(`Failed to parse SSE data from ${this.name}:`, data);
          }
        }
      }
    }
  }

  private handleJSONResponse(message: MCPResponse, requestId: string | number): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      clearTimeout(pending.timeout);
      
      // Check session ID in response headers
      if ((message as any).sessionId) {
        this.sessionId = (message as any).sessionId;
        console.error(`Updated session ID from response for ${this.name}: ${this.sessionId}`);
      }
      
      pending.resolve(message);
    }
  }

  private handleServerNotification(notification: any): void {
    console.error(`Received server notification from ${this.name}:`, notification.method);
    
    if (notification.method === 'notifications/tools/list_changed') {
      // Tool list changed, notify router for unified handling  
      this.emit('tools-changed', { serverName: this.name });
    }
    
    // Forward notification to upper layer
    this.emit('notification', { serverName: this.name, notification });
  }

  private async sendNotification(notification: any): Promise<void> {
    if (!this.isConnected && notification.method !== 'notifications/initialized') {
      return;
    }

    try {
      // Prepare request headers, including session info (if any)
      const requestHeaders: Record<string, string> = {};
      if (this.sessionId && this.sessionMode !== 'disabled') {
        requestHeaders['Mcp-Session-Id'] = this.sessionId;
      }
      
      await this.httpClient.post(this.endpointPath, notification, {
        headers: requestHeaders
      });
    } catch (error) {
      console.error(`Failed to send notification to ${this.name}:`, error);
    }
  }

  private getNextRequestId(): number {
    return this.requestId++;
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
    sessionId?: string;
  } {
    return {
      name: this.name,
      connected: this.isConnected,
              toolCount: 0, // Tool count managed by router
      pendingRequests: this.pendingRequests.size,
      endpoint: this.endpoint,
      sessionId: this.sessionId
    };
  }
}