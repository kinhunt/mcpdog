/**
 * Configuration Management CLI Commands
 */

import { ConfigManager } from '../../config/config-manager.js';
import { MCPServerConfig } from '../../types/index.js';
import { CLIUtils } from '../cli-utils.js';
import { createInterface } from 'readline';
import fs from 'fs/promises';

interface ValidationResult {
  category: string;
  test: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export class ConfigCommands {
  constructor(private configManager: ConfigManager) {}

  private parseAddOptions(args: string[]): { args: string[], options: Record<string, any> } {
    const options: Record<string, any> = {};
    const positionalArgs: string[] = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        switch (optionName) {
          case 'transport':
          case 'timeout':
          case 'retries':
          case 'headers':
          case 'args':
            // These options require values
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
              options[optionName] = args[i + 1];
                            i++; // Skip value
            }
            break;
          case 'auto-detect':
          case 'yes':
            // Boolean options
            options[optionName] = true;
            break;
          default:
            // Other options
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
              options[optionName] = args[i + 1];
                            i++; // Skip value
            } else {
              options[optionName] = true;
            }
        }
      } else {
        positionalArgs.push(arg);
      }
    }
    
    return { args: positionalArgs, options };
  }

  async execute(args: string[], options: Record<string, any>): Promise<void> {
    const [subcommand, ...subArgs] = args;

    if (options.help || !subcommand) {
      this.showHelp();
      return;
    }

    switch (subcommand) {
      case 'init':
        await this.initConfig(subArgs, options);
        break;
      case 'list':
        await this.listServers(subArgs, options);
        break;
      case 'add':
        await this.addServer(subArgs, options);
        break;
      case 'remove':
        await this.removeServer(subArgs, options);
        break;
      case 'update':
        await this.updateServer(subArgs, options);
        break;
      case 'show':
        await this.showServer(subArgs, options);
        break;
      case 'enable':
        await this.enableServer(subArgs, options);
        break;
      case 'disable':
        await this.disableServer(subArgs, options);
        break;
      case 'validate':
        await this.validateConfig(subArgs, options);
        break;
      case 'mcp-config':
        await this.generateMCPConfig(subArgs, options);
        break;
      default:
        CLIUtils.error(`Unknown config subcommand: ${subcommand}`);
        this.showHelp();
        process.exit(1);
    }
  }

  private async listServers(args: string[], options: Record<string, any>): Promise<void> {
    const servers = Object.values(this.configManager.getServers());
    
    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput(servers);
      return;
    }

    if (servers.length === 0) {
      CLIUtils.info('No servers configured');
      return;
    }

    CLIUtils.info(`Found ${servers.length} server configurations:
`);

    const headers = ['Name', 'Status', 'Protocol', 'Endpoint/Command', 'Tool Count'];
    const rows = servers.map((server: MCPServerConfig) => [
      server.name,
      server.enabled ? CLIUtils.colorize('Enabled', 'green') : CLIUtils.colorize('Disabled', 'red'),
      server.transport,
      server.endpoint || server.command || '-',
      'Pending Detection' // TODO: Actual tool count
    ]);

    CLIUtils.printTable(headers, rows);
  }

  private async addServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name, endpoint] = args;
    
    console.log('addServer - args:', args);
    console.log('addServer - options:', options);

    if (!name || !endpoint) {
      CLIUtils.error('Usage: mcpdog config add <name> <endpoint> [options]');
      return;
    }

    try {
      if (options['auto-detect']) {
        // Use protocol auto-detection
        CLIUtils.info(`🔍 Auto-detecting server protocol: ${endpoint}`);
        
        // const suggestion = await this.configManager.generateAutoConfig(name, endpoint, {
        //   timeout: options.timeout ? parseInt(options.timeout) : undefined
        // });

        // // Display detection results
        // if (!CLIUtils.isJsonMode()) {
        //   CLIUtils.success(`Protocol detection complete (confidence: ${suggestion.confidence}%)`);
        //   CLIUtils.info(`Recommended protocol: ${suggestion.config.transport}`);
          
        //   if (suggestion.warnings.length > 0) {
        //     CLIUtils.warning('Warnings:');
        //     suggestion.warnings.forEach(w => CLIUtils.warning(`  - ${w}`));
        //   }

        //   if (suggestion.optimizations.length > 0) {
        //     CLIUtils.info('Optimization suggestions:');
        //     suggestion.optimizations.forEach(o => CLIUtils.info(`  💡 ${o}`));
        //   }
        // }

        // // Confirm add
        // const shouldAdd = options.yes || await CLIUtils.confirm(
        //   `Add server '${name}' (protocol: ${suggestion.config.transport})?`,
        //   true
        // );

        // if (shouldAdd) {
        //   await this.configManager.addServer(name, suggestion.config);
        //   CLIUtils.success(`✅ Server '${name}' added successfully`);
          
        //   // Display alternative configurations
        //   if (suggestion.alternatives.length > 0 && !CLIUtils.isJsonMode()) {
        //     CLIUtils.info(`\n💡 Available alternative configurations:`);
        //     suggestion.alternatives.forEach((alt, index) => {
        //       CLIUtils.info(`  ${index + 1}. ${alt.transport} - ${alt.description}`);
        //     });
        //   }
        // } else {
        //   CLIUtils.info('Operation cancelled');
        // }

      } else {
        // Manual configuration mode
        CLIUtils.verbose(`Transport option: ${options.transport} (${typeof options.transport})`);
        const transport = typeof options.transport === 'string' ? options.transport : 'stdio';
        CLIUtils.verbose(`Final transport: ${transport} (${typeof transport})`);
        const config: MCPServerConfig = {
          name: name,
          enabled: true,
          transport: transport as any,
          timeout: options.timeout ? parseInt(options.timeout) : 30000,
          retries: options.retries ? parseInt(options.retries) : 3
        };

        // Set required fields based on protocol type
        if (transport === 'stdio') {
          // Parse stdio command
          const commandParts = endpoint.split(' ');
          config.command = commandParts[0];
          const cmdArgs = commandParts.slice(1);
          
          // If there are additional args options, merge them
          if (options.args) {
            const additionalArgs = options.args.split(',').map((arg: string) => arg.trim());
            config.args = [...cmdArgs, ...additionalArgs];
          } else {
            config.args = cmdArgs;
          }
        } else {
          config.endpoint = endpoint;
          if (options.headers) {
            config.headers = JSON.parse(options.headers);
          }
        }

        await this.configManager.addServer(name, config);
        await this.configManager.saveConfig();
        CLIUtils.success(`✅ Server '${name}' added successfully (Protocol: ${transport})`);
      }

      if (CLIUtils.isJsonMode()) {
        CLIUtils.jsonOutput({ 
          success: true, 
          server: name, 
          message: 'Server added successfully' 
        });
      }

    } catch (error) {
      CLIUtils.error(`Failed to add server: ${(error as Error).message}`);
      if (CLIUtils.isJsonMode()) {
        CLIUtils.jsonOutput({ 
          success: false, 
          error: (error as Error).message 
        });
      }
      process.exit(1);
    }
  }

  private async removeServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name] = args;

    if (!name) {
      CLIUtils.error('Usage: mcpdog config remove <name>');
      return;
    }

    try {
      const server = this.configManager.getServer(name);
      if (!server) {
        CLIUtils.error(`服务器 '${name}' 不存在`);
        return;
      }

      const shouldRemove = options.yes || await CLIUtils.confirm(
        `确定要删除服务器 '${name}' 吗?`,
        false
      );

      if (shouldRemove) {
        await this.configManager.removeServer(name);
        CLIUtils.success(`✅ 服务器 '${name}' 删除成功`);
      } else {
        CLIUtils.info('操作已取消');
      }

    } catch (error) {
      CLIUtils.error(`删除服务器失败: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  private async updateServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name] = args;

    if (!name) {
      CLIUtils.error('使用方法: mcpdog config update <name> [options]');
      return;
    }

    try {
      const server = this.configManager.getServer(name);
      if (!server) {
        CLIUtils.error(`服务器 '${name}' 不存在`);
        return;
      }

      const updates: Partial<MCPServerConfig> = {};

      // 从选项中构建更新对象
      if (options.endpoint) updates.endpoint = options.endpoint;
      if (options.transport) updates.transport = options.transport;
      if (options.timeout) updates.timeout = parseInt(options.timeout);
      if (options.retries) updates.retries = parseInt(options.retries);
      if (options.description) updates.description = options.description;

      if (Object.keys(updates).length === 0) {
        CLIUtils.warning('没有指定要更新的字段');
        return;
      }

      await this.configManager.updateServer(name, updates);
      CLIUtils.success(`✅ 服务器 '${name}' 更新成功`);

      if (!CLIUtils.isJsonMode()) {
        CLIUtils.info('更新的字段:');
        Object.entries(updates).forEach(([key, value]) => {
          CLIUtils.info(`  ${key}: ${value}`);
        });
      }

    } catch (error) {
      CLIUtils.error(`更新服务器失败: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  private async showServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name] = args;

    if (!name) {
      CLIUtils.error('使用方法: mcpdog config show <name>');
      return;
    }

    const server = this.configManager.getServer(name);
    if (!server) {
      CLIUtils.error(`服务器 '${name}' 不存在`);
      return;
    }

    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput(server);
      return;
    }

    console.log(`\n${CLIUtils.colorize('🔧 服务器配置:', 'cyan')} ${server.name}\n`);
    
    const details = [
      ['字段', '值'],
      ['名称', server.name],
      ['状态', server.enabled ? CLIUtils.colorize('启用', 'green') : CLIUtils.colorize('禁用', 'red')],
      ['传输协议', server.transport],
      ['端点', server.endpoint || '-'],
      ['命令', server.command || '-'],
      ['参数', server.args?.join(', ') || '-'],
      ['超时时间', `${server.timeout || 30000}ms`],
      ['重试次数', `${server.retries || 3}`],
      ['描述', server.description || '-']
    ];

    CLIUtils.printTable(details[0], details.slice(1));
  }

  private async enableServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name] = args;

    if (!name) {
      CLIUtils.error('使用方法: mcpdog config enable <name>');
      return;
    }

    try {
      await this.configManager.toggleServer(name, true);
      CLIUtils.success(`✅ 服务器 '${name}' 已启用`);
    } catch (error) {
      CLIUtils.error(`启用服务器失败: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  private async disableServer(args: string[], options: Record<string, any>): Promise<void> {
    const [name] = args;

    if (!name) {
      CLIUtils.error('使用方法: mcpdog config disable <name>');
      return;
    }

    try {
      await this.configManager.toggleServer(name, false);
      CLIUtils.success(`✅ 服务器 '${name}' 已禁用`);
    } catch (error) {
      CLIUtils.error(`禁用服务器失败: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  private async generateMCPConfig(args: string[], options: Record<string, any>): Promise<void> {
    const config = this.configManager.getConfig();
    const servers = this.configManager.getServers();
    const enabledServers = Object.entries(servers).filter(([name, s]) => s.enabled !== false);
    
    // 获取当前工作目录和配置文件路径
    const cwd = process.cwd();
    const configPath = this.configManager['configPath'] || './mcpdog.config.json';
    const { resolve } = await import('path');
    const absoluteConfigPath = resolve(configPath);

    if (CLIUtils.isJsonMode()) {
      const configs = {
        absolutePath: {
          mcpServers: {
            mcpdog: {
              command: "mcpdog",
              args: ["serve", "--config", absoluteConfigPath]
            }
          }
        },
        workingDirectory: {
          mcpServers: {
            mcpdog: {
              command: "mcpdog", 
              args: ["serve"],
              cwd: cwd
            }
          }
        }
      };
      CLIUtils.jsonOutput(configs);
      return;
    }

    console.log(`\n${CLIUtils.colorize('🐕 MCPDog MCP客户端配置生成器', 'cyan')}\n`);
    
    console.log(`${CLIUtils.colorize('📋 环境信息:', 'yellow')}`);
    console.log(`  MCPDog目录: ${cwd}`);
    console.log(`  配置文件: ${absoluteConfigPath}`);
    console.log(`  服务器总数: ${servers.length}`);
    console.log(`  启用服务器: ${enabledServers.length}`);
    
    if (enabledServers.length === 0) {
      CLIUtils.warning('没有启用的服务器配置');
      CLIUtils.info('建议先添加服务器: mcpdog config add my-server https://api.example.com --auto-detect');
      console.log('');
    }

    console.log(`\n${CLIUtils.colorize('🔧 推荐的MCP客户端配置:', 'cyan')}\n`);
    
    // 方案1: 绝对路径 (推荐)
    console.log(`${CLIUtils.colorize('📱 方案1: 使用绝对路径 (推荐)', 'green')}`);
    console.log('```json');
    console.log(JSON.stringify({
      mcpServers: {
        mcpdog: {
          command: "mcpdog",
          args: ["serve", "--config", absoluteConfigPath]
        }
      }
    }, null, 2));
    console.log('```\n');
    
    // 方案2: 工作目录
    console.log(`${CLIUtils.colorize('📁 方案2: 使用工作目录', 'blue')}`);
    console.log('```json');
    console.log(JSON.stringify({
      mcpServers: {
        mcpdog: {
          command: "mcpdog",
          args: ["serve"],
          cwd: cwd
        }
      }
    }, null, 2));
    console.log('```\n');
    
    // 方案3: Node.js后备
    console.log(`${CLIUtils.colorize('🔧 方案3: Node.js后备 (如果mcpdog命令不可用)', 'yellow')}`);
    const nodePath = resolve(cwd, 'dist/cli/cli-main.js');
    console.log('```json');
    console.log(JSON.stringify({
      mcpServers: {
        mcpdog: {
          command: "node",
          args: [nodePath, "serve"],
          cwd: cwd
        }
      }
    }, null, 2));
    console.log('```\n');
    
    console.log(`${CLIUtils.colorize('💡 使用说明:', 'cyan')}`);
    console.log('  • 复制上述配置到你的MCP客户端配置文件');
    console.log('  • Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('  • Continue.dev: .continue/config.json');
    console.log('  • 重启MCP客户端以加载新配置');
    console.log('');
    
    console.log(`${CLIUtils.colorize('🚀 验证步骤:', 'cyan')}`);
    console.log('  1. mcpdog diagnose --health-check');
    console.log('  2. 在MCP客户端中测试连接');
    console.log('  3. 查看可用工具列表');
  }

  private async initConfig(args: string[], options: Record<string, any>): Promise<void> {
    const configPath = args[0] || this.configManager.getConfigPath();
    
    console.log(`
🚀 ${CLIUtils.colorize('MCPDog Configuration Wizard', 'cyan')}

This wizard will help you create a new MCPDog configuration file.
`);

    // 检查配置文件是否已存在
    try {
      await fs.access(configPath);
      const overwrite = await this.askQuestion(`Configuration file '${configPath}' already exists. Overwrite? (y/N): `);
      if (!overwrite.toLowerCase().startsWith('y')) {
        console.log('Configuration initialization cancelled.');
        return;
      }
    } catch {
      // 文件不存在，继续
    }

    const config = {
      version: '2.0.0',
      servers: {} as Record<string, MCPServerConfig>,
      web: {
        enabled: false,
        port: 3000,
        host: 'localhost'
      },
      logging: {
        level: 'info'
      }
    };

    console.log(`
${CLIUtils.colorize('Step 1: Basic Configuration', 'yellow')}
`);

    // Web界面配置
    const enableWeb = await this.askQuestion('Enable web management interface? (Y/n): ');
    if (!enableWeb.toLowerCase().startsWith('n')) {
      config.web.enabled = true;
      const webPort = await this.askQuestion(`Web interface port (default: 3000): `);
      if (webPort.trim()) {
        config.web.port = parseInt(webPort) || 3000;
      }
    }

    console.log(`
${CLIUtils.colorize('Step 2: MCP Servers', 'yellow')}

Let's add some MCP servers. You can add more later using 'mcpdog config add'.
`);

    // 提供常用的MCP服务器模板
    const templates = [
      {
        name: 'memory',
        description: 'Knowledge graph memory server',
        config: {
          name: 'memory',
          enabled: true,
          transport: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          description: 'Knowledge graph memory server',
          timeout: 30000,
          retries: 3
        }
      },
      {
        name: 'filesystem',
        description: 'File system access server',
        config: {
          name: 'filesystem',
          enabled: true,
          transport: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
          description: 'File system access server',
          timeout: 30000,
          retries: 3
        }
      },
      {
        name: 'github',
        description: 'GitHub integration server',
        config: {
          name: 'github',
          enabled: true,
          transport: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          description: 'GitHub integration server',
          timeout: 30000,
          retries: 3
        }
      }
    ];

    console.log('Available MCP server templates:');
    templates.forEach((template, index) => {
      console.log(`  ${index + 1}. ${CLIUtils.colorize(template.name, 'green')} - ${template.description}`);
    });
    console.log(`  ${templates.length + 1}. Custom server`);
    console.log(`  ${templates.length + 2}. Skip (create empty configuration)`);

    let addingServers = true;
    while (addingServers) {
      const choice = await this.askQuestion(`\nSelect a server template (1-${templates.length + 2}): `);
      const choiceNum = parseInt(choice);

      if (choiceNum >= 1 && choiceNum <= templates.length) {
        const template = templates[choiceNum - 1];
        const serverName = await this.askQuestion(`Server name (default: ${template.name}): `) || template.name;
        
        // 检查是否需要自定义路径（对于filesystem）
        if (template.name === 'filesystem') {
          const customPath = await this.askQuestion(`Filesystem root path (default: ${process.cwd()}): `);
          if (customPath.trim()) {
            template.config.args = ['-y', '@modelcontextprotocol/server-filesystem', customPath.trim()];
          }
        }

        config.servers[serverName] = { ...template.config, name: serverName };
        console.log(`✅ Added ${CLIUtils.colorize(serverName, 'green')} server`);

      } else if (choiceNum === templates.length + 1) {
        // 自定义服务器
        await this.addCustomServer(config.servers);
        
      } else if (choiceNum === templates.length + 2) {
        // 跳过
        break;
      } else {
        console.log('Invalid choice. Please try again.');
        continue;
      }

      const addMore = await this.askQuestion('Add another server? (y/N): ');
      if (!addMore.toLowerCase().startsWith('y')) {
        addingServers = false;
      }
    }

    // 保存配置
    try {
      const configData = JSON.stringify(config, null, 2);
      await fs.writeFile(configPath, configData, 'utf-8');
      
      console.log(`
✅ ${CLIUtils.colorize('Configuration created successfully!', 'green')}

📁 Configuration file: ${CLIUtils.colorize(configPath, 'cyan')}
🔧 MCP servers configured: ${CLIUtils.colorize(Object.keys(config.servers).length.toString(), 'yellow')}
${config.web.enabled ? `🌐 Web interface: ${CLIUtils.colorize(`http://localhost:${config.web.port}`, 'blue')}` : ''}

${CLIUtils.colorize('Next steps:', 'yellow')}
  1. Start MCPDog: ${CLIUtils.colorize(`mcpdog start --config ${configPath}`, 'cyan')}
  2. Configure MCP clients to use: ${CLIUtils.colorize('mcpdog proxy', 'cyan')}
  3. Check status: ${CLIUtils.colorize('mcpdog status', 'cyan')}
`);
      
    } catch (error) {
      CLIUtils.error('Failed to save configuration:', (error as Error).message);
      process.exit(1);
    }
  }

  private async addCustomServer(servers: Record<string, MCPServerConfig>): Promise<void> {
    console.log(`\n${CLIUtils.colorize('Custom Server Configuration', 'cyan')}`);
    
    const name = await this.askQuestion('Server name: ');
    if (!name.trim()) {
      console.log('Server name is required.');
      return;
    }

    const description = await this.askQuestion('Description (optional): ');
    
    console.log('\nTransport types:');
    console.log('  1. stdio - Command line program');
    console.log('  2. http-sse - HTTP Server-Sent Events');
    console.log('  3. streamable-http - HTTP Streaming');
    
    const transportChoice = await this.askQuestion('Select transport type (1-3): ');
    let transport: 'stdio' | 'http-sse' | 'streamable-http' = 'stdio';
    
    switch (transportChoice) {
      case '2':
        transport = 'http-sse';
        break;
      case '3':
        transport = 'streamable-http';
        break;
      default:
        transport = 'stdio';
    }

    let serverConfig: MCPServerConfig;

    if (transport === 'stdio') {
      const command = await this.askQuestion('Command to run: ');
      const argsInput = await this.askQuestion('Arguments (comma-separated, optional): ');
      const args = argsInput.trim() ? argsInput.split(',').map(arg => arg.trim()) : [];
      
      serverConfig = {
        name: name.trim(),
        enabled: true,
        transport,
        command: command.trim(),
        args,
        description: description.trim() || `Custom ${transport} server`,
        timeout: 30000,
        retries: 3
      };
    } else {
      const endpoint = await this.askQuestion(`${transport.toUpperCase()} endpoint URL: `);
      
      serverConfig = {
        name: name.trim(),
        enabled: true,
        transport,
        endpoint: endpoint.trim(),
        description: description.trim() || `Custom ${transport} server`,
        timeout: 30000,
        retries: 3
      };
    }

    servers[name.trim()] = serverConfig;
    console.log(`✅ Added custom server: ${CLIUtils.colorize(name.trim(), 'green')}`);
  }

  private async askQuestion(question: string): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  private async validateConfig(args: string[], options: Record<string, any>): Promise<void> {
    const configPath = args[0] || this.configManager.getConfigPath();
    
    console.log(`
🔍 ${CLIUtils.colorize('MCPDog Configuration Validation', 'cyan')}

Validating configuration file: ${CLIUtils.colorize(configPath, 'yellow')}
`);

    const validationResults: ValidationResult[] = [];
    let config: any;

    // 1. 检查文件是否存在并可读取
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configData);
      validationResults.push({
        category: 'File',
        test: 'File exists and is readable',
        status: 'pass',
        message: 'Configuration file loaded successfully'
      });
    } catch (error) {
      const err = error as Error;
      validationResults.push({
        category: 'File',
        test: 'File exists and is readable',
        status: 'error',
        message: `Cannot read configuration file: ${err.message}`,
        suggestion: 'Check file path and permissions, or run "mcpdog config init" to create a new configuration'
      });
      this.displayValidationResults(validationResults);
      return;
    }

    // 2. 验证基本结构
    this.validateBasicStructure(config, validationResults);

    // 3. 验证服务器配置
    this.validateServers(config.servers || {}, validationResults);

    // 4. 验证Web配置
    this.validateWebConfig(config.web, validationResults);

    // 5. 检查可能的最佳实践问题
    this.validateBestPractices(config, validationResults);

    // 显示结果
    this.displayValidationResults(validationResults);

    // 统计结果
    const errors = validationResults.filter(r => r.status === 'error').length;
    const warnings = validationResults.filter(r => r.status === 'warning').length;
    const passes = validationResults.filter(r => r.status === 'pass').length;

    console.log(`
${CLIUtils.colorize('Summary:', 'cyan')}
  ✅ Passed: ${CLIUtils.colorize(passes.toString(), 'green')}
  ⚠️  Warnings: ${CLIUtils.colorize(warnings.toString(), 'yellow')}
  ❌ Errors: ${CLIUtils.colorize(errors.toString(), 'red')}
`);

    if (errors === 0 && warnings === 0) {
      console.log(`🎉 ${CLIUtils.colorize('Configuration is valid and ready to use!', 'green')}`);
    } else if (errors === 0) {
      console.log(`✅ ${CLIUtils.colorize('Configuration is valid but has some recommendations.', 'yellow')}`);
    } else {
      console.log(`❌ ${CLIUtils.colorize('Configuration has errors that need to be fixed.', 'red')}`);
      process.exit(1);
    }
  }

  private validateBasicStructure(config: any, results: ValidationResult[]): void {
    // 检查版本
    if (!config.version) {
      results.push({
        category: 'Structure',
        test: 'Version field present',
        status: 'error',
        message: 'Missing version field',
        suggestion: 'Add "version": "2.0.0" to your configuration'
      });
    } else if (config.version !== '2.0.0') {
      results.push({
        category: 'Structure',
        test: 'Version compatibility',
        status: 'warning',
        message: `Version ${config.version} may not be fully compatible`,
        suggestion: 'Consider updating to version "2.0.0"'
      });
    } else {
      results.push({
        category: 'Structure',
        test: 'Version field',
        status: 'pass',
        message: 'Version is valid'
      });
    }

    // 检查servers字段
    if (!config.servers || typeof config.servers !== 'object') {
      results.push({
        category: 'Structure',
        test: 'Servers configuration',
        status: 'error',
        message: 'Missing or invalid servers configuration',
        suggestion: 'Add a "servers" object to your configuration'
      });
    } else {
      results.push({
        category: 'Structure',
        test: 'Servers configuration',
        status: 'pass',
        message: 'Servers configuration is present'
      });
    }
  }

  private validateServers(servers: Record<string, any>, results: ValidationResult[]): void {
    const serverNames = Object.keys(servers);
    
    if (serverNames.length === 0) {
      results.push({
        category: 'Servers',
        test: 'At least one server configured',
        status: 'warning',
        message: 'No MCP servers configured',
        suggestion: 'Add at least one MCP server using "mcpdog config add" or "mcpdog config init"'
      });
      return;
    }

    results.push({
      category: 'Servers',
      test: 'Server count',
      status: 'pass',
      message: `${serverNames.length} server(s) configured`
    });

    // 验证每个服务器
    serverNames.forEach(name => {
      const server = servers[name];
      this.validateSingleServer(name, server, results);
    });
  }

  private validateSingleServer(name: string, server: any, results: ValidationResult[]): void {
    const category = `Server: ${name}`;

    // 必需字段检查
    const requiredFields = ['name', 'enabled', 'transport'];
    requiredFields.forEach(field => {
      if (server[field] === undefined) {
        results.push({
          category,
          test: `Required field: ${field}`,
          status: 'error',
          message: `Missing required field: ${field}`,
          suggestion: `Add "${field}" to server configuration`
        });
      }
    });

    // Transport特定验证
    if (server.transport === 'stdio') {
      if (!server.command) {
        results.push({
          category,
          test: 'Stdio command',
          status: 'error',
          message: 'stdio transport requires "command" field',
          suggestion: 'Add "command" field with the executable to run'
        });
      } else {
        results.push({
          category,
          test: 'Stdio configuration',
          status: 'pass',
          message: 'Stdio transport is properly configured'
        });
      }
    } else if (server.transport === 'http-sse' || server.transport === 'streamable-http') {
      if (!server.endpoint) {
        results.push({
          category,
          test: 'HTTP endpoint',
          status: 'error',
          message: `${server.transport} transport requires "endpoint" field`,
          suggestion: 'Add "endpoint" field with the server URL'
        });
      } else {
        try {
          new URL(server.endpoint);
          results.push({
            category,
            test: 'HTTP endpoint format',
            status: 'pass',
            message: 'Endpoint URL is valid'
          });
        } catch {
          results.push({
            category,
            test: 'HTTP endpoint format',
            status: 'error',
            message: 'Invalid endpoint URL format',
            suggestion: 'Ensure endpoint is a valid URL (e.g., https://api.example.com)'
          });
        }
      }
    }

    // 超时和重试配置检查
    if (server.timeout && (server.timeout < 1000 || server.timeout > 300000)) {
      results.push({
        category,
        test: 'Timeout value',
        status: 'warning',
        message: 'Timeout value should be between 1000ms and 300000ms',
        suggestion: 'Consider using a timeout between 10s and 60s for most use cases'
      });
    }

    if (server.retries && (server.retries < 0 || server.retries > 10)) {
      results.push({
        category,
        test: 'Retry count',
        status: 'warning',
        message: 'Retry count should be between 0 and 10',
        suggestion: 'Consider using 3-5 retries for most use cases'
      });
    }
  }

  private validateWebConfig(webConfig: any, results: ValidationResult[]): void {
    if (!webConfig) {
      results.push({
        category: 'Web',
        test: 'Web configuration',
        status: 'pass',
        message: 'Web interface is disabled (this is fine)'
      });
      return;
    }

    if (webConfig.enabled) {
      const port = webConfig.port || 3000;
      if (port < 1024 || port > 65535) {
        results.push({
          category: 'Web',
          test: 'Web port range',
          status: 'warning',
          message: `Web port ${port} is outside recommended range`,
          suggestion: 'Use a port between 3000-8080 for development, or standard HTTP ports for production'
        });
      } else {
        results.push({
          category: 'Web',
          test: 'Web configuration',
          status: 'pass',
          message: `Web interface configured on port ${port}`
        });
      }
    }
  }

  private validateBestPractices(config: any, results: ValidationResult[]): void {
    const servers = config.servers || {};
    const enabledServers = Object.values(servers).filter((s: any) => s.enabled);
    
    // 检查是否有启用的服务器
    if (enabledServers.length === 0) {
      results.push({
        category: 'Best Practices',
        test: 'Enabled servers',
        status: 'warning',
        message: 'No servers are enabled',
        suggestion: 'Enable at least one server using "mcpdog config enable <server-name>"'
      });
    }

    // 检查是否有描述信息
    const serversWithoutDescription = Object.entries(servers)
      .filter(([name, server]: [string, any]) => !server.description)
      .map(([name]) => name);

    if (serversWithoutDescription.length > 0) {
      results.push({
        category: 'Best Practices',
        test: 'Server descriptions',
        status: 'warning',
        message: `${serversWithoutDescription.length} server(s) missing descriptions`,
        suggestion: `Add descriptions to servers: ${serversWithoutDescription.join(', ')}`
      });
    }

    // 检查日志配置
    if (!config.logging || !config.logging.level) {
      results.push({
        category: 'Best Practices',
        test: 'Logging configuration',
        status: 'warning',
        message: 'No logging configuration specified',
        suggestion: 'Consider adding logging configuration for better debugging'
      });
    }
  }

  private displayValidationResults(results: ValidationResult[]): void {
    const categories = [...new Set(results.map(r => r.category))];
    
    categories.forEach(category => {
      console.log(`\n${CLIUtils.colorize(category, 'cyan')}:`);
      
      const categoryResults = results.filter(r => r.category === category);
      categoryResults.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : 
                    result.status === 'warning' ? '⚠️ ' : '❌';
        const color = result.status === 'pass' ? 'green' : 
                     result.status === 'warning' ? 'yellow' : 'red';
        
        console.log(`  ${icon} ${CLIUtils.colorize(result.test, color)}: ${result.message}`);
        
        if (result.suggestion) {
          console.log(`     💡 ${CLIUtils.colorize('Suggestion', 'cyan')}: ${result.suggestion}`);
        }
      });
    });
  }

  private showHelp(): void {
    console.log(`
${CLIUtils.colorize('mcpdog config', 'cyan')} - 配置管理

${CLIUtils.colorize('子命令:', 'yellow')}
  init                    Interactive configuration wizard
  validate                Validate configuration file
  list                    列出所有服务器配置
  add <name> <endpoint>   添加新服务器
  remove <name>           删除服务器
  update <name>           更新服务器配置
  show <name>             显示服务器详情
  enable <name>           启用服务器
  disable <name>          禁用服务器
  mcp-config              生成MCP客户端配置

${CLIUtils.colorize('add命令选项:', 'yellow')}
  --auto-detect          自动检测最佳协议
  --transport <type>     指定传输协议 (stdio|http-sse|streamable-http)
  --timeout <ms>         设置超时时间 (默认: 30000)
  --retries <num>        设置重试次数 (默认: 3)
  --headers <json>       HTTP头部信息 (JSON格式)
  --args <list>          stdio参数 (逗号分隔)
  --yes                  跳过确认提示

${CLIUtils.colorize('update命令选项:', 'yellow')}
  --endpoint <url>       更新端点地址
  --transport <type>     更新传输协议
  --timeout <ms>         更新超时时间
  --retries <num>        更新重试次数
  --description <text>   更新描述信息

${CLIUtils.colorize('示例:', 'yellow')}
  mcpdog config list
  mcpdog config add my-api https://api.example.com --auto-detect
  mcpdog config add stdio-server "node server.js" --transport stdio
  mcpdog config show my-api
  mcpdog config update my-api --timeout 60000
  mcpdog config remove old-server
  mcpdog config mcp-config                      # 生成MCP客户端配置
`);
  }
}