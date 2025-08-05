/**
 * Daemon-related commands
 */

import { CLIUtils } from '../cli-utils.js';
import { ConfigManager } from '../../config/config-manager.js';
import { MCPDogDaemon } from '../../daemon/mcpdog-daemon.js';
import { DaemonClient } from '../../daemon/daemon-client.js';
import fs from 'fs/promises';
import path from 'path';
import { createServer } from 'net';

export class DaemonCommands {
  private configManager: ConfigManager;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.listen(port, 'localhost', () => {
        server.close();
        resolve(true);
      });
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Find an available port starting from the given port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    while (!(await this.isPortAvailable(port))) {
      port++;
    }
    return port;
  }

  /**
   * Reserve a port by actually binding to it
   */
  private async reservePort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.listen(port, 'localhost', () => {
        // Keep the server running to reserve the port
        resolve(true);
      });
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  async start(args: string[], options: any): Promise<void> {
    const port = parseInt(options['daemon-port']) || 9999;
    let webPort = parseInt(options['web-port']);
    const pidFile = options['pid-file'] || path.join(process.cwd(), 'mcpdog.pid');
    
    try {
      // Check if daemon is already running
      const isRunning = await this.isDaemonRunning(pidFile);
      if (isRunning) {
        CLIUtils.error('Daemon is already running');
        process.exit(1);
      }

      // If web-port is not specified, default to starting web server with auto port detection
      if (!webPort) {
        webPort = await this.findAvailablePort(3000);
        CLIUtils.info(`Auto-detected available web port: ${webPort}`);
      }

      const daemon = new MCPDogDaemon({
        configPath: this.configManager.getConfigPath(),
        ipcPort: port,
        webPort,
        pidFile
      });

      // Set up signal handling
      process.on('SIGINT', async () => {
        CLIUtils.info('Received stop signal, shutting down daemon...');
        await daemon.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await daemon.stop();
        process.exit(0);
      });

      await daemon.start();

      // Always start web server now (default behavior)
      try {
        await daemon.startWebServer(webPort);
        CLIUtils.success(`Web interface started: http://localhost:${webPort}`);
      } catch (error) {
        // If the detected port is not available, try to find another one
        if ((error as Error).message.includes('EADDRINUSE')) {
          CLIUtils.warn(`Port ${webPort} is not available, trying to find another port...`);
          const newPort = await this.findAvailablePort(webPort + 1);
          await daemon.startWebServer(newPort);
          CLIUtils.success(`Web interface started: http://localhost:${newPort}`);
          webPort = newPort;
        } else {
          throw error;
        }
      }

      CLIUtils.success(`MCPDog daemon started (PID: ${process.pid})`);
      CLIUtils.info(`IPC port: ${port}`);
      CLIUtils.info(`Web interface: http://localhost:${webPort}`);
      CLIUtils.info(`Config file: ${this.configManager.getConfigPath()}`);
      CLIUtils.info('Press Ctrl+C to stop daemon');

      // Keep process running
      await new Promise(() => {});
      
    } catch (error) {
      CLIUtils.error('Failed to start daemon:', (error as Error).message);
      process.exit(1);
    }
  }

  async stop(args: string[], options: any): Promise<void> {
    const pidFile = options['pid-file'] || path.join(process.cwd(), 'mcpdog.pid');
    
    try {
      const pid = await this.getPidFromFile(pidFile);
      if (!pid) {
        CLIUtils.error('No running daemon found');
        process.exit(1);
      }

      // Send stop signal
      process.kill(pid, 'SIGTERM');
      
      // Wait for process to stop
      let attempts = 0;
      while (attempts < 30) {
        try {
          process.kill(pid, 0); // Check if process still exists
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        } catch (error) {
          // Process has stopped
          break;
        }
      }

      if (attempts >= 30) {
        CLIUtils.warn('Daemon did not stop within expected time, forcing termination...');
        process.kill(pid, 'SIGKILL');
      }

      // Clean up PID file
      try {
        await fs.unlink(pidFile);
      } catch (error) {
        // Ignore errors
      }

      CLIUtils.success('Daemon stopped');
      
    } catch (error) {
      CLIUtils.error('Failed to stop daemon:', (error as Error).message);
      process.exit(1);
    }
  }

  async status(args: string[], options: any): Promise<void> {
    const port = parseInt(options['daemon-port']) || 9999;
    
    try {
      const client = new DaemonClient({
        port,
        clientType: 'cli',
        reconnect: false,
        silent: true
      });

      await client.connect();
      
      client.on('status', (status) => {
        this.displayFriendlyStatus(status, port);
        client.disconnect();
        process.exit(0);
      });

      client.getStatus();
      
      // Timeout handling
      setTimeout(() => {
        console.log(`
❌ ${CLIUtils.colorize('Status check timeout', 'red')}

${CLIUtils.colorize('Possible issues:', 'yellow')}
  • Daemon not responding on port ${port}
  • Network connectivity issues
  • Daemon overloaded

${CLIUtils.colorize('Try:', 'cyan')}
  mcpdog start      # Start the daemon
  mcpdog stop       # Stop and restart
`);
        client.disconnect();
        process.exit(1);
      }, 5000);
      
    } catch (error) {
      this.displayConnectionError(error as Error, port);
    }
  }

  private displayFriendlyStatus(status: any, port: number): void {
    const daemon = status.daemon || {};
    const mcpServer = status.mcpServer || {};
    const servers = status.servers || [];

    console.log(`
✅ ${CLIUtils.colorize('MCPDog daemon is running', 'green')}

${CLIUtils.colorize('Daemon Info:', 'cyan')}
  🔌 IPC Port: ${port}
  ⏱️  Uptime: ${this.formatUptime(daemon.uptime || 0)}
  👥 Connected clients: ${daemon.clients?.length || 0}

${CLIUtils.colorize('MCP Server Status:', 'cyan')}
  🚀 Initialized: ${mcpServer.initialized ? '✅ Yes' : '❌ No'}
  🎯 Client: ${mcpServer.client?.clientName || 'Unknown'} v${mcpServer.client?.clientVersion || 'Unknown'}

${CLIUtils.colorize('MCP Servers:', 'cyan')}`);

    if (servers.length === 0) {
      console.log('  📭 No MCP servers configured');
    } else {
      servers.forEach((server: any) => {
        const status = server.connected ? '✅' : '❌';
        const toolCount = server.toolCount || 0;
        console.log(`  ${status} ${server.name} (${toolCount} tools)`);
      });
    }

    if (daemon.clients && daemon.clients.length > 0) {
      console.log(`\n${CLIUtils.colorize('Active Clients:', 'cyan')}`);
      daemon.clients.forEach((client: any) => {
        const lastSeen = new Date(client.lastSeen);
        const timeDiff = Math.round((Date.now() - lastSeen.getTime()) / 1000);
        console.log(`  📱 ${client.type} (last active: ${timeDiff}s ago)`);
      });
    }

    console.log(`
${CLIUtils.colorize('Management:', 'cyan')}
  🌐 Web interface: Check with 'mcpdog start --web-port 3000'
  🔄 Reload config: mcpdog daemon reload
  🛑 Stop daemon: mcpdog stop
`);
  }

  private displayConnectionError(error: Error, port: number): void {
    console.log(`
❌ ${CLIUtils.colorize('Cannot connect to MCPDog daemon', 'red')}

${CLIUtils.colorize('Connection Details:', 'yellow')}
  • Port: ${port}
  • Error: ${error.message}

${CLIUtils.colorize('Possible Solutions:', 'yellow')}
  1. Start the daemon:
     mcpdog start --config your-config.json

  2. Check if daemon is running:
     ps aux | grep mcpdog

  3. Check port conflicts:
     lsof -i :${port}

  4. Use different port:
     mcpdog status --daemon-port 9998

${CLIUtils.colorize('Quick Start:', 'cyan')}
  mcpdog start --config simple-config.json --web-port 3000
`);
    process.exit(1);
  }

  private formatUptime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.round(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  async reload(args: string[], options: any): Promise<void> {
    const port = parseInt(options['daemon-port']) || 9999;
    
    try {
      const client = new DaemonClient({
        port,
        clientType: 'cli',
        reconnect: false
      });

      await client.connect();
      
      client.reloadConfig();
              CLIUtils.success('Configuration reload request sent');
      
      setTimeout(() => {
        client.disconnect();
        process.exit(0);
      }, 1000);
      
    } catch (error) {
      CLIUtils.error('Failed to connect to daemon:', (error as Error).message);
      process.exit(1);
    }
  }

  private async isDaemonRunning(pidFile: string): Promise<boolean> {
    try {
      const pid = await this.getPidFromFile(pidFile);
      if (!pid) return false;
      
      // Check if process exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getPidFromFile(pidFile: string): Promise<number | null> {
    try {
      const pidStr = await fs.readFile(pidFile, 'utf-8');
      return parseInt(pidStr.trim());
    } catch (error) {
      return null;
    }
  }

  getCommands() {
    return {
      'daemon:start': {
        description: 'Start MCPDog daemon',
        handler: this.start.bind(this),
        options: {
          'daemon-port': 'Daemon IPC port (default: 9999)',
          'web-port': 'Enable Web interface port',
          'pid-file': 'PID file path'
        }
      },
      'daemon:stop': {
        description: 'Stop MCPDog daemon',
        handler: this.stop.bind(this),
        options: {
          'pid-file': 'PID file path'
        }
      },
      'daemon:status': {
        description: 'Check daemon status',
        handler: this.status.bind(this),
        options: {
          'daemon-port': 'Daemon IPC port (default: 9999)'
        }
      },
      'daemon:reload': {
        description: 'Reload daemon configuration',
        handler: this.reload.bind(this),
        options: {
          'daemon-port': 'Daemon IPC port (default: 9999)'
        }
      }
    };
  }
}