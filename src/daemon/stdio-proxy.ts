/**
 * Stdio proxy - MCP client connecting to daemon
 * Acts as a bridge between MCP client and daemon
 */

import { createInterface } from 'readline';
import { DaemonClient } from './daemon-client.js';

export class StdioProxy {
  private daemonClient: DaemonClient;
  private readline: any;
  private isReady = false;

  constructor(daemonPort?: number) {
    this.daemonClient = new DaemonClient({
      port: daemonPort || 9999,
      clientType: 'stdio',
      reconnect: true,
      silent: true // Enable silent mode to avoid log pollution in stdio
    });

    this.setupStdio();
    this.setupDaemonClient();
  }

  private setupStdio() {
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      crlfDelay: Infinity
    });

    this.readline.on('line', (line: string) => {
      this.handleStdioInput(line.trim());
    });

    this.readline.on('close', () => {
      this.shutdown();
    });

    // Handle process signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private setupDaemonClient() {
    this.daemonClient.on('connected', () => {
      // Connection established but handshake not completed yet, don't set as ready for now
    });

    this.daemonClient.on('disconnected', () => {
      this.isReady = false;
    });

    this.daemonClient.on('error', (error) => {
      // Only output to stderr for serious errors
      if (!this.isReady) {
        process.stderr.write(`MCPDog connection error: ${error.message}\n`);
      }
    });

    this.daemonClient.on('welcome', (message) => {
      // Set as ready immediately after receiving welcome message, because daemon is running
      this.isReady = true;
    });

    this.daemonClient.on('ready', (serverStatus) => {
      // Handshake completed, ensure ready status
      this.isReady = true;
    });

    // Listen to daemon events, forward to MCP client
    this.daemonClient.on('server-started', () => {
      // Can send notifications to MCP client
    });

    this.daemonClient.on('routes-updated', (data) => {
      // Tool routes updated, may need to send notifications
    });
  }

  private async handleStdioInput(line: string) {
    if (!line) return;

    try {
      const request = JSON.parse(line);
      
      // Check if it's a notification message (no id field)
      if (!('id' in request)) {
        // Notification messages are temporarily ignored or forwarded to daemon
        return;
      }

      // If daemon connection is not ready yet, wait a bit
      if (!this.isReady) {
        // Give some time for connection to establish
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If still not ready, try to send request directly
      if (!this.isReady && !this.daemonClient.connected) {
        this.sendStdioResponse({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32603,
            message: "MCPDog daemon not connected"
          }
        });
        return;
      }

      // Forward MCP request to daemon (even if isReady is false, as long as connection exists)
      const response = await this.daemonClient.sendMCPRequest(request);
      
      // Send response back to stdio
      this.sendStdioResponse(response);
      
    } catch (error) {
      // Don't output error logs to stderr to avoid polluting MCP protocol
              // Send standard JSON-RPC error response
      try {
        const request = JSON.parse(line);
        if ('id' in request) {
          this.sendStdioResponse({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32700,
              message: "Parse error"
            }
          });
        }
      } catch {
        // Unable to parse request, ignore
      }
    }
  }

  private sendStdioResponse(response: any) {
    console.log(JSON.stringify(response));
  }

  async start(): Promise<void> {
    try {
      await this.daemonClient.connect();
      // After successful connection, start processing MCP requests
    } catch (error) {
      process.stderr.write(`MCPDog failed to connect to daemon: ${(error as Error).message}\n`);
      process.exit(1);
    }
  }

  private shutdown() {
    // Silent shutdown, no log output
    if (this.readline) {
      this.readline.close();
    }
    this.daemonClient.disconnect();
    process.exit(0);
  }
}