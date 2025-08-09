#!/usr/bin/env node
/**
 * MCPDog CLI - Main entry point for the command-line interface
 * Supports server management, protocol detection, configuration optimization, etc.
 */

import { parseArgs } from 'util';
import { CLICommandRouter } from './cli-router.js';
import { CLIUtils } from './cli-utils.js';

async function main() {
  try {
    // Parse command line arguments - only parse global options, let subcommands parse their specific options
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        config: { type: 'string', short: 'c' },
        verbose: { type: 'boolean' },
        json: { type: 'boolean' },
        'no-color': { type: 'boolean' },
        'web-port': { type: 'string' },
        'daemon-port': { type: 'string' },
        'pid-file': { type: 'string' },
        port: { type: 'string', short: 'p' },
        // Config command options
        endpoint: { type: 'string' },
        transport: { type: 'string' },
        timeout: { type: 'string' },
        retries: { type: 'string' },
        description: { type: 'string' },
        // Add command options
        'auto-detect': { type: 'boolean' },
        headers: { type: 'string' },
        args: { type: 'string' },
        yes: { type: 'boolean', short: 'y' },
        // Audit command options
        performance: { type: 'boolean' },
        security: { type: 'boolean' },
        compliance: { type: 'boolean' },
        export: { type: 'string' },
        // Detect command options
        all: { type: 'boolean' },
        detailed: { type: 'boolean' },
        'no-add': { type: 'boolean' },
        // Diagnose command options
        'health-check': { type: 'boolean' },
        fix: { type: 'boolean' },
        // Optimize command options
        apply: { type: 'boolean' },
        preview: { type: 'boolean' }
      },
      allowPositionals: true,
      strict: false
    });

    // Set up CLI environment
    CLIUtils.setupEnvironment({
      verbose: Boolean(values.verbose),
      noColor: Boolean(values['no-color']),
      json: Boolean(values.json)
    });

    // Handle global options
    if (values.version) {
      CLIUtils.showVersion();
      process.exit(0);
    }

    if (values.help && positionals.length === 0) {
      CLIUtils.showGlobalHelp();
      process.exit(0);
    }

    // Get command and arguments
    const [command, ...args] = positionals;
    
    // If no command is provided, default to 'proxy' (auto-start mode)
    const finalCommand = command || 'proxy';
    const finalArgs = command ? args : [];
    
    // In auto mode (no command specified), suppress all output to avoid MCP client errors
    if (!command) {
      // Don't output anything in auto mode to avoid MCP client parsing errors
      // The proxy command will handle all the necessary startup logic silently
    }
    
    if (!command && values.help) {
      CLIUtils.showGlobalHelp();
      process.exit(0);
    }

    // Create router and execute command
    const router = new CLICommandRouter(values.config as string);
    await router.executeCommand(finalCommand, finalArgs, values);

  } catch (error) {
    CLIUtils.error('CLI execution failed:', (error as Error).message);
    if (CLIUtils.isVerbose()) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  CLIUtils.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  CLIUtils.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the CLI
main();