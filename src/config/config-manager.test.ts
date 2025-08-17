import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from './config-manager';
import { MCPServerConfig } from '../types';

// Mock the file system
vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    configManager = new ConfigManager('/fake/path/mcpdog.config.json');
  });

  describe('updateServer', () => {
    it('should clean up endpoint when switching to stdio', () => {
      const initialConfig: MCPServerConfig = {
        name: 'test-server',
        transport: 'streamable-http',
        endpoint: 'http://localhost:8080',
        enabled: true,
      };
      configManager.addServer('test-server', initialConfig);

      const updates: Partial<MCPServerConfig> = {
        transport: 'stdio',
        command: 'npx',
        args: ['my-server'],
      };

      configManager.updateServer('test-server', updates);

      const updatedConfig = configManager.getServerConfig('test-server');
      expect(updatedConfig).toBeDefined();
      expect(updatedConfig?.transport).toBe('stdio');
      expect(updatedConfig?.command).toBe('npx');
      expect(updatedConfig).not.toHaveProperty('endpoint');
    });

    it('should clean up command and args when switching to http', () => {
      const initialConfig: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'npx',
        args: ['my-server'],
        enabled: true,
      };
      configManager.addServer('test-server', initialConfig);

      const updates: Partial<MCPServerConfig> = {
        transport: 'streamable-http',
        endpoint: 'http://localhost:8080',
      };

      configManager.updateServer('test-server', updates);

      const updatedConfig = configManager.getServerConfig('test-server');
      expect(updatedConfig).toBeDefined();
      expect(updatedConfig?.transport).toBe('streamable-http');
      expect(updatedConfig?.endpoint).toBe('http://localhost:8080');
      expect(updatedConfig).not.toHaveProperty('command');
      expect(updatedConfig).not.toHaveProperty('args');
    });

    it('should not clean up fields if transport is not changed', () => {
      const initialConfig: MCPServerConfig = {
        name: 'test-server',
        transport: 'stdio',
        command: 'npx',
        args: ['my-server'],
        enabled: true,
      };
      configManager.addServer('test-server', initialConfig);

      const updates: Partial<MCPServerConfig> = {
        command: 'npm',
      };

      configManager.updateServer('test-server', updates);

      const updatedConfig = configManager.getServerConfig('test-server');
      expect(updatedConfig).toBeDefined();
      expect(updatedConfig?.transport).toBe('stdio');
      expect(updatedConfig?.command).toBe('npm');
      expect(updatedConfig?.args).toEqual(['my-server']);
    });
  });
});
