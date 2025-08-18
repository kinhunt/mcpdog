import { createServer, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { MCPDogServer } from './core/mcpdog-server.js';
import { MCPMessage, MCPNotification, MCPNotificationRequest, MCPResponse, MCPRequest } from './types/index.js';
import { ConfigManager } from './config/config-manager.js';
import { createAuthMiddleware } from './middleware/auth.js';

export class StreamableHttpMCPServer extends EventEmitter {
  private server: MCPDogServer;
  private httpServer: any;
  private port: number;
  private authToken?: string;
  private authMiddleware?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  private sessions: Map<string, {
    id: string;
    clientId: string;
    created: Date;
    lastActivity: Date;
  }> = new Map();
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor(configManager: ConfigManager, port: number = 4000, authToken?: string) {
    super();
    console.error(`[HTTP] Creating StreamableHttpMCPServer instance on port ${port}${authToken ? ' with authentication' : ''}`);
    this.port = port;
    this.authToken = authToken;
    this.server = new MCPDogServer(configManager);
    
    // Setup auth middleware if token is provided
    if (this.authToken) {
      this.authMiddleware = createAuthMiddleware(this.authToken);
    }
    
    this.setupServer();
    this.setupHttpServer();
  }

  private setupServer(): void {
    this.server.on('notification', (notification: MCPNotification) => {
      // HTTP mode doesn't push notifications like stdio, they're request-response based
      console.error(`[HTTP] Received notification: ${notification.method}`);
    });

    this.server.on('error', ({ error, context }) => {
      console.error(`MCPDog error [${context}]:`, error);
    });

    this.server.on('started', () => {
      console.error('MCPDog Server started (HTTP streamable mode)');
    });

    this.server.on('stopped', () => {
      console.error('MCPDog Server stopped');
    });
  }

  private setupHttpServer(): void {
    this.httpServer = createServer();

    // Enable CORS for web-based MCP clients
    this.httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Apply authentication middleware if configured
      if (this.authMiddleware) {
        this.authMiddleware(req, res, () => {
          this.handleAuthenticatedRequest(req, res);
        });
      } else {
        this.handleAuthenticatedRequest(req, res);
      }
    });

    this.httpServer.on('error', (error: Error) => {
      console.error('HTTP server error:', error);
    });

    // Handle process signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });
  }

  private handleAuthenticatedRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method === 'POST') {
      this.handleHttpRequest(req, res);
    } else if (req.method === 'GET') {
      this.handleHealthCheck(req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  }

  private handleHealthCheck(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'mcpdog-streamable-http',
      version: '2.0.15',
      timestamp: new Date().toISOString()
    }));
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        console.error(`[HTTP] Received request: ${body.substring(0, 100)}...`);
        
        if (!body.trim()) {
          this.sendErrorResponse(res, 400, 'Empty request body');
          return;
        }

        const message = JSON.parse(body) as MCPMessage;
        
        // Extract session ID from headers
        const sessionId = req.headers['mcp-session-id'] as string;
        
        // Check if it's a notification message (no id field)
        if (!('id' in message)) {
          const notification = message as MCPNotificationRequest;
          console.error(`[HTTP] Handling notification: ${notification.method}`);
          
          // Validate session for non-initialize notifications
          if (sessionId && !this.validateSession(sessionId)) {
            this.sendErrorResponse(res, 401, 'Invalid or expired session');
            return;
          }
          
          // Notifications get 204 No Content response
          res.writeHead(204);
          res.end();
          return;
        }

        // Handle regular requests
        const request = message as MCPRequest;

        console.error(`[HTTP] Processing request: ${request.method} (id: ${request.id})`);
        
        // Handle initialize request - create new session
        if (request.method === 'initialize') {
          const response = await this.server.handleRequest(request, 'http-client');
          
          if (!response.error) {
            // Create new session
            const newSessionId = this.createSession(req.socket?.remoteAddress || 'unknown');
            console.error(`[HTTP] Created new session: ${newSessionId}`);
            
            // Add session ID to response headers
            res.setHeader('mcp-session-id', newSessionId);
            
            this.sendMCPResponse(res, response);
          } else {
            this.sendMCPResponse(res, response);
          }
          return;
        }
        
        // For non-initialize requests, validate session
        if (!sessionId) {
          this.sendErrorResponse(res, 400, 'Missing mcp-session-id header');
          return;
        }
        
        if (!this.validateSession(sessionId)) {
          this.sendErrorResponse(res, 401, 'Invalid or expired session');
          return;
        }
        
        // Update session activity
        this.updateSessionActivity(sessionId);
        
        const response = await this.server.handleRequest(request, sessionId);
        console.error(`[HTTP] Sending response for: ${request.method} (id: ${request.id})`);
        
        this.sendMCPResponse(res, response);

      } catch (error) {
        console.error('[HTTP] Error processing request:', error);
        this.sendErrorResponse(res, 500, 'Internal server error');
      }
    });

    req.on('error', (error) => {
      console.error('[HTTP] Request error:', error);
      this.sendErrorResponse(res, 400, 'Bad request');
    });
  }

  private sendMCPResponse(res: ServerResponse, response: MCPResponse): void {

    const responseBody = JSON.stringify(response);
    
    // Check if this could be a streaming response (for future SSE support)
    const isStreamingRequest = this.shouldUseStreaming(response);
    
    if (isStreamingRequest) {
      // Send as Server-Sent Events for streaming responses
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      res.write(`event: message\n`);
      res.write(`data: ${responseBody}\n\n`);
      res.end();
    } else {
      // Send as regular JSON response
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(responseBody);
    }
  }

  private shouldUseStreaming(response: MCPResponse): boolean {
    // For now, always use JSON responses
    // In the future, we could detect streaming scenarios (e.g., tool calls that take time)
    return false;
  }

  private sendErrorResponse(res: ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: statusCode,
        message: message
      }
    }));
  }

  private createSession(clientId: string): string {
    const sessionId = randomUUID();
    const now = new Date();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      clientId: clientId,
      created: now,
      lastActivity: now
    });
    
    return sessionId;
  }
  
  private validateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Check if session has expired
    const now = new Date();
    if (now.getTime() - session.lastActivity.getTime() > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    return true;
  }
  
  private updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }
  
  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivity.getTime() > this.sessionTimeout) {
        console.error(`[HTTP] Cleaning up expired session: ${sessionId}`);
        this.sessions.delete(sessionId);
      }
    }
  }

  async start(): Promise<void> {
    try {
      console.error(`[HTTP] Starting StreamableHttpMCPServer...`);
      await this.server.start();
      
      // Start session cleanup timer
      const cleanupInterval = setInterval(() => {
        this.cleanupExpiredSessions();
      }, 5 * 60 * 1000); // Clean up every 5 minutes
      
      // Store cleanup interval for shutdown
      (this as any).cleanupInterval = cleanupInterval;
      
      return new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.error(`[HTTP] StreamableHttpMCPServer started successfully on port ${this.port}`);
            console.error(`[HTTP] Health check endpoint: http://localhost:${this.port}/`);
            console.error(`[HTTP] MCP endpoint: POST http://localhost:${this.port}/`);
            console.error(`[HTTP] Session management enabled with ${this.sessionTimeout / 1000}s timeout`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Failed to start HTTP server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.error('Shutting down StreamableHttpMCPServer...');
    
    try {
      // Clean up session cleanup timer
      if ((this as any).cleanupInterval) {
        clearInterval((this as any).cleanupInterval);
      }
      
      // Clear all sessions
      this.sessions.clear();
      
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer.close(() => {
            console.error('HTTP server closed');
            resolve();
          });
        });
      }
      
      await this.server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}