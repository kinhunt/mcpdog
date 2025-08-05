/**
 * CLI Utility Class - Provides common CLI functionalities
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CLIEnvironment {
  verbose: boolean;
  noColor: boolean;
  json: boolean;
}

export class CLIUtils {
  private static env: CLIEnvironment = {
    verbose: false,
    noColor: false,
    json: false
  };

  static setupEnvironment(config: Partial<CLIEnvironment>) {
    this.env = { ...this.env, ...config };
  }

  static isVerbose(): boolean {
    return this.env.verbose;
  }

  static isJsonMode(): boolean {
    return this.env.json;
  }

  // Color output (if enabled)
  static colorize(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'magenta'): string {
    if (this.env.noColor) return text;
    
    const colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
    
    return `${colors[color]}${text}\x1b[0m`;
  }

  // Log output
  static info(message: string, ...args: any[]) {
    if (this.env.json) return;
    console.log(this.colorize('ℹ', 'blue'), message, ...args);
  }

  static success(message: string, ...args: any[]) {
    if (this.env.json) return;
    console.log(this.colorize('✅', 'green'), message, ...args);
  }

  static warning(message: string, ...args: any[]) {
    if (this.env.json) return;
    console.log(this.colorize('⚠️', 'yellow'), message, ...args);
  }

  static warn(message: string, ...args: any[]) {
    this.warning(message, ...args);
  }

  static error(message: string, ...args: any[]) {
    if (this.env.json) return;
    console.error(this.colorize('❌', 'red'), message, ...args);
  }

  static verbose(message: string, ...args: any[]) {
    if (this.env.verbose && !this.env.json) {
      console.log(this.colorize('🔍', 'cyan'), message, ...args);
    }
  }

  // JSON output
  static jsonOutput(data: any) {
    if (this.env.json) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  // Version information
  static showVersion() {
    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      if (this.env.json) {
        this.jsonOutput({
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description
        });
      } else {
        console.log(`\n${this.colorize('🐕 MCPDog', 'cyan')} v${packageJson.version}`);
        console.log(`${packageJson.description}\n`);
      }
    } catch (error) {
      this.error('Failed to read version information');
    }
  }

  // Global help
  static showGlobalHelp() {
    if (this.env.json) {
      this.jsonOutput({
        usage: 'mcpdog <command> [options]',
        commands: this.getAvailableCommands()
      });
      return;
    }

    console.log(`
${this.colorize('🐕 MCPDog', 'cyan')} - Universal MCP Server Manager

${this.colorize('Usage:', 'yellow')}
  mcpdog <command> [options]

${this.colorize('Main Commands:', 'yellow')}
  ${this.colorize('start', 'green')}            Start MCPDog daemon (recommended)
  ${this.colorize('stop', 'green')}             Stop MCPDog daemon
  ${this.colorize('status', 'green')}           Check daemon status
  ${this.colorize('proxy', 'green')}            Connect to daemon as MCP client proxy

${this.colorize('Configuration:', 'yellow')}
  ${this.colorize('config', 'green')}           Configuration management
  ${this.colorize('detect', 'green')}           Protocol detection
  ${this.colorize('optimize', 'green')}         Performance optimization

${this.colorize('Diagnostics:', 'yellow')}
  ${this.colorize('diagnose', 'green')}         Diagnosis and repair
  ${this.colorize('audit', 'green')}            Configuration audit

${this.colorize('Advanced:', 'yellow')}
  ${this.colorize('daemon', 'green')}           Advanced daemon management
  ${this.colorize('serve', 'green')}            Legacy command (use 'proxy' instead)

${this.colorize('Global Options:', 'yellow')}
  -c, --config <path>    Configuration file path (default: ./mcpdog.config.json)
  -h, --help             Show help information
  -v, --version          Show version information
  --verbose              Verbose output
  --json                 JSON format output
  --no-color             Disable color output

${this.colorize('Quick Start:', 'yellow')}
  1. mcpdog start --config my-config.json    # Start daemon
  2. Configure MCP client with: mcpdog proxy
  3. mcpdog status                           # Check status

Use ${this.colorize('mcpdog <command> --help', 'cyan')} for specific command help
`);
  }

  private static getAvailableCommands() {
    return [
      { name: 'serve', description: 'Start MCP server' },
      { name: 'config', description: 'Configuration management' },
      { name: 'detect', description: 'Protocol detection' },
      { name: 'optimize', description: 'Performance optimization' },
      { name: 'diagnose', description: 'Diagnosis and repair' },
      { name: 'audit', description: 'Configuration audit' }
    ];
  }

  // Table output
  static printTable(headers: string[], rows: string[][]) {
    if (this.env.json) {
      const data = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
      this.jsonOutput(data);
      return;
    }

    // Calculate column widths
    const colWidths = headers.map((header, index) => {
      const maxContentWidth = Math.max(...rows.map(row => (row[index] || '').length));
      return Math.max(header.length, maxContentWidth) + 2;
    });

    // Print header row
    const headerRow = headers.map((header, index) => 
      header.padEnd(colWidths[index])
    ).join('│');
    console.log(`┌${colWidths.map(w => '─'.repeat(w)).join('┬')}┐`);
    console.log(`│${headerRow}│`);
    console.log(`├${colWidths.map(w => '─'.repeat(w)).join('┼')}┤`);

    // Print data rows
    rows.forEach(row => {
      const dataRow = row.map((cell, index) => 
        (cell || '').padEnd(colWidths[index])
      ).join('│');
      console.log(`│${dataRow}│`);
    });

    console.log(`└${colWidths.map(w => '─'.repeat(w)).join('┴')}┘`);
  }

  // Progress bar
  static showProgress(current: number, total: number, message: string = '') {
    if (this.env.json) return;
    
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    process.stdout.write(`\r${this.colorize('⏳', 'yellow')} ${bar} ${percentage}% ${message}`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  // Confirmation prompt
  static async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    if (this.env.json) return defaultValue;
    
    const { createInterface } = await import('readline');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    
    return new Promise((resolve) => {
      rl.question(`${this.colorize('❓', 'yellow')} ${message} (${defaultText}): `, (answer) => {
        rl.close();
        
        if (!answer.trim()) {
          resolve(defaultValue);
          return;
        }
        
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }
}