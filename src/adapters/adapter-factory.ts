import { MCPServerConfig, ServerAdapter } from '../types/index.js';
import { StdioAdapter } from './stdio-adapter.js';
import { HttpSseAdapter } from './http-sse-adapter.js';
import { StreamableHttpAdapter } from './streamable-http-adapter.js';

export class AdapterFactory {
  // List of sensitive environment variable keywords
  private static sensitiveKeywords = [
    'password', 'secret', 'key', 'token', 'auth', 'credential', 
    'pass', 'pwd', 'private', 'sensitive', 'security', 'api_key',
    'access_token', 'refresh_token', 'jwt', 'session'
  ];

  static createAdapter(name: string, config: MCPServerConfig): ServerAdapter {
    switch (config.transport) {
      case 'stdio':
        return new StdioAdapter(name, config);
      
      case 'http-sse':
        return new HttpSseAdapter(name, config);
      
      case 'streamable-http':
        return new StreamableHttpAdapter(name, config);
      
      default:
        throw new Error(`Unsupported transport type: ${config.transport} for ${name}`);
    }
  }

  static validateConfig(config: MCPServerConfig): string[] {
    const errors: string[] = [];

    // General validation
    if (!config.name) {
      errors.push('Server name is required');
    }

    if (!config.transport) {
      errors.push('Transport type is required');
    }

    // Transport type specific validation
    switch (config.transport) {
      case 'stdio':
        if (!config.command) {
          errors.push('Command is required for stdio transport');
        }
        
        // Validate environment variables (only needed for stdio transport)
        const envErrors = this.validateEnvironmentVariables(config.env);
        errors.push(...envErrors);
        break;

      case 'http-sse':
      case 'streamable-http':
        if (!config.endpoint) {
          errors.push(`Endpoint is required for ${config.transport} transport`);
        }
        
        // Validate URL format
        if (config.endpoint) {
          try {
            new URL(config.endpoint);
          } catch {
            errors.push(`Invalid endpoint URL: ${config.endpoint}`);
          }
        }
        break;
    }

    // Timeout config validation
    if (config.timeout && config.timeout <= 0) {
      errors.push('Timeout must be a positive number');
    }

    if (config.retries && config.retries < 0) {
      errors.push('Retries must be a non-negative number');
    }

    return errors;
  }

  /**
   * Validate environment variable configuration
   */
  static validateEnvironmentVariables(env?: Record<string, string>): string[] {
    const errors: string[] = [];

    if (!env) {
      return errors;
    }

    for (const [key, value] of Object.entries(env)) {
      // Validate environment variable name format
      if (!this.isValidEnvVarName(key)) {
        errors.push(`Invalid environment variable name: '${key}'. Names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      }

      // Validate environment variable value type
      if (typeof value !== 'string') {
        errors.push(`Environment variable '${key}' must have a string value, got ${typeof value}`);
      }

      // Check for empty values
      if (key.trim() === '') {
        errors.push('Environment variable names cannot be empty');
      }

      // Security check: warn about sensitive information (now only log warnings, do not block config)
      const warnings = this.checkSensitiveEnvVar(key, value);
      if (warnings.length > 0) {
        // Output security warnings to console, but do not treat as validation errors
        warnings.forEach(warning => {
          console.warn(`[SECURITY WARNING] ${warning} for server configuration`);
        });
      }

      // Check environment variable name length
      if (key.length > 255) {
        errors.push(`Environment variable name '${key}' is too long (max 255 characters)`);
      }

      // Check value length (avoid excessively large values)
      if (value && value.length > 10000) {
        errors.push(`Environment variable '${key}' value is too long (max 10000 characters)`);
      }
    }

    return errors;
  }

  /**
   * Check if environment variable name conforms to specification
   */
  static isValidEnvVarName(name: string): boolean {
    // Environment variable names should start with a letter or underscore, and contain only letters, numbers, and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Check for sensitive environment variables
   */
  static checkSensitiveEnvVar(key: string, value: string): string[] {
    const warnings: string[] = [];
    const lowerKey = key.toLowerCase();

    // Check if variable name contains sensitive keywords
    const containsSensitiveKeyword = this.sensitiveKeywords.some(keyword => 
      lowerKey.includes(keyword.toLowerCase())
    );

    if (containsSensitiveKeyword) {
      warnings.push(`Environment variable '${key}' appears to contain sensitive information`);
      
      // Check if value might be plain text password/key
      if (value && value.length > 0) {
        // Check if it's an obvious test value
        const testValues = ['test', 'demo', 'example', 'placeholder', 'your-key-here', 'replace-me'];
        const isTestValue = testValues.some(test => value.toLowerCase().includes(test));
        
        if (isTestValue) {
          warnings.push(`Environment variable '${key}' contains test/placeholder value. Please use real credentials.`);
        }
        
        // Check if value is too short (may not be a real key)
        if (value.length < 8) {
          warnings.push(`Environment variable '${key}' value seems too short for a secure credential`);
        }
      }
    }

    return warnings;
  }

  static getSupportedTransports(): string[] {
    return ['stdio', 'http-sse', 'streamable-http'];
  }

  static getTransportRequirements(transport: string): string[] {
    switch (transport) {
      case 'stdio':
        return ['command'];
      
      case 'http-sse':
      case 'streamable-http':
        return ['endpoint'];
      
      default:
        return [];
    }
  }
}