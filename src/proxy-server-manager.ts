import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig } from './mcp-registry.js';

interface ActiveServer {
  process: ChildProcess;
  config: MCPServerConfig;
  isReady: boolean;
  tools: any[];
}

export class ProxyServerManager {
  private activeServers: Map<string, ActiveServer> = new Map();
  private serverTimeout = 30000; // 30 second timeout

  async ensureServerRunning(serverName: string, config: MCPServerConfig): Promise<boolean> {
    // If server is already running
    if (this.activeServers.has(serverName)) {
      const server = this.activeServers.get(serverName)!;
      if (server.isReady) {
        return true;
      }
    }

    console.log(`[MCPDog] Starting ${serverName} server...`);
    
    try {
      const serverProcess = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const activeServer: ActiveServer = {
        process: serverProcess,
        config,
        isReady: false,
        tools: []
      };

      this.activeServers.set(serverName, activeServer);

      // Listen to server output, wait for server to be ready
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`[MCPDog] ${serverName} server startup timeout`);
          this.stopServer(serverName);
          reject(new Error(`Server ${serverName} startup timeout`));
        }, this.serverTimeout);

        let initMessages = '';

        serverProcess.stdout?.on('data', (data) => {
          const message = data.toString();
          initMessages += message;
          
          // Simple readiness detection - consider server started when any output is received
          if (!activeServer.isReady) {
            activeServer.isReady = true;
            clearTimeout(timeout);
            console.log(`[MCPDog] ${serverName} server is ready`);
            resolve(true);
          }
        });

        serverProcess.stderr?.on('data', (data) => {
          console.error(`[MCPDog] ${serverName} error:`, data.toString());
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`[MCPDog] ${serverName} startup failed:`, error);
          this.stopServer(serverName);
          reject(error);
        });

        serverProcess.on('exit', (code) => {
          console.log(`[MCPDog] ${serverName} server exited with code: ${code}`);
          this.activeServers.delete(serverName);
        });

        // Send initial handshake request
        const handshakeRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {
              roots: {
                listChanged: true
              }
            },
            clientInfo: {
              name: "mcpdog-proxy",
              version: "2.0.0"
            }
          }
        };

        serverProcess.stdin?.write(JSON.stringify(handshakeRequest) + '\n');
      });

    } catch (error) {
      console.error(`[MCPDog] Failed to start ${serverName}:`, error);
      return false;
    }
  }

  async callTool(serverName: string, toolName: string, parameters: any): Promise<any> {
    const server = this.activeServers.get(serverName);
    if (!server || !server.isReady) {
      throw new Error(`Server ${serverName} is not ready`);
    }

    return new Promise((resolve, reject) => {
      const callId = Date.now();
      const toolCallRequest = {
        jsonrpc: "2.0",
        id: callId,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: parameters
        }
      };

      // Listen for response
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === callId) {
            server.process.stdout?.off('data', responseHandler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parsing errors, wait for correct response
        }
      };

      server.process.stdout?.on('data', responseHandler);

      // Send tool call request
      server.process.stdin?.write(JSON.stringify(toolCallRequest) + '\n');

      // Set timeout
      setTimeout(() => {
        server.process.stdout?.off('data', responseHandler);
        reject(new Error(`Tool call timeout for ${toolName}`));
      }, 10000);
    });
  }

  stopServer(serverName: string): void {
    const server = this.activeServers.get(serverName);
    if (server) {
      server.process.kill();
      this.activeServers.delete(serverName);
      console.log(`[MCPDog] ${serverName} server stopped`);
    }
  }

  stopAllServers(): void {
    for (const [serverName] of this.activeServers) {
      this.stopServer(serverName);
    }
  }

  getActiveServers(): string[] {
    return Array.from(this.activeServers.keys()).filter(name => 
      this.activeServers.get(name)?.isReady
    );
  }
}