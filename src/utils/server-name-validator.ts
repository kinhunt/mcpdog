/**
 * Server Name Validator
 * Provides unified validation and naming conventions for MCP server names
 */

export interface ServerNameValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

export class ServerNameValidator {
  // Server name regex pattern - only letters, numbers, hyphens, and underscores
  private static readonly SERVER_NAME_PATTERN = /^[a-zA-Z0-9\-_]+$/;
  
  // Maximum length for server names
  private static readonly MAX_NAME_LENGTH = 50;
  
  // Minimum length for server names
  private static readonly MIN_NAME_LENGTH = 1;

  /**
   * Validate server name according to best practices
   */
  static validateServerName(name: string): ServerNameValidationResult {
    // Check if name is empty
    if (!name || name.trim() === '') {
      return {
        valid: false,
        error: 'Server name cannot be empty'
      };
    }

    // Check minimum length
    if (name.length < this.MIN_NAME_LENGTH) {
      return {
        valid: false,
        error: `Server name must be at least ${this.MIN_NAME_LENGTH} character long`
      };
    }

    // Check maximum length
    if (name.length > this.MAX_NAME_LENGTH) {
      return {
        valid: false,
        error: `Server name too long (max ${this.MAX_NAME_LENGTH} characters)`
      };
    }

    // Check pattern (only letters, numbers, hyphens, and underscores)
    if (!this.SERVER_NAME_PATTERN.test(name)) {
      return {
        valid: false,
        error: 'Server name can only contain letters, numbers, hyphens, and underscores',
        suggestions: this.generateSuggestions(name)
      };
    }

    // Check for reserved names
    if (this.isReservedName(name)) {
      return {
        valid: false,
        error: `"${name}" is a reserved name and cannot be used`
      };
    }

    return { valid: true };
  }

  /**
   * Generate suggestions for invalid server names
   */
  private static generateSuggestions(invalidName: string): string[] {
    const suggestions: string[] = [];

    // Remove special characters and replace with hyphens
    let cleaned = invalidName
      .replace(/[^a-zA-Z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (cleaned && this.SERVER_NAME_PATTERN.test(cleaned)) {
      suggestions.push(cleaned);
    }

    // Convert to lowercase and replace spaces with hyphens
    let lowerCase = invalidName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');

    if (lowerCase && this.SERVER_NAME_PATTERN.test(lowerCase)) {
      suggestions.push(lowerCase);
    }

    // Add common patterns
    if (invalidName.includes(' ')) {
      const words = invalidName.split(/\s+/).filter(word => word.length > 0);
      if (words.length > 0) {
        const joined = words.join('-').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
        if (joined && this.SERVER_NAME_PATTERN.test(joined)) {
          suggestions.push(joined);
        }
      }
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Check if a name is reserved
   */
  private static isReservedName(name: string): boolean {
    const reservedNames = [
      'config', 'settings', 'system', 'admin', 'root', 'default',
      'test', 'temp', 'tmp', 'backup', 'old', 'new',
      'server', 'client', 'api', 'web', 'app', 'service'
    ];
    
    return reservedNames.includes(name.toLowerCase());
  }

  /**
   * Generate a unique server name based on base name and existing names
   */
  static generateUniqueName(baseName: string, existingNames: string[]): string {
    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    let counter = 1;
    let newName = `${baseName}-${counter}`;
    
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName}-${counter}`;
    }

    return newName;
  }

  /**
   * Normalize server name (convert to valid format)
   */
  static normalizeServerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, this.MAX_NAME_LENGTH);
  }

  /**
   * Check if server name conflicts with existing names
   */
  static checkNameConflict(name: string, existingNames: string[]): boolean {
    return existingNames.includes(name);
  }

  /**
   * Get all validation errors for multiple server names
   */
  static validateMultipleNames(names: string[]): {
    valid: boolean;
    errors: string[];
    conflicts: string[];
  } {
    const errors: string[] = [];
    const conflicts: string[] = [];
    const seenNames = new Set<string>();

    for (const name of names) {
      const validation = this.validateServerName(name);
      
      if (!validation.valid) {
        errors.push(`"${name}": ${validation.error}`);
      }

      if (seenNames.has(name)) {
        conflicts.push(name);
      } else {
        seenNames.add(name);
      }
    }

    return {
      valid: errors.length === 0 && conflicts.length === 0,
      errors,
      conflicts
    };
  }
} 