import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: 'stdout' | 'stderr' | 'system';
  serverName: string;
}

export interface ServerLogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  lastActivity: string;
  isConnected: boolean;
  connectionAttempts: number;
  lastError?: string;
}

export class ServerLogManager extends EventEmitter {
  private logs = new Map<string, LogEntry[]>();
  private maxLogsPerServer = 1000;
  private logStats = new Map<string, ServerLogStats>();

  constructor(maxLogsPerServer = 1000) {
    super();
    this.maxLogsPerServer = maxLogsPerServer;
  }

  /**
   * Add log entry
   */
  addLog(serverName: string, level: LogEntry['level'], message: string, source: LogEntry['source'] = 'system'): void {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      source,
      serverName
    };

    // Get or create server log array
    if (!this.logs.has(serverName)) {
      this.logs.set(serverName, []);
    }

    const serverLogs = this.logs.get(serverName)!;
    serverLogs.push(logEntry);

    // Limit log count
    if (serverLogs.length > this.maxLogsPerServer) {
      serverLogs.splice(0, serverLogs.length - this.maxLogsPerServer);
    }

    // Update statistics
    this.updateStats(serverName, logEntry);

    // Emit log event
    this.emit('log-added', { serverName, logEntry });

    // If it's an error, emit error event
    if (level === 'error') {
      this.emit('server-error', { serverName, message, timestamp });
    }
  }

  /**
   * Get server logs
   */
  getLogs(serverName: string, limit?: number): LogEntry[] {
    const logs = this.logs.get(serverName) || [];
    if (limit && limit > 0) {
      return logs.slice(-limit);
    }
    return [...logs];
  }

  /**
   * Get recent logs for all servers
   */
  getAllRecentLogs(limit = 50): LogEntry[] {
    const allLogs: LogEntry[] = [];
    
    for (const [serverName, logs] of this.logs) {
      allLogs.push(...logs);
    }

    // Sort by time and limit quantity
    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get server statistics
   */
  getStats(serverName: string): ServerLogStats | undefined {
    return this.logStats.get(serverName);
  }

  /**
   * Get all server statistics
   */
  getAllStats(): Map<string, ServerLogStats> {
    return new Map(this.logStats);
  }

  /**
   * Clear server logs
   */
  clearLogs(serverName: string): void {
    this.logs.delete(serverName);
    this.logStats.delete(serverName);
    this.emit('logs-cleared', { serverName });
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    this.logs.clear();
    this.logStats.clear();
    this.emit('all-logs-cleared');
  }

  /**
   * Log server connection status changes
   */
  updateConnectionStatus(serverName: string, isConnected: boolean, error?: string): void {
    const stats = this.getOrCreateStats(serverName);
    const wasConnected = stats.isConnected;
    
    stats.isConnected = isConnected;
    stats.lastActivity = new Date().toISOString();

    if (!isConnected) {
      stats.connectionAttempts++;
      if (error) {
        stats.lastError = error;
        this.addLog(serverName, 'error', `Connection failed: ${error}`, 'system');
      }
    } else if (!wasConnected) {
      this.addLog(serverName, 'info', 'Server connected successfully', 'system');
    }

    this.emit('connection-status-changed', { serverName, isConnected, stats });
  }

  /**
   * Log server output
   */
  addServerOutput(serverName: string, data: string, source: 'stdout' | 'stderr'): void {
    const lines = data.toString().split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      const level = source === 'stderr' ? 'error' : 'info';
      this.addLog(serverName, level, line.trim(), source);
    }
  }

  /**
   * Search logs
   */
  searchLogs(serverName: string, query: string, options?: {
    level?: LogEntry['level'];
    source?: LogEntry['source'];
    limit?: number;
  }): LogEntry[] {
    const logs = this.logs.get(serverName) || [];
    const searchQuery = query.toLowerCase();
    
    let filteredLogs = logs.filter(log => {
      const matchesQuery = log.message.toLowerCase().includes(searchQuery);
      const matchesLevel = !options?.level || log.level === options.level;
      const matchesSource = !options?.source || log.source === options.source;
      
      return matchesQuery && matchesLevel && matchesSource;
    });

    if (options?.limit && options.limit > 0) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs;
  }

  /**
   * Export logs as text format
   */
  exportLogs(serverName: string, format: 'json' | 'text' = 'text'): string {
    const logs = this.logs.get(serverName) || [];
    
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // Text format
    return logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const source = log.source ? `[${log.source.toUpperCase()}]` : '';
      const level = `[${log.level.toUpperCase()}]`;
      return `${timestamp} ${level} ${source} ${log.message}`;
    }).join('\n');
  }

  private updateStats(serverName: string, logEntry: LogEntry): void {
    const stats = this.getOrCreateStats(serverName);
    
    stats.totalLogs++;
    stats.lastActivity = logEntry.timestamp;

    switch (logEntry.level) {
      case 'error':
        stats.errorCount++;
        stats.lastError = logEntry.message;
        break;
      case 'warn':
        stats.warnCount++;
        break;
    }
  }

  private getOrCreateStats(serverName: string): ServerLogStats {
    if (!this.logStats.has(serverName)) {
      this.logStats.set(serverName, {
        totalLogs: 0,
        errorCount: 0,
        warnCount: 0,
        lastActivity: new Date().toISOString(),
        isConnected: false,
        connectionAttempts: 0
      });
    }
    return this.logStats.get(serverName)!;
  }
}

// Global log manager instance
export const globalLogManager = new ServerLogManager();