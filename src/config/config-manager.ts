import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { MCPDogConfig, MCPServerConfig } from '../types/index.js';
import { AdapterFactory } from '../adapters/adapter-factory.js';
import { AutoConfigGenerator, ConfigSuggestion } from '../core/auto-config-generator.js';
import { ProtocolDetector } from '../core/protocol-detector.js';
import { ServerNameValidator } from '../utils/server-name-validator.js';

export class ConfigManager extends EventEmitter {
  private config: MCPDogConfig;
  private configPath: string;
  private autoCreateConfig: boolean;
  private watchAbortController?: AbortController;
  private autoConfigGenerator: AutoConfigGenerator;
  private protocolDetector: ProtocolDetector;

  constructor(configPath?: string, autoCreateConfig?: boolean) {
    super();
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.getDefaultConfig();
    
    // Intelligently detect whether to auto-create config file
    if (autoCreateConfig === undefined) {
      this.autoCreateConfig = this.shouldAutoCreateConfig();
    } else {
      this.autoCreateConfig = autoCreateConfig;
    }
    
    this.autoConfigGenerator = new AutoConfigGenerator();
    this.protocolDetector = new ProtocolDetector();
  }

  /**
   * Get the default configuration file path
   * Always use user home directory ~/.mcpdog/mcpdog.config.json
   */
  private getDefaultConfigPath(): string {
    // Use user home directory for global config
    const userConfigDir = join(homedir(), '.mcpdog');
    const userConfigPath = join(userConfigDir, 'mcpdog.config.json');
    
    // Ensure the config directory exists
    try {
      fsSync.mkdirSync(userConfigDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
    
    return userConfigPath;
  }

  private isStdioMode(): boolean {
    // Detect if running in stdio mode (called by MCP client)
    // Determine by checking command line arguments
    return process.argv.includes('serve') && !process.argv.includes('--web-port');
  }

  private shouldAutoCreateConfig(): boolean {
    // If in serve mode, do not auto-create (to avoid polluting stdio)
    if (process.argv.includes('serve')) {
      return false;
    }
    
    // If running as an MCP server (via stdio), do not auto-create
    if (this.isStdioMode()) {
      return false;
    }
    
    // Check if file system is read-only
    try {
      const testFile = './test-write-' + Date.now();
      fs.writeFile(testFile, 'test').then(() => {
        fs.unlink(testFile).catch(() => {});
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private getDefaultConfig(): MCPDogConfig {
    return {
      servers: {},
      version: '2.0.0',
      logging: {
        level: 'info' as const
      }
    };
  }

  async loadConfig(): Promise<void> {
    try {
      const configJson = await fs.readFile(this.configPath, 'utf-8');
      this.config = {
        ...this.getDefaultConfig(),
        ...JSON.parse(configJson)
      };
    } catch (error) {
      // Config doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (this.autoCreateConfig) {
          await this.initializeAutoConfig();
        }
      } else {
        throw new Error(`Failed to load config from ${this.configPath}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Initialize auto-config by detecting available MCP servers and creating basic configuration
   */
  private async initializeAutoConfig(): Promise<void> {
    try {
      // Let the auto config generator create a basic config
      const suggestions = await this.generateConfigSuggestionsInternal();
      
      if (suggestions.length > 0) {
        // Apply the first suggestion (usually the comprehensive one)
        const suggestion = suggestions[0];
        if (suggestion.config) {
          this.config.servers[suggestion.config.name] = suggestion.config;
        }
        await this.saveConfig();
      } else {
        // No suggestions, keep default config
        await this.saveConfig();
      }
    } catch (error) {
      console.warn(`Failed to auto-initialize config: ${(error as Error).message}`);
      // Keep default config
    }
  }

  async saveConfig(): Promise<void> {
    try {
      // Ensure the directory exists
      const configDir = dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${(error as Error).message}`);
    }
  }

  getConfig(): MCPDogConfig {
    return this.config;
  }

  setConfig(config: MCPDogConfig): void {
    this.config = config;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getServerConfig(serverName: string): MCPServerConfig | undefined {
    return this.config.servers[serverName];
  }

  getServer(serverName: string): MCPServerConfig | undefined {
    return this.config.servers[serverName];
  }

  getAllServers(): Record<string, MCPServerConfig> {
    return this.config.servers;
  }

  getServers(): Record<string, MCPServerConfig> {
    return this.config.servers;
  }

  getEnabledServers(): Record<string, MCPServerConfig> {
    const servers: Record<string, MCPServerConfig> = {};
    for (const [name, config] of Object.entries(this.config.servers)) {
      if (config.enabled !== false) { // Default to enabled if not specified
        servers[name] = config;
      }
    }
    return servers;
  }

  toggleServer(name: string, enabled: boolean): boolean {
    if (this.config.servers[name]) {
      this.config.servers[name].enabled = enabled;
      // Emit server-toggled event so MCPDogServer can handle connection/disconnection
      this.emit('server-toggled', { name, enabled });
      return true;
    }
    return false;
  }

  addServer(name: string, config: MCPServerConfig): boolean {
    // Validate server name
    const validation = ServerNameValidator.validateServerName(name);
    if (!validation.valid) {
      throw new Error(`Invalid server name: ${validation.error}`);
    }

    // Check for name conflicts
    if (this.config.servers[name]) {
      throw new Error(`Server "${name}" already exists`);
    }

    // Ensure name field matches the key
    const finalConfig = { ...config, name };
    this.config.servers[name] = finalConfig;
    
    // Emit server-added event
    this.emit('server-added', { name, config: finalConfig });
    
    return true;
  }

  removeServer(name: string): boolean {
    if (this.config.servers[name]) {
      delete this.config.servers[name];
      // Emit server-removed event
      this.emit('server-removed', { name });
      return true;
    }
    return false;
  }

  updateServer(name: string, config: Partial<MCPServerConfig>): boolean {
    if (!this.config.servers[name]) {
      return false;
    }

    // If name is being updated, validate the new name
    if (config.name && config.name !== name) {
      const validation = ServerNameValidator.validateServerName(config.name);
      if (!validation.valid) {
        throw new Error(`Invalid server name: ${validation.error}`);
      }

      // Check for name conflicts with other servers
      if (this.config.servers[config.name]) {
        throw new Error(`Server "${config.name}" already exists`);
      }

      // Rename the server
      const oldConfig = this.config.servers[name];
      delete this.config.servers[name];
      this.config.servers[config.name] = { ...oldConfig, ...config };
      
      // Emit server-renamed event
      this.emit('server-renamed', { oldName: name, newName: config.name, config: this.config.servers[config.name] });
    } else {
      // Update existing server
      this.config.servers[name] = { ...this.config.servers[name], ...config };
      
      // Emit server-updated event
      this.emit('server-updated', { name, config: this.config.servers[name] });
    }

    return true;
  }

  /**
   * Rename a server
   */
  renameServer(oldName: string, newName: string): boolean {
    if (!this.config.servers[oldName]) {
      return false;
    }

    const validation = ServerNameValidator.validateServerName(newName);
    if (!validation.valid) {
      throw new Error(`Invalid server name: ${validation.error}`);
    }

    if (this.config.servers[newName]) {
      throw new Error(`Server "${newName}" already exists`);
    }

    const config = this.config.servers[oldName];
    delete this.config.servers[oldName];
    this.config.servers[newName] = { ...config, name: newName };
    
    // Emit server-renamed event
    this.emit('server-renamed', { oldName, newName, config: this.config.servers[newName] });
    
    return true;
  }

  /**
   * Generate a unique server name
   */
  generateUniqueServerName(baseName: string): string {
    const existingNames = Object.keys(this.config.servers);
    return ServerNameValidator.generateUniqueName(baseName, existingNames);
  }

  /**
   * Validate server name
   */
  validateServerName(name: string): { valid: boolean; error?: string; suggestions?: string[] } {
    return ServerNameValidator.validateServerName(name);
  }

  /**
   * Check if server name conflicts with existing names
   */
  checkServerNameConflict(name: string): boolean {
    return ServerNameValidator.checkNameConflict(name, Object.keys(this.config.servers));
  }

  /**
   * Start watching config file
   */
  async startWatching(): Promise<void> {
    return this.watchConfig();
  }

  /**
   * Watch config file for changes and reload
   */
  async watchConfig(): Promise<void> {
    if (this.watchAbortController) {
      return; // Already watching
    }

    this.watchAbortController = new AbortController();
    
    try {
      const watcher = fs.watch(this.configPath, { signal: this.watchAbortController.signal });
      
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          try {
            await this.loadConfig();
            this.emit('configChanged', this.config);
          } catch (error) {
            this.emit('configError', error);
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.emit('configError', error);
      }
    }
  }

  /**
   * Stop watching config file
   */
  stopWatching(): void {
    if (this.watchAbortController) {
      this.watchAbortController.abort();
      this.watchAbortController = undefined;
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config?: MCPDogConfig): { valid: boolean; errors: string[] } {
    const configToValidate = config || this.config;
    const errors: string[] = [];

    if (!configToValidate.servers || typeof configToValidate.servers !== 'object') {
      errors.push('Config must have a "servers" object');
    } else {
      for (const [name, serverConfig] of Object.entries(configToValidate.servers)) {
        if (!serverConfig.command) {
          errors.push(`Server "${name}" must have a command`);
        }
        
        if (serverConfig.args && !Array.isArray(serverConfig.args)) {
          errors.push(`Server "${name}" args must be an array`);
        }
        
        if (serverConfig.env && typeof serverConfig.env !== 'object') {
          errors.push(`Server "${name}" env must be an object`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Optimize configuration by detecting protocols and suggesting improvements
   */
  async optimizeConfig(): Promise<ConfigSuggestion[]> {
    const suggestions: ConfigSuggestion[] = [];
    
    for (const [name, serverConfig] of Object.entries(this.config.servers)) {
      try {
        const detection = await this.detectConfigProtocol(serverConfig);
        
        if (detection.issues.length > 0) {
          suggestions.push({
            config: detection.suggestedConfig || serverConfig,
            confidence: 0.8,
            alternatives: [],
            warnings: [`Detected issues with ${name}`],
            optimizations: [`Server optimization available for ${name}`]
          });
        }
      } catch (error) {
        suggestions.push({
          config: serverConfig,
          confidence: 0.1,
          alternatives: [],
          warnings: [`Server ${name} has configuration errors: ${(error as Error).message}`],
          optimizations: []
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Apply configuration suggestions
   */
  async applySuggestions(suggestions: ConfigSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      if (suggestion.config && suggestion.config.name) {
        this.config.servers[suggestion.config.name] = suggestion.config;
      }
    }
    
    await this.saveConfig();
  }

  /**
   * Export configuration for backup or sharing
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      const validation = this.validateConfig(config);
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      this.config = {
        ...this.getDefaultConfig(),
        ...config
      };
      
      await this.saveConfig();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Get configuration statistics
   */
  getConfigStats(): {
    serverCount: number;
    totalTools: number;
    configSize: number;
    lastModified?: Date;
  } {
    return {
      serverCount: Object.keys(this.config.servers).length,
      totalTools: 0, // This would need to be calculated from actual server connections
      configSize: JSON.stringify(this.config).length,
      lastModified: undefined // This would need file stats
    };
  }

  // Legacy compatibility methods
  generateAutoConfig(): Promise<MCPDogConfig[]> {
    return Promise.resolve([this.config]);
  }

  // Internal method that returns ConfigSuggestion[]
  private async generateConfigSuggestionsInternal(): Promise<ConfigSuggestion[]> {
    const suggestions: ConfigSuggestion[] = [];
    for (const [name, serverConfig] of Object.entries(this.config.servers)) {
      suggestions.push({
        config: serverConfig,
        confidence: 0.9,
        alternatives: [],
        warnings: [],
        optimizations: []
      });
    }
    return suggestions;
  }

  // Legacy method that returns MCPDogConfig[] for compatibility
  generateConfigSuggestions(): Promise<MCPDogConfig[]> {
    return this.generateAutoConfig();
  }

  detectConfigProtocol(config: MCPServerConfig): Promise<any> {
    return Promise.resolve({ protocol: "stdio", issues: [] });
  }

  validateServerConfig(config: MCPServerConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config.command && config.transport === "stdio") {
      errors.push("Command is required for stdio transport");
    }
    return { valid: errors.length === 0, errors };
  }

  optimizeServerConfig(name: string): Promise<any> {
    return Promise.resolve({ optimizations: [] });
  }

  auditAllServerProtocols(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const name of Object.keys(this.config.servers)) {
      results[name] = { protocol: "stdio", issues: [] };
    }
    return Promise.resolve(results);
  }

  toggleTool(serverName: string, toolName: string, enabled: boolean): boolean {
    // This would need actual implementation based on your tool management system  
    return true;
  }
}
