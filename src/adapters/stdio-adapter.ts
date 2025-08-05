import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { MCPServerConfig, MCPTool, MCPRequest, MCPResponse, ServerAdapter } from '../types/index.js';
import { globalLogManager } from '../logging/server-log-manager.js';

export class StdioAdapter extends EventEmitter implements ServerAdapter {
  public readonly name: string;
  public readonly config: MCPServerConfig;
  public isConnected: boolean = false;

  private process?: ChildProcess;
  private requestId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private buffer: string = '';
  
  // Process stability monitoring
  private crashCount: number = 0;
  private lastCrashTime: number = 0;
  private isRecovering: boolean = false;
  private crashHistory: number[] = []; // Crash time history
  private isBlacklisted: boolean = false; // Whether blacklisted
  private blacklistUntil: number = 0; // Blacklist release time
  private isDisabled: boolean = false; // Whether disabled, should not auto-reconnect if disabled

  constructor(name: string, config: MCPServerConfig) {
    super();
    this.name = name;
    this.config = config;

    if (config.transport !== 'stdio') {
      throw new Error(`Invalid transport for StdioAdapter: ${config.transport}`);
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.error(`[${this.name}] Already connected, skipping connect() call.`);
      return;
    }

    if (this.isDisabled) {
      console.error(`[${this.name}] Adapter is disabled, skipping connect() call.`);
      throw new Error(`Adapter ${this.name} is disabled.`);
    }

    if (this.isBlacklisted) {
      const remaining = Math.ceil((this.blacklistUntil - Date.now()) / 1000);
      console.error(`[${this.name}] Adapter is blacklisted for ${remaining}s, skipping connect() call.`);
      throw new Error(`Adapter ${this.name} is blacklisted.`);
    }

    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    try {
      console.error(`[${this.name}] Attempting to connect via stdio: ${this.config.command} ${this.config.args?.join(' ') || ''}`);

      // Environment variable debug log
      this.logEnvironmentVariables();

      // Prepare process environment variables
      const processEnv = { 
        ...process.env, 
        ...this.config.env 
      };

      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.cwd,
        env: processEnv
      });

      this.setupProcessHandlers();
      
      // Initialize handshake
      await this.initialize();
      
