import { createInterface } from 'readline';
import { MCPDogServer } from './core/mcpdog-server.js';
import { MCPDogConfig, MCPMessage, MCPNotification, MCPNotificationRequest, MCPResponse, MCPRequest } from './types/index.js';
import { ConfigManager } from './config/config-manager.js';
import { StreamableHttpMCPServer } from './streamable-http-server.js';

export class StdioMCPServer {
  private server: MCPDogServer;
  private readline: any;
  private processedRequests: Set<string> = new Set(); // Prevent duplicate processing
  private sentResponses: Set<string> = new Set(); // Prevent duplicate responses
  private lastProcessedLine: string = ''; // Prevent duplicate line processing

  constructor(configManager: ConfigManager) {
    console.error(`[STDIO] Creating StdioMCPServer instance`);
    this.server = new MCPDogServer(configManager);
    this.setupServer();
    this.setupStdio();
  }

  private setupServer(): void {
    this.server.on('notification', (notification: MCPNotification) => {
      this.sendMessage(notification);
    });

    this.server.on('error', ({ error, context }) => {
      console.error(`MCPDog error [${context}]:`, error);
    });

    this.server.on('started', () => {
      console.error('MCPDog Server started (stdio mode)');
    });

    this.server.on('stopped', () => {
      console.error('MCPDog Server stopped');
    });
  }

  private setupStdio(): void {
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      crlfDelay: Infinity
    });

    this.readline.on('line', (line: string) => {
      console.error(`[STDIO] Received line: ${line.substring(0, 50)}...`);
      this.handleInput(line.trim());
    });

    this.readline.on('close', () => {
      this.shutdown();
    });

    // Handle process signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });
  }

  private async handleInput(line: string): Promise<void> {
    console.error(`[STDIO] handleInput called with: ${line.substring(0, 30)}...`);
    
    if (!line) {
      return;
    }
    
    // Prevent processing duplicate lines
    if (line === this.lastProcessedLine) {
      console.error(`[DEDUP] Ignoring duplicate line processing`);
      return;
    }
    this.lastProcessedLine = line;

    try {
      const message = JSON.parse(line) as MCPMessage;
      
      // Check if it's a notification message (no id field)
      if (!('id' in message)) {
        const notification = message as MCPNotificationRequest;
        console.error(`Handling notification: ${notification.method}`);
        // Notifications don't need responses
        return;
      }
      
      // Handle regular requests
      const request = message as MCPRequest;
      
      // Generate unique request identifier to prevent duplicate processing (based on method and ID, no timestamp)
      const requestKey = `${request.method}_${request.id}`;
      
      // Check if the same request has already been processed
      if (this.processedRequests.has(requestKey)) {
        console.error(`Duplicate request detected, skipping: ${request.method} (id: ${request.id})`);
        return;
      }
      
      // Record request to prevent duplicates
      this.processedRequests.add(requestKey);
      
      // Clean up old request records (keep latest 500)
      if (this.processedRequests.size > 500) {
        const entries = Array.from(this.processedRequests);
        entries.slice(0, 250).forEach(key => this.processedRequests.delete(key));
      }
      
      console.error(`Processing request: ${request.method} (id: ${request.id})`);
      const response = await this.server.handleRequest(request, 'stdio-client');
      console.error(`Sending response for: ${request.method} (id: ${request.id})`);
      this.sendMessage(response);
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (errorMessage === 'DUPLICATE_REQUEST_IGNORED') {
        console.error(`[DEDUP] Ignoring duplicate request processing at STDIO level`);
        // Don't send any response
        return;
      }
      console.error('Error processing request:', error);
      // Don't send error response, only log error
    }
  }

  private sendMessage(message: MCPResponse | MCPNotification): void {
    // For response messages, check if already sent
    if ('id' in message && typeof message.id !== 'undefined') {
      const responseKey = `response_${message.id}`;
      
      if (this.sentResponses.has(responseKey)) {
        console.error(`Duplicate response detected, skipping: id ${message.id}`);
        return;
      }
      
      this.sentResponses.add(responseKey);
      
      // Clean up old response records
      if (this.sentResponses.size > 200) {
        const entries = Array.from(this.sentResponses);
        entries.slice(0, 100).forEach(key => this.sentResponses.delete(key));
      }
    }
    
    const messageStr = JSON.stringify(message);
    console.log(messageStr);
  }

  async start(): Promise<void> {
    try {
      console.error(`[STDIO] Starting StdioMCPServer...`);
      await this.server.start();
      console.error(`[STDIO] StdioMCPServer started successfully`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.error('Shutting down MCPDog Server...');
    
    try {
      if (this.readline) {
        this.readline.close();
      }
      
      await this.server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArgs(): { configPath?: string; webPort?: number; transport?: string; port?: number } {
  const args = process.argv.slice(2);
  const result: { configPath?: string; webPort?: number; transport?: string; port?: number } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--config' || arg === '-c') {
      result.configPath = args[i + 1];
      i++;
    } else if (arg === '--web-port') {
      result.webPort = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--transport' || arg === '-t') {
      result.transport = args[i + 1];
      i++;
    } else if (arg === '--port' || arg === '-p') {
      result.port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
MCPDog - Universal MCP Server Manager

Usage: mcpdog [options]

Options:
  -c, --config <path>     Configuration file path (default: ./mcpdog.config.json)
  -t, --transport <type>  Transport protocol: stdio (default) or streamable-http
  -p, --port <port>       Port for HTTP transport (default: 3001)
  --web-port <port>       Enable web interface on port (experimental)
  -h, --help              Show this help message

Examples:
  mcpdog                                    # Start with stdio transport
  mcpdog --transport streamable-http        # Start with HTTP transport on default port
  mcpdog --transport streamable-http --port 8080  # Start with HTTP transport on port 8080
  mcpdog --config ./my-config.json         # Use custom config file
  mcpdog --web-port 3000                   # Enable web interface (not yet implemented)

Transport Types:
  stdio           - Standard input/output (default, for MCP clients like Claude Desktop)
  streamable-http - HTTP-based transport with optional Server-Sent Events

For more information, visit: https://github.com/kinhunt/mcpdog
      `);
      process.exit(0);
    }
  }

  return result;
}

// Main program entry point
async function main(): Promise<void> {
  const { configPath, webPort, transport, port } = parseArgs();

  if (webPort) {
    console.error('Web interface not yet implemented');
    process.exit(1);
  }

  const configManager = new ConfigManager(configPath);
  await configManager.loadConfig(); // Load config before passing to server

  // Choose transport type
  const transportType = transport || 'stdio';
  
  if (transportType === 'streamable-http') {
    const httpPort = port || 3001;
    const httpServer = new StreamableHttpMCPServer(configManager, httpPort);
    await httpServer.start();
  } else if (transportType === 'stdio') {
    const mcpServer = new StdioMCPServer(configManager);
    await mcpServer.start();
  } else {
    console.error(`Unknown transport type: ${transportType}`);
    console.error('Supported transports: stdio, streamable-http');
    process.exit(1);
  }
}

// Only start server when this file is run directly, not when imported
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}