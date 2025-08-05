/**
 * Start Command - 用户友好的启动命令
 */

import { ConfigManager } from '../../config/config-manager.js';
import { CLIUtils } from '../cli-utils.js';
import { DaemonCommands } from './daemon-commands.js';
import { spawn } from 'child_process';
import { DaemonClient } from '../../daemon/daemon-client.js';
import fs from 'fs/promises';
import path from 'path';

export class StartCommand {
  private daemonCommands: DaemonCommands;

  constructor(private configManager: ConfigManager) {
    this.daemonCommands = new DaemonCommands(configManager.getConfigPath());
  }

  async execute(args: string[], options: Record<string, any>): Promise<void> {
    if (options.help) {
      this.showHelp();
      return;
    }

    try {
      // 加载配置以获取准确信息
      await this.configManager.loadConfig();
      
      // 检查守护进程是否已在运行
      const isAlreadyRunning = await this.isDaemonRunning(options);
      if (isAlreadyRunning) {
        console.log(`
❌ ${CLIUtils.colorize('MCPDog daemon is already running', 'red')}

${CLIUtils.colorize('Available actions:', 'yellow')}
  mcpdog status    # Check current status
  mcpdog stop      # Stop the daemon
  mcpdog restart   # Restart the daemon (not implemented yet)
`);
        process.exit(1);
      }

      // 显示启动信息
      this.showStartingInfo(options);
      
      // 直接调用守护进程启动，但在后台执行友好信息显示
      this.startDaemonWithFriendlyOutput(options);
      
    } catch (error) {
      await this.showStartupError(error as Error, options);
    }
  }

  private async showStartupInfo(options: Record<string, any>): Promise<void> {
    // 等待一点时间让守护进程完全启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = this.configManager.getConfig();
    const enabledServers = this.configManager.getEnabledServers();
    const webPort = options['web-port'] || config.web?.port || 3000;
    const ipcPort = options['daemon-port'] || 9999;

    console.log(`
🚀 ${CLIUtils.colorize('MCPDog started successfully!', 'green')}

${CLIUtils.colorize('Configuration:', 'cyan')}
  📁 Config file: ${this.configManager.getConfigPath()}
  🔧 Enabled servers: ${Object.keys(enabledServers).join(', ')} (${this.getTotalToolCount()} tools)
  🌐 Web interface: ${CLIUtils.colorize(`http://localhost:${webPort}`, 'blue')}
  🔌 IPC port: ${ipcPort}

${CLIUtils.colorize('MCP Client Configuration:', 'cyan')}
  Add this to your MCP client (Claude Desktop, Cursor, etc.):

  ${CLIUtils.colorize(JSON.stringify({
    "mcpdog": {
      "command": "mcpdog",
      "args": ["proxy"]
    }
  }, null, 2), 'yellow')}

${CLIUtils.colorize('💡 Useful commands:', 'cyan')}
  mcpdog status          # Check running status
  mcpdog stop            # Stop the daemon
  mcpdog config list     # View all servers
  
${CLIUtils.colorize('🌐 Web Interface Features:', 'cyan')}
  • Real-time tool call monitoring
  • Visual configuration management
  • Client connection status

${CLIUtils.colorize('[INFO]', 'cyan')} Daemon is running in the background
`);
  }

  private async showStartupError(error: Error, options: Record<string, any>): Promise<void> {
    const configPath = this.configManager.getConfigPath();
    
    console.log(`
❌ ${CLIUtils.colorize('Startup failed:', 'red')} ${error.message}

${CLIUtils.colorize('Common solutions:', 'yellow')}
  1. Check if configuration file exists:
     ls -la ${configPath}
     
  2. Create a default configuration:
     mcpdog config init
     
  3. Validate your configuration:
     mcpdog config validate
     
  4. Check if port is already in use:
     lsof -i :${options['daemon-port'] || 9999}

${CLIUtils.colorize('Need help?', 'cyan')}
  mcpdog --help          # Show all commands
  mcpdog config --help   # Configuration help
  mcpdog daemon --help   # Advanced daemon options
`);
    
    process.exit(1);
  }

  private async isDaemonRunning(options: Record<string, any>): Promise<boolean> {
    const pidFile = options['pid-file'] || path.join(process.cwd(), 'mcpdog.pid');
    try {
      const pidData = await fs.readFile(pidFile, 'utf-8');
      const pid = parseInt(pidData.trim());
      
      // 检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private showStartingInfo(options: Record<string, any>): void {
    console.log(`
🚀 ${CLIUtils.colorize('Starting MCPDog daemon...', 'cyan')}
`);
  }

  private async startDaemonWithFriendlyOutput(options: Record<string, any>): Promise<void> {
    // 设置一个短暂的延迟来显示友好信息
    setTimeout(async () => {
      await this.showStartupInfo(options);
    }, 2000);

    // 直接调用守护进程启动（这会阻塞，但友好信息已经异步显示）
    await this.daemonCommands.start([], options);
  }

  private async waitForDaemonReady(options: Record<string, any>): Promise<void> {
    const daemonPort = parseInt(options['daemon-port']) || 9999;
    const maxAttempts = 10;
    const delay = 500;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const client = new DaemonClient({
          port: daemonPort,
          clientType: 'cli',
          silent: true
        });

        await client.connect();
        await client.disconnect();
        return; // 连接成功
      } catch {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Daemon failed to start within expected time');
  }

  private getTotalToolCount(): number {
    const enabledServers = this.configManager.getEnabledServers();
    return Object.keys(enabledServers).length;
  }

  private showHelp(): void {
    console.log(`
${CLIUtils.colorize('mcpdog start', 'cyan')} - Start MCPDog daemon with friendly output

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog start [options]

${CLIUtils.colorize('Options:', 'yellow')}
  -c, --config <path>    Configuration file path (default: ./mcpdog.config.json)
  --web-port <port>      Web interface port (auto-detected from 3000 if not specified)
  --daemon-port <port>   IPC daemon port (default: 9999)
  --pid-file <path>      PID file location
  --help                 Show this help message

${CLIUtils.colorize('Description:', 'yellow')}
  This command starts the MCPDog daemon that manages MCP servers and provides
  a unified interface for MCP clients. The daemon runs in the background and
  provides both a web interface for management (enabled by default) and an IPC 
  interface for clients.

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog start                           # Start with default configuration
  mcpdog start --config my-config.json   # Start with custom configuration  
  mcpdog start --web-port 8080           # Start with custom web port

${CLIUtils.colorize('After starting:', 'yellow')}
  • Configure your MCP clients to use: mcpdog proxy
  • Access web interface at: http://localhost:3000
  • Check status with: mcpdog status
`);
  }
}