      // Mark as connected, let router manage tool list fetching
      this.isConnected = true;
      console.error(`[${this.name}] Connected successfully.`);
      globalLogManager.updateConnectionStatus(this.name, true);
      globalLogManager.addLog(this.name, 'info', `MCP server connected successfully (command: ${this.config.command}, args: ${this.config.args?.join(' ') || 'none'})`, 'system');
      this.emit('connected', { serverName: this.name });

    } catch (error) {
      this.cleanup();
      const errorMsg = `[${this.name}] Failed to connect: ${(error as Error).message}`;
      console.error(errorMsg);
      globalLogManager.updateConnectionStatus(this.name, false, errorMsg);
      throw new Error(errorMsg);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      console.error(`[${this.name}] Already disconnected, skipping disconnect() call.`);
      globalLogManager.addLog(this.name, 'warn', 'Disconnect called but server already disconnected', 'system');
      return;
    }

    console.error(`[${this.name}] Attempting to disconnect...`);
    globalLogManager.addLog(this.name, 'info', 'Initiating disconnect...', 'system');
    
    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    this.cleanup();
    this.isConnected = false;
    
    console.error(`[${this.name}] Disconnected successfully.`);
    globalLogManager.updateConnectionStatus(this.name, false);
    globalLogManager.addLog(this.name, 'info', 'MCP server disconnected successfully', 'system');
    this.emit('disconnected', { serverName: this.name });
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data: Buffer) => {
      const stdout = data.toString();
      // Only log non-JSON response messages to log manager, avoid duplication
      const lines = stdout.trim().split('\n');
      const nonJsonLines = lines.filter(line => {
        try {
          JSON.parse(line.trim());
          return false; // This is a JSON message, do not log
        } catch {
          return true; // This is not JSON, log it
        }
      });
      
      if (nonJsonLines.length > 0) {
        globalLogManager.addServerOutput(this.name, nonJsonLines.join('\n'), 'stdout');
        this.emit('log', { stream: 'stdout', data: nonJsonLines.join('\n') });
      }
      
      this.handleStdoutData(stdout);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const stderr = data.toString();
      // Log to log manager
      globalLogManager.addServerOutput(this.name, stderr, 'stderr');
      this.emit('log', { stream: 'stderr', data: stderr }); // Ensure all output is sent to frontend
      
      // Detect browsermcp stack overflow errors
      if (stderr.includes('Maximum call stack size exceeded') || 
          stderr.includes('RangeError')) {
        console.error(`⚠️ ${this.name} detected stack overflow, will auto-restart on next request`);
        globalLogManager.addLog(this.name, 'warn', 'Stack overflow detected, will auto-restart on next request', 'system');
      }
    });

    this.process.on('error', (error: Error) => {
      console.error(`${this.name} process error:`, error);
      globalLogManager.addLog(this.name, 'error', `Process error: ${error.message}`, 'system');
      this.emit('error', { error, context: `${this.name}-process` });
    });

    this.process.on('exit', (code: number | null, signal: string | null) => {
      console.error(`[${this.name}] Process exited with code ${code}, signal ${signal}.`);
      globalLogManager.addLog(this.name, 'error', `Process exited with code ${code}, signal ${signal}`, 'system');
      
      // Log crash history
      const now = Date.now();
      this.crashCount++;
      this.lastCrashTime = now;
      this.crashHistory.push(now);
      
      // Only keep crash records for the last 5 minutes
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      this.crashHistory = this.crashHistory.filter(time => time > fiveMinutesAgo);
      
      if (signal === 'SIGKILL') {
        const killMsg = `⚠️  Process was killed with SIGKILL - likely due to internal errors or resource issues. Crash count: ${this.crashCount} (${this.crashHistory.length} in last 5min)`;
        console.error(`[${this.name}] ${killMsg}`);
        globalLogManager.addLog(this.name, 'error', killMsg, 'system');
      }
      
      // Check if blacklisting is needed
      this.checkAndUpdateBlacklist();
      
      this.isConnected = false;
      globalLogManager.updateConnectionStatus(this.name, false, `Process exited: code=${code}, signal=${signal}`);
      this.emit('disconnected', { 
        serverName: this.name,
        error: new Error(`Process exited: code=${code}, signal=${signal}`)
      });
      
      // Smart reconnect strategy
      if (this.shouldAttemptReconnect(signal)) {
        const delay = this.getReconnectDelay();
        const reconnectMsg = `🔄 Will attempt reconnect in ${delay}ms`;
        console.error(`[${this.name}] ${reconnectMsg}`);
        globalLogManager.addLog(this.name, 'info', reconnectMsg, 'system');
        
        setTimeout(() => {
          this.attemptRecovery();
        }, delay);
      } else {
        const noReconnectMsg = '🚫 Not attempting reconnect';
        console.error(`[${this.name}] ${noReconnectMsg}`);
        globalLogManager.addLog(this.name, 'warn', noReconnectMsg, 'system');
      }
    });
  }

  private handleStdoutData(data: string): void {
    this.buffer += data;
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep the last incomplete line

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          console.error(`Failed to parse message from ${this.name}:`, line);
        }
      }
    }
  }

  private handleMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      // This is a response to a request
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      clearTimeout(pending.timeout);
      
      // Log response details (but not the raw JSON)
      if (message.error) {
        globalLogManager.addLog(this.name, 'error', `Method response error (ID: ${message.id}): ${JSON.stringify(message.error)}`, 'system');
      } else {
        globalLogManager.addLog(this.name, 'info', `Method response success (ID: ${message.id}): ${message.result ? 'with result' : 'no result'}`, 'system');
      }
      
      pending.resolve(message as MCPResponse);
    } else if (!message.id && message.method) {
      // This is a notification
      this.handleNotification(message);
    }
  }

  private handleNotification(notification: any): void {
    console.error(`Notification from ${this.name}:`, notification.method);
    globalLogManager.addLog(this.name, 'info', `Notification received: ${notification.method}`, 'system');
    
    if (notification.method === 'notifications/tools/list_changed') {
      // Tool list changed, notify router for unified handling
      globalLogManager.addLog(this.name, 'info', 'Tools list changed, notifying router', 'system');
      this.emit('tools-changed', { serverName: this.name });
    }
    
    // Forward notification to upper layer
    this.emit('notification', { serverName: this.name, notification });
  }

  private async initialize(): Promise<void> {
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'mcpdog',
          version: '2.0.0'
        }
      }
    };

    const response = await this.sendRequest(initRequest);
    
    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Send initialized notification
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    this.sendNotification(initializedNotification);
  }


  async getTools(): Promise<MCPTool[]> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new Error(`Failed to get tools: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  async callTool(name: string, args: any): Promise<MCPResponse> {
    const startTime = Date.now();
    globalLogManager.addLog(this.name, 'info', `Calling tool: ${name} with args: ${JSON.stringify(args, null, 2)}`, 'system');
    
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    try {
      const response = await this.sendRequest(request);
      const duration = Date.now() - startTime;
      
      if (response.error) {
        globalLogManager.addLog(this.name, 'error', `Tool call failed: ${name} (duration: ${duration}ms, error: ${JSON.stringify(response.error)})`, 'system');
      } else {
        globalLogManager.addLog(this.name, 'info', `Tool call successful: ${name} (duration: ${duration}ms)`, 'system');
        if (response.result?.content) {
          globalLogManager.addLog(this.name, 'debug', `Tool result: ${JSON.stringify(response.result.content, null, 2)}`, 'system');
        }
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      globalLogManager.addLog(this.name, 'error', `Tool call exception: ${name} (duration: ${duration}ms, error: ${(error as Error).message})`, 'system');
      throw error;
    }
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    // Log outgoing request
    globalLogManager.addLog(this.name, 'debug', `Sending request: ${request.method} (ID: ${request.id})`, 'system');
    
    // Check process status, try to reconnect if dead
    if (!this.process?.stdin || this.process.killed || this.process.exitCode !== null) {
      console.error(`${this.name} process is dead, attempting reconnection...`);
      globalLogManager.addLog(this.name, 'warn', 'Process is dead, attempting reconnection...', 'system');
      try {
        await this.connect();
        globalLogManager.addLog(this.name, 'info', 'Reconnection successful', 'system');
      } catch (error) {
        const errorMsg = `Failed to reconnect to ${this.name}: ${(error as Error).message}`;
        globalLogManager.addLog(this.name, 'error', errorMsg, 'system');
        throw new Error(errorMsg);
      }
    }
    
    if (!this.process?.stdin) {
      const errorMsg = `Not connected to ${this.name}`;
      globalLogManager.addLog(this.name, 'error', errorMsg, 'system');
      throw new Error(errorMsg);
    }

    const startTime = Date.now();
    return new Promise<MCPResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        const timeoutMsg = `Request timeout for ${this.name} (method: ${request.method}, timeout: ${this.config.timeout || 30000}ms)`;
        globalLogManager.addLog(this.name, 'error', timeoutMsg, 'system');
        reject(new Error(timeoutMsg));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(request.id, {
        resolve: (response: MCPResponse) => {
          const duration = Date.now() - startTime;
          globalLogManager.addLog(this.name, 'debug', `Request completed: ${request.method} (ID: ${request.id}, duration: ${duration}ms)`, 'system');
          resolve(response);
        },
        reject: (error: Error) => {
          const duration = Date.now() - startTime;
          globalLogManager.addLog(this.name, 'error', `Request failed: ${request.method} (ID: ${request.id}, duration: ${duration}ms, error: ${error.message})`, 'system');
          reject(error);
        },
        timeout
      });

      try {
        const requestStr = JSON.stringify(request) + '\n';
        this.process!.stdin!.write(requestStr);
      } catch (error) {
        this.pendingRequests.delete(request.id);
        clearTimeout(timeout);
        const errorMsg = `Failed to send request to ${this.name}: ${(error as Error).message}`;
        globalLogManager.addLog(this.name, 'error', errorMsg, 'system');
        reject(new Error(errorMsg));
      }
    });
  }

  private sendNotification(notification: any): void {
    if (!this.isConnected || !this.process?.stdin) {
      return;
    }

    try {
      const notificationStr = JSON.stringify(notification) + '\n';
      this.process.stdin.write(notificationStr);
    } catch (error) {
      console.error(`Failed to send notification to ${this.name}:`, error);
    }
  }

  private getNextRequestId(): number {
    return this.requestId++;
  }

  private cleanup(): void {
    if (this.process) {
      try {
        if (!this.process.killed) {
          this.process.kill('SIGTERM');
        }
        
        // If process does not end within 2 seconds, force kill
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 2000);
      } catch (error) {
        console.error(`Error killing process for ${this.name}:`, error);
      }
      
      this.process = undefined;
    }

    this.buffer = '';
  }

  // Get current tool list (fetch in real-time from server)
  async getCachedTools(): Promise<MCPTool[]> {
    if (!this.isConnected) return [];
    return await this.getTools();
  }

  // Check if specific tool is available (check in real-time from server)
  async hasTools(toolName: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const tools = await this.getTools();
    return tools.some(tool => tool.name === toolName);
  }

  // Get connection status information
  getStatus(): {
    name: string;
    connected: boolean;
    toolCount: number;
    pendingRequests: number;
    crashCount: number;
    recentCrashes: number;
    isBlacklisted: boolean;
    blacklistRemaining?: number;
  } {
    const now = Date.now();
    return {
      name: this.name,
      connected: this.isConnected,
      toolCount: 0, // Tool count managed by router
      pendingRequests: this.pendingRequests.size,
      crashCount: this.crashCount,
      recentCrashes: this.crashHistory.length,
      isBlacklisted: this.isBlacklisted,
      blacklistRemaining: this.isBlacklisted ? Math.max(0, this.blacklistUntil - now) : undefined
    };
  }

  // Manually clear blacklist (admin function)
  clearBlacklist(): void {
    if (this.isBlacklisted) {
      console.error(`🟢 Manually clearing blacklist for ${this.name}`);
      this.isBlacklisted = false;
      this.blacklistUntil = 0;
      this.crashCount = 0;
      this.crashHistory = [];
    }
  }

  // Get crash statistics
  getCrashStats(): {
    totalCrashes: number;
    recentCrashes: number;
    crashHistory: string[];
    isBlacklisted: boolean;
    nextAttemptIn?: number;
  } {
    const now = Date.now();
    return {
      totalCrashes: this.crashCount,
      recentCrashes: this.crashHistory.length,
      crashHistory: this.crashHistory.map(time => new Date(time).toISOString()),
      isBlacklisted: this.isBlacklisted,
      nextAttemptIn: this.isBlacklisted ? Math.max(0, this.blacklistUntil - now) : undefined
    };
  }

  // Check and update blacklist status
  private checkAndUpdateBlacklist(): void {
    const now = Date.now();
    
    // Check if blacklisted and time not yet reached
    if (this.isBlacklisted && now < this.blacklistUntil) {
      return;
    }
    
    // If blacklist time has passed, remove from blacklist
    if (this.isBlacklisted && now >= this.blacklistUntil) {
      console.error(`🟢 ${this.name} removed from blacklist, allowing reconnection`);
      this.isBlacklisted = false;
      this.blacklistUntil = 0;
      // Reset some statistics
      this.crashCount = Math.max(0, this.crashCount - 2);
    }
    
    // Check if blacklisting is needed
    const recentCrashes = this.crashHistory.length;
    
    if (recentCrashes >= 5) {
      // More than 5 crashes in 5 minutes, blacklist for 30 minutes
      this.isBlacklisted = true;
      this.blacklistUntil = now + 30 * 60 * 1000; // 30 minutes
      console.error(`🔴 ${this.name} blacklisted for 30 minutes due to ${recentCrashes} crashes in 5 minutes`);
    } else if (recentCrashes >= 3) {
      // More than 3 crashes in 5 minutes, blacklist for 10 minutes
      this.isBlacklisted = true;
      this.blacklistUntil = now + 10 * 60 * 1000; // 10 minutes
      console.error(`🟡 ${this.name} blacklisted for 10 minutes due to ${recentCrashes} crashes in 5 minutes`);
    }
  }

  // Smart reconnect strategy
  private shouldAttemptReconnect(signal: string | null): boolean {
    // If server is disabled, should not auto-reconnect
    if (this.isDisabled) {
      console.error(`❌ ${this.name} is disabled, no auto-reconnect`);
      return false;
    }

    // If already recovering, do not try again
    if (this.isRecovering) {
      return false;
    }

    // Check blacklist status
    const now = Date.now();
    if (this.isBlacklisted && now < this.blacklistUntil) {
      const remainingMinutes = Math.ceil((this.blacklistUntil - now) / (60 * 1000));
      console.error(`❌ ${this.name} is blacklisted for ${remainingMinutes} more minutes, no auto-reconnect`);
      return false;
    }

    // If recent crashes are too frequent, be cautious even if not blacklisted
    if (this.crashHistory.length >= 2) {
      const lastTwoCrashes = this.crashHistory.slice(-2);
      const timeBetweenCrashes = lastTwoCrashes[1] - lastTwoCrashes[0];
      
      // If two crashes are less than 30 seconds apart, pause reconnect
      if (timeBetweenCrashes < 30 * 1000) {
        console.error(`⏸️ ${this.name} crashing too quickly (${Math.round(timeBetweenCrashes/1000)}s apart), pausing auto-reconnect`);
        return false;
      }
    }

    // Only SIGKILL or other abnormal exits require reconnect
    return signal === 'SIGKILL' || signal === 'SIGTERM' || signal === null;
  }

  private getReconnectDelay(): number {
    // Adjust delay strategy based on crash history
    const recentCrashes = this.crashHistory.length;
    const baseDelay = 2000; // 2 second base delay
    
    let delay = baseDelay;
    
    // Adjust delay based on recent crash count
    if (recentCrashes >= 4) {
      delay = 60000; // 1 minute
    } else if (recentCrashes >= 3) {
      delay = 30000; // 30 seconds
    } else if (recentCrashes >= 2) {
      delay = 10000; // 10 seconds
    } else {
              delay = baseDelay; // 2 seconds
    }
    
    // If frequent crashes, add random delay to avoid thundering herd effect
    if (recentCrashes >= 2) {
      const randomDelay = Math.random() * delay * 0.5; // 0-50% random delay
      delay += randomDelay;
    }
    
    return Math.round(delay);
  }

  private async attemptRecovery(): Promise<void> {
    if (this.isRecovering || this.isConnected) {
      return;
    }

    this.isRecovering = true;
    console.error(`🔧 ${this.name} attempting recovery (attempt ${this.crashCount})`);

    try {
      // Clean up old state
      this.cleanup();
      
      // Wait a bit for system resources to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to reconnect
      await this.connect();
      
      console.error(`✅ ${this.name} recovered successfully`);
      
      // Reset crash counter (after successful connection)
      if (this.isConnected) {
        this.crashCount = Math.max(0, this.crashCount - 1);
      }
      
    } catch (error) {
      console.error(`❌ ${this.name} recovery failed:`, (error as Error).message);
    } finally {
      this.isRecovering = false;
    }
  }

  // Manually trigger recovery (for external calls)
  async forceReconnect(): Promise<void> {
    console.error(`🔄 Force reconnecting ${this.name}...`);
    this.crashCount = 0; // Reset counter
    await this.disconnect();
    await this.attemptRecovery();
  }

  // Disable adapter, prevent auto-reconnect
  disable(): void {
    console.error(`🚫 Disabling ${this.name} - no auto-reconnect`);
    this.isDisabled = true;
  }

  // Re-enable adapter, allow auto-reconnect
  enable(): void {
    console.error(`✅ Enabling ${this.name} - auto-reconnect allowed`);
    this.isDisabled = false;
  }

  /**
   * Log environment variable debug information
   */
  private logEnvironmentVariables(): void {
    const configEnv = this.config.env;
    
    if (!configEnv || Object.keys(configEnv).length === 0) {
      console.error(`[${this.name}] 🔧 No custom environment variables configured`);
      return;
    }

    console.error(`[${this.name}] 🔧 Environment Variables Configuration:`);
    
    // Statistics
    const envKeys = Object.keys(configEnv);
    console.error(`[${this.name}] 📊 Total custom environment variables: ${envKeys.length}`);
    
    // Detailed log (safely, without showing sensitive values)
    envKeys.forEach(key => {
      const value = configEnv[key];
      const isSensitive = this.isSensitiveEnvVar(key);
      
      if (isSensitive) {
        console.error(`[${this.name}] 🔐 ${key}=[REDACTED] (${value.length} chars, sensitive)`);
      } else {
        // For non-sensitive variables, also limit display length
        const displayValue = value.length > 50 ? `${value.substring(0, 47)}...` : value;
        console.error(`[${this.name}] 🔧 ${key}=${displayValue}`);
      }
    });

    // Environment variable override check
    const systemEnvKeys = Object.keys(process.env);
    const overriddenKeys = envKeys.filter(key => systemEnvKeys.includes(key));
    
    if (overriddenKeys.length > 0) {
      console.error(`[${this.name}] ⚠️  Overriding ${overriddenKeys.length} system environment variables: ${overriddenKeys.join(', ')}`);
    }

    // Working directory information
    if (this.config.cwd) {
      console.error(`[${this.name}] 📁 Working directory: ${this.config.cwd}`);
    } else {
      console.error(`[${this.name}] 📁 Working directory: ${process.cwd()} (default)`);
    }
  }

  /**
   * Check if environment variable is sensitive
   */
  private isSensitiveEnvVar(key: string): boolean {
    const sensitiveKeywords = [
      'password', 'secret', 'key', 'token', 'auth', 'credential', 
      'pass', 'pwd', 'private', 'sensitive', 'security', 'api_key',
      'access_token', 'refresh_token', 'jwt', 'session'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
  }
}