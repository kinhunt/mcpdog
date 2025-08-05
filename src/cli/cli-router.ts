/**
 * CLI Command Router - Dispatches and executes various CLI commands
 */

import { ConfigManager } from '../config/config-manager.js';
import { CLIUtils } from './cli-utils.js';
import { ConfigCommands } from './commands/config-commands.js';
import { DetectCommands } from './commands/detect-commands.js';
import { OptimizeCommands } from './commands/optimize-commands.js';
import { DiagnoseCommands } from './commands/diagnose-commands.js';
import { AuditCommands } from './commands/audit-commands.js';
import { ProxyCommand } from './commands/proxy-command.js';
import { StartCommand } from './commands/start-command.js';
import { DaemonCommands } from './commands/daemon-commands.js';

export class CLICommandRouter {
  private configManager: ConfigManager;
  private configCommands: ConfigCommands;
  private detectCommands: DetectCommands;
  private optimizeCommands: OptimizeCommands;
  private diagnoseCommands: DiagnoseCommands;
  private auditCommands: AuditCommands;
  private proxyCommand: ProxyCommand;
  private startCommand: StartCommand;
  private daemonCommands: DaemonCommands;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    
    // Initialize various command handlers
    this.configCommands = new ConfigCommands(this.configManager);
    this.detectCommands = new DetectCommands(this.configManager);
    this.optimizeCommands = new OptimizeCommands(this.configManager);
    this.diagnoseCommands = new DiagnoseCommands(this.configManager);
    this.auditCommands = new AuditCommands(this.configManager);
    this.proxyCommand = new ProxyCommand(this.configManager);
    this.startCommand = new StartCommand(this.configManager);
    this.daemonCommands = new DaemonCommands(this.configManager.getConfigPath());
  }

  async executeCommand(command: string, args: string[], options: Record<string, any>): Promise<void> {
    CLIUtils.verbose(`Executing command: ${command}, args: ${args.join(' ')}`);

    try {
      // These commands do not need to load config file, as they communicate directly with the daemon
      const noConfigCommands = ['proxy', 'serve', 'status', 'stop'];
      if (!noConfigCommands.includes(command)) {
        // Load config
        await this.configManager.loadConfig();
      }

      switch (command) {
        case 'start':
          await this.startCommand.execute(args, options);
          break;

        case 'serve':
        case 'proxy':
          await this.proxyCommand.execute(args, options);
          break;

        case 'stop':
          await this.executeDaemonCommand(['stop'], options);
          break;

        case 'status':
          await this.executeDaemonCommand(['status'], options);
          break;

        case 'daemon':
          await this.executeDaemonCommand(args, options);
          break;

        case 'config':
          await this.configCommands.execute(args, options);
          break;

        case 'detect':
          await this.detectCommands.execute(args, options);
          break;

        case 'optimize':
          await this.optimizeCommands.execute(args, options);
          break;

        case 'diagnose':
          await this.diagnoseCommands.execute(args, options);
          break;

        case 'audit':
          await this.auditCommands.execute(args, options);
          break;

        default:
          if (options.help) {
            this.showCommandHelp(command);
          } else {
            CLIUtils.error(`Unknown command: ${command}`);
            CLIUtils.info('Use mcpdog --help to see available commands');
            process.exit(1);
          }
      }
    } catch (error) {
      CLIUtils.error(`Command execution failed: ${(error as Error).message}`);
      if (CLIUtils.isVerbose()) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  private async executeDaemonCommand(args: string[], options: Record<string, any>): Promise<void> {
    const [subcommand] = args;
    
    if (!subcommand || options.help) {
      this.showCommandHelp('daemon');
      return;
    }
    
    switch (subcommand) {
      case 'start':
        await this.daemonCommands.start(args.slice(1), options);
        break;
      case 'stop':
        await this.daemonCommands.stop(args.slice(1), options);
        break;
      case 'status':
        await this.daemonCommands.status(args.slice(1), options);
        break;
      case 'reload':
        await this.daemonCommands.reload(args.slice(1), options);
        break;
      default:
        CLIUtils.error(`Unknown daemon command: ${subcommand}`);
        CLIUtils.info('Available commands: start, stop, status, reload');
        process.exit(1);
    }
  }

  private showCommandHelp(command: string) {
    const helpTexts: Record<string, string> = {
      serve: `
${CLIUtils.colorize('mcpdog serve', 'cyan')} - Start MCP server

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog serve [options]

${CLIUtils.colorize('Options:', 'yellow')}
  --web-port <port>     Enable Web interface port (deprecated, use daemon mode)
  --daemon-port <port>  Connect to daemon port (default: 9999)
  -c, --config <path>   Configuration file path

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog serve                    # Connect to daemon in stdio mode
  mcpdog serve --daemon-port 9999 # Connect to daemon on specified port
`,

      daemon: `
${CLIUtils.colorize('mcpdog daemon', 'cyan')} - Daemon management

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog daemon <subcommand> [options]

${CLIUtils.colorize('Subcommands:', 'yellow')}
  start                   Start daemon
  stop                    Stop daemon
  status                  View daemon status
  reload                  Reload config

${CLIUtils.colorize('Start Options:', 'yellow')}
  --daemon-port <port>    IPC port (default: 9999)
  --web-port <port>       Web interface port (auto-detected from 3000 if not specified)
  --pid-file <path>       PID file path

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog daemon start                    # Start daemon with auto-detected web port
  mcpdog daemon start --web-port 3000    # Start daemon with specific web port
  mcpdog daemon status                   # View status
  mcpdog daemon reload                   # Reload config
  mcpdog daemon stop                     # Stop daemon
`,

      config: `
${CLIUtils.colorize('mcpdog config', 'cyan')} - Configuration management

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog config <subcommand> [options]

${CLIUtils.colorize('Subcommands:', 'yellow')}
  list                    List all server configurations
  add <name> <endpoint>   Add new server
  remove <name>           Remove server
  update <name>           Update server configuration
  show <name>             Show server details
  enable <name>           Enable server
  disable <name>          Disable server

${CLIUtils.colorize('Options:', 'yellow')}
  --auto-detect          Auto-detect protocol (for add command)
  --transport <type>     Specify transport protocol
  --timeout <ms>         Set timeout
  --retries <num>        Set retries

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog config list
  mcpdog config add my-api https://api.example.com --auto-detect
  mcpdog config remove old-server
`,

      detect: `
${CLIUtils.colorize('mcpdog detect', 'cyan')} - Protocol detection

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog detect <server-name|endpoint> [options]

${CLIUtils.colorize('Options:', 'yellow')}
  --all                  Detect all servers
  --timeout <ms>         Detection timeout
  --detailed             Show detailed detection info

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog detect my-server              # Detect existing server
  mcpdog detect https://api.example.com # Detect new endpoint
  mcpdog detect --all                  # Detect all servers
`,

      optimize: `
${CLIUtils.colorize('mcpdog optimize', 'cyan')} - Performance optimization

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog optimize [server-name] [options]

${CLIUtils.colorize('Options:', 'yellow')}
  --all                  Optimize all servers
  --apply                Automatically apply optimization suggestions
  --preview              Preview optimization results

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog optimize my-server --apply
  mcpdog optimize --all --preview
`,

      diagnose: `
${CLIUtils.colorize('mcpdog diagnose', 'cyan')} - Diagnosis and repair

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog diagnose [server-name] [options]

${CLIUtils.colorize('Options:', 'yellow')}
  --all                  Diagnose all servers
  --fix                  Automatically fix issues
  --health-check         Perform health check

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog diagnose problem-server --fix
  mcpdog diagnose --all --health-check
`,

      audit: `
${CLIUtils.colorize('mcpdog audit', 'cyan')} - Configuration audit

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog audit [options]

${CLIUtils.colorize('Options:', 'yellow')}
  --performance         Performance analysis
  --security            Security audit
  --compliance          Compliance check
  --export <format>     Export audit report

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog audit --performance
  mcpdog audit --security --export json
`
    };

    const helpText = helpTexts[command];
    if (helpText) {
      console.log(helpText);
    } else {
      CLIUtils.error(`Help information not found for command '${command}'`);
    }
  }
}