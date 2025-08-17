# MCPDog Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the MCPDog codebase, including technical debt, workarounds, and real-world patterns. It serves as a reference for AI agents working on enhancements.

### Document Scope

Comprehensive documentation of the entire system, with a focus on enabling bug fixes.

### Change Log

| Date       | Version | Description                 | Author |
| ---------- | ------- | --------------------------- | ------ |
| 2025-08-15 | 1.0     | Initial brownfield analysis | John (PM) |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry (stdio)**: `src/index.ts`
- **Main Entry (CLI)**: `src/cli/cli-main.ts`
- **Configuration**: `src/config/config-manager.ts`
- **Core Business Logic**: `src/core/mcpdog-server.ts`, `src/router/tool-router.ts`
- **Web Server**: `src/web/web-server.ts`
- **Daemon Logic**: `src/daemon/mcpdog-daemon.ts`
- **Protocol Adapters**: `src/adapters/`

## High Level Architecture

### Technical Summary

MCPDog is a Node.js application written in TypeScript that acts as a proxy and manager for multiple Model Context Protocol (MCP) servers. It provides a single entry point for MCP clients (like IDEs or chatbots) to interact with a variety of backend tools. The system is composed of a core server, a command-line interface (CLI) for management, and a web-based dashboard for visual management. It uses a modular adapter-based architecture to connect to different MCP servers over various protocols (stdio, HTTP).

### Actual Tech Stack (from package.json)

| Category      | Technology                     | Version      | Notes                               |
| ------------- | ------------------------------ | ------------ | ----------------------------------- |
| Runtime       | Node.js                        | >=18         |                                     |
| Language      | TypeScript                     | ^5.0.0       |                                     |
| Web Framework | Express                        | ^4.21.2      | Used for the web dashboard API.     |
| Real-time     | Socket.io                      | ^4.8.1       | For web dashboard real-time updates.|
| MCP SDK       | @modelcontextprotocol/sdk      | ^1.0.0       | Core MCP dependency.                |
| Testing       | Vitest                         | ^1.0.0       | Test runner.                        |
| Transpiler    | tsx                            | ^4.0.0       | For running TypeScript on the fly.  |

### Repository Structure Reality Check

- **Type**: Monorepo-style (contains backend, CLI, and a separate web frontend).
- **Package Manager**: npm
- **Notable**: The `.bmad-core` directory suggests the use of a structured, agent-based development methodology for the project itself.

## Source Tree and Module Organization

### Project Structure (Actual)

```text
mcpdog/
├── src/
│   ├── adapters/        # Connectors for different MCP server protocols (stdio, http-sse)
│   ├── cli/             # Command Line Interface logic
│   │   └── commands/    # Individual CLI command handlers
│   ├── config/          # Configuration management (loading/saving mcpdog.config.json)
│   ├── core/            # Core server logic (MCPDogServer, protocol detection)
│   ├── daemon/          # Logic for running mcpdog as a background process
│   ├── logging/         # Server log management
│   ├── router/          # Tool routing logic (ToolRouter)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Shared utility functions
│   └── web/             # Backend for the web dashboard
├── web/                 # Source code for the Vite/React frontend dashboard
├── dist/                # Compiled output from TypeScript
├── scripts/             # Utility scripts (e.g., for publishing)
└── tests/               # Vitest tests (not present in file listing, but in package.json)
```

### Key Modules and Their Purpose

- **`src/core/mcpdog-server.ts`**: The central class that orchestrates the entire application. It manages the lifecycle of server adapters and handles incoming MCP requests.
- **`src/router/tool-router.ts`**: Responsible for managing connections to downstream MCP servers, collecting their available tools, and routing incoming `tools/call` requests to the correct server. It handles tool name conflicts by prefixing.
- **`src/config/config-manager.ts`**: Handles loading, saving, and managing the `mcpdog.config.json` file, which defines the MCP servers to connect to.
- **`src/cli/cli-main.ts`**: The entry point for the `mcpdog` command-line tool. It parses arguments and routes them to the appropriate command handlers in `src/cli/commands/`.
- **`src/web/web-server.ts`**: An Express.js server that provides a REST API and a WebSocket connection for the web management dashboard.
- **`src/adapters/*`**: Each file in this directory is an adapter responsible for communicating with a downstream MCP server using a specific protocol (e.g., `stdio-adapter.ts` for process-based servers).

## Data Models and APIs

### Data Models

The primary data models are the TypeScript types defined in `src/types/index.ts`, which include:
- `MCPDogConfig`: The main configuration structure.
- `MCPServerConfig`: Configuration for a single downstream MCP server.
- `MCPRequest`, `MCPResponse`, `MCPTool`: Standard MCP protocol message types.

### API Specifications

- **Internal API**: The `MCPDogServer` class exposes methods like `handleRequest` which form the internal API for processing MCP messages.
- **Web API**: The `src/web/web-server.ts` file defines a RESTful API for the web dashboard. Key endpoints include:
    - `GET /api/status`: Get the overall status of the server.
    - `GET /api/servers`: List all configured downstream servers and their status.
    - `POST /api/servers`: Add a new server.
    - `DELETE /api/servers/:name`: Remove a server.
- **CLI API**: The `mcpdog` command provides the user-facing API for management. See `npx mcpdog --help` (as seen in `README.md`) for commands.

## Technical Debt and Known Issues

- **Playwright MCP Incompatibility**: The `README.md` explicitly calls out a known issue where the `@playwright/mcp` server does not work reliably in the stdio subprocess environment used by MCPDog. This is a significant constraint for browser automation tasks.
- **Error Handling**: Some error handling in `StdioMCPServer` (`src/index.ts`) involves just logging the error and not sending a response back to the client, which might be problematic for some MCP clients.
- **Redundant Config Options**: The CLI argument parsing in `cli-main.ts` shows some deprecated or overlapping options like `--web-port` and `--dashboard-port`.

## Integration Points and External Dependencies

- **External Services**: The system is designed to connect to any external service that exposes an MCP-compliant interface. These are configured by the user in `mcpdog.config.json`.
- **Internal Integration Points**:
    - **CLI to Daemon**: The CLI communicates with the running daemon process, likely via HTTP requests to the web server API or another mechanism.
    - **Web UI to Backend**: The React-based web UI (`web/src/`) communicates with the `web-server.ts` backend via REST API calls and Socket.io for real-time updates.

## Development and Deployment

### Local Development Setup

1.  Run `npm install` to install dependencies.
2.  Run `npm run dev` (`tsx src/index.ts`) to start the server in development mode with hot-reloading.
3.  The web dashboard (`web/`) is a separate Vite project and likely requires its own `npm install` and `npm run dev` from within its directory.

### Build and Deployment Process

- **Build Command**: `npm run build` executes `tsc` to compile the backend and then builds the web UI with Vite.
- **Deployment**: The project is published to npm. The `prepublishOnly` script ensures the project is built before publishing. The `files` array in `package.json` specifies which files are included in the npm package.

## Testing Reality

- **Testing Framework**: `vitest` is used for testing.
- **Test Command**: `npm test` runs the tests. An integration test suite can be run with `npm run test:integration`.
- **Coverage**: The current test coverage is unknown without running the tests.

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
# Run the server in development mode
npm run dev

# Build the project for production
npm run build

# Run the compiled server
npm run start

# Run tests
npm test
```
