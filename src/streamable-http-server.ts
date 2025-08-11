import { createServer, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { MCPDogServer } from './core/mcpdog-server.js';
import { MCPMessage, MCPNotification, MCPNotificationRequest, MCPResponse, MCPRequest } from './types/index.js';
import { ConfigManager } from './config/config-manager.js';

export class StreamableHttpMCPServer extends EventEmitter {
  private server: MCPDogServer;
  private httpServer: any;
  private port: number;
  private processedRequests: Set<string> = new Set();
  private sentResponses: Set<string> = new Set();

  constructor(configManager: ConfigManager, port: number = 4000) {
    super();
    console.error(`[HTTP] Creating StreamableHttpMCPServer instance on port ${port}`);
    this.port = port;
    this.server = new MCPDogServer(configManager);
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST') {
        this.handleHttpRequest(req, res);
      } else if (req.method === 'GET') {
        this.handleHealthCheck(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
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
        
        // Check if it's a notification message (no id field)
        if (!('id' in message)) {
          const notification = message as MCPNotificationRequest;
          console.error(`[HTTP] Handling notification: ${notification.method}`);
          // Notifications get 204 No Content response
          res.writeHead(204);
          res.end();
          return;
        }

        // Handle regular requests
        const request = message as MCPRequest;
        
        // Generate unique request identifier
        const requestKey = `${request.method}_${request.id}`;
        
        // Check for duplicate requests
        if (this.processedRequests.has(requestKey)) {
          console.error(`[HTTP] Duplicate request detected, skipping: ${request.method} (id: ${request.id})`);
          return;
        }
        
        // Record request to prevent duplicates
        this.processedRequests.add(requestKey);
        
        // Clean up old request records (keep latest 500)
        if (this.processedRequests.size > 500) {
          const entries = Array.from(this.processedRequests);
          entries.slice(0, 250).forEach(key => this.processedRequests.delete(key));
        }

        console.error(`[HTTP] Processing request: ${request.method} (id: ${request.id})`);
        const response = await this.server.handleRequest(request, 'http-client');
        console.error(`[HTTP] Sending response for: ${request.method} (id: ${request.id})`);
        
        this.sendMCPResponse(res, response);

      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage === 'DUPLICATE_REQUEST_IGNORED') {
          console.error(`[HTTP] Ignoring duplicate request processing`);
          return;
        }
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
    // Check for duplicate responses
    if ('id' in response && typeof response.id !== 'undefined') {
      const responseKey = `response_${response.id}`;
      
      if (this.sentResponses.has(responseKey)) {
        console.error(`[HTTP] Duplicate response detected, skipping: id ${response.id}`);
        return;
      }
      
      this.sentResponses.add(responseKey);
      
      // Clean up old response records
      if (this.sentResponses.size > 200) {
        const entries = Array.from(this.sentResponses);
        entries.slice(0, 100).forEach(key => this.sentResponses.delete(key));
      }
    }

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

  async start(): Promise<void> {
    try {
      console.error(`[HTTP] Starting StreamableHttpMCPServer...`);
      await this.server.start();
      
      return new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.error(`[HTTP] StreamableHttpMCPServer started successfully on port ${this.port}`);
            console.error(`[HTTP] Health check endpoint: http://localhost:${this.port}/`);
            console.error(`[HTTP] MCP endpoint: POST http://localhost:${this.port}/`);
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