# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Full TypeScript build for both backend and web frontend
- `npm run dev` - Start development server using tsx
- `npm run start` - Start production server from built dist files
- `npm run web` - Start server with web interface on port 3000

### Testing
- `npm test` - Run unit tests with Vitest
- `npm run test:integration` - Run integration tests

### Web Frontend (in /web directory)
- `cd web && npm run dev` - Start Vite development server
- `cd web && npm run build` - Build web frontend with TypeScript + Vite
- `cd web && npm run preview` - Preview built web frontend

## Architecture Overview

MCPDog is a universal MCP (Model Context Protocol) server manager that acts as a proxy/aggregator for multiple MCP servers. It provides a single entry point for MCP clients to access multiple underlying MCP servers.

### Core Components

**MCPDogServer** (`src/core/mcpdog-server.ts`):
- Main server class that handles MCP protocol communication
- Coordinates between clients and multiple backend MCP servers
- Manages tool routing and request delegation

**MCPDogDaemon** (`src/daemon/mcpdog-daemon.ts`):
- Daemon process that runs in background
- Supports multiple client connection modes (stdio, web, cli)
- Manages IPC communication and web server

**ConfigManager** (`src/config/config-manager.ts`):
- Handles configuration loading/saving for MCP servers
- Default config location: `~/.mcpdog/mcpdog.config.json`
- Supports server enable/disable, transport protocols, timeouts

**ToolRouter** (`src/router/tool-router.ts`):
- Routes tool calls to appropriate MCP servers
- Handles tool discovery and aggregation across servers
- Manages tool conflicts and namespacing

### Transport Adapters

**AdapterFactory** (`src/adapters/adapter-factory.ts`):
- Creates appropriate adapter based on transport type
- Supports stdio, HTTP SSE, and Streamable HTTP protocols

**Individual Adapters**:
- `stdio-adapter.ts` - Direct process communication
- `http-sse-adapter.ts` - Server-sent events over HTTP
- `streamable-http-adapter.ts` - HTTP streaming protocol

### CLI Interface

**CLI Router** (`src/cli/cli-router.ts`):
- Command routing and argument parsing
- Delegates to specific command handlers

**Command Handlers** (`src/cli/commands/`):
- `config-commands.ts` - Server configuration management
- `daemon-commands.ts` - Daemon lifecycle control
- `start-command.ts` - Direct server startup
- `diagnose-commands.ts` - Health checks and diagnostics
- `detect-commands.ts` - Protocol detection
- `optimize-commands.ts` - Performance optimization

### Web Interface

**Frontend** (`web/src/`):
- React + TypeScript + Vite + Tailwind CSS
- Socket.io for real-time communication with daemon
- Zustand for state management
- Components for server management, logging, tool configuration

## Key Patterns

1. **Event-Driven Architecture**: Heavy use of EventEmitter for component communication
2. **Adapter Pattern**: Transport protocol abstraction through adapters
3. **Configuration-Driven**: Servers defined in JSON config with hot-reloading
4. **Multi-Protocol Support**: Unified interface over different MCP transport protocols
5. **Real-time Updates**: Web interface uses WebSocket for live server status

## AI Memory Directory

The `memory/` directory contains AI investigation records and testing findings:
- Technical investigation reports from debugging sessions
- Code change analysis and impact assessments  
- Testing methodologies and operational guides
- Known issues and their root cause analysis

**Note**: This directory is git-ignored to prevent pollution of the main repository with AI debugging artifacts.

## Development Notes

- Uses ES modules (`"type": "module"`)
- TypeScript with strict mode enabled
- Dual build system: TypeScript for backend, Vite for frontend
- Configuration stored in user home directory by default
- Supports both direct execution and daemon mode
- Web interface runs on separate port (default 3000)