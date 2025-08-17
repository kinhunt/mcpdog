# MCPDog 🐕

> **Universal MCP Server Manager - Configure Once, Manage Everything!**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

MCPDog is a powerful MCP (Model Context Protocol) server manager that allows you to use multiple MCP servers through a single interface. Perfect for MCP clients like Claude Desktop, Cursor, and other AI assistants that support MCP.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client:   │    │   MCP Client:   │    │   MCP Client:   │
│     (Claude)    │    │    (Cursor)     │    │   (Gemini CLI)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │         MCPDog            │
                    │   (Single Entry Point)    │
                    └────────────┬──────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐         ┌──────▼──────┐         ┌─────▼─────┐
    │MCP Server:│         │ MCP Server: │         │MCP Server:│
    │Playwright │         │ Filesystem  │         │ Puppeteer │
    └───────────┘         └─────────────┘         └───────────┘
```

### Key Benefits of This Architecture:

- **🔗 One-Time Setup**: Configure MCPDog once, use all servers
- **🔄 Unified Interface**: All MCP servers appear as one server to clients
- **⚡ Smart Routing**: MCPDog routes tool calls to the appropriate server
- **🌐 Protocol Flexibility**: Supports stdio, HTTP SSE, and Streamable HTTP for both client and server connections
- **📊 Centralized Management**: Monitor and manage all servers from web dashboard
- **🛡️ Fault Tolerance**: If one server fails, others continue working
- **🎯 Simplified Workflow**: No need to configure each server separately in your client

<img width="925" height="738" alt="Manage servers" src="https://github.com/user-attachments/assets/58edd321-3f23-4a3f-a85e-691c8eae175d" />

<img width="933" height="722" alt="logging" src="https://github.com/user-attachments/assets/00200247-b04f-4cd5-a84b-8fbb047ecdd6" />


## 🎯 What MCPDog Does

MCPDog acts as a **proxy layer** that combines multiple MCP servers into one unified interface. Instead of configuring each MCP server separately in your client, you configure MCPDog once and it manages all your servers for you.

### Key Benefits
- **🔄 Single Configuration** - Configure once, use many servers
- **🌐 Web Dashboard** - Manage servers visually through web interface
- **⚡ Auto-Detection** - Automatically detects optimal protocols for each server
- **🔧 Easy Management** - Add, remove, and configure servers via CLI or web
- **📊 Real-time Monitoring** - See server status and tool availability in real-time
- **🌍 Multiple Transports** - Support for both stdio and HTTP-based communication

## ⚡ New: HTTP Transport Support

MCPDog now supports HTTP-based communication in addition to the traditional stdio transport! This enables:

- **Web-based MCP clients** to connect directly via HTTP
- **Remote MCP access** over network
- **RESTful health checks** and monitoring
- **CORS-enabled** browser integration

Quick example:
```bash
# Start MCPDog with HTTP transport
npx mcpdog@latest --transport streamable-http --port 4000

# Test with curl
curl -X POST http://localhost:4000/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## 🚀 Quick Start

Choose the deployment method that best fits your needs:

### Prerequisites
- Node.js >= 18
- An MCP client (Claude Desktop, Cursor, etc.)

## 📋 Three Deployment Options

### 1. 🏠 **Local Development** (Simplest - Recommended)

Perfect for local development and personal use. MCPDog runs automatically when your MCP client starts.

**Step 1:** Configure your MCP client (Claude Desktop/Cursor)
```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "npx",
      "args": ["mcpdog@latest"]
    }
  }
}
```

**Step 2:** Open dashboard to add MCP servers
- Visit `http://localhost:3000` when MCPDog is running
- Use the web interface to add and configure your MCP servers
- Configuration saved to `~/.mcpdog/mcpdog.config.json`

**That's it!** MCPDog starts automatically with your MCP client and manages all your servers.

---

### 2. 🐳 **Local Docker** (Controlled Environment)

Run MCPDog in a Docker container for isolated, controlled environments without authentication.

**Step 1:** Start MCPDog container
```bash
docker run -d --name mcpdog \
  -p 3000:3000 -p 4000:4000 \
  -v ~/.mcpdog:/usr/src/app/.mcpdog \
  mcpdog/mcpdog:latest
```

**Step 2:** Configure your MCP client to use HTTP transport
```json
{
  "mcpServers": {
    "mcpdog-http": {
      "type": "streamable-http",
      "url": "http://localhost:4000"
    }
  }
}
```

**Step 3:** Manage via web dashboard
- Visit `http://localhost:3000` to configure servers
- No authentication required for local Docker setup

---

### 3. ☁️ **Cloud Deployment** (Multi-Environment)

Deploy MCPDog to the cloud for access across different development environments with authentication.

**Step 1:** Deploy container to cloud with authentication
```bash
docker run -d --name mcpdog-cloud \
  -p 3000:3000 -p 4000:4000 \
  -e MCPDOG_AUTH_TOKEN=your_secure_token_here \
  -v /path/to/config:/usr/src/app/.mcpdog \
  mcpdog/mcpdog:latest
```

**Step 2:** Configure your MCP client with authentication
```json
{
  "mcpServers": {
    "mcpdog-http": {
      "type": "streamable-http",
      "url": "https://your-cloud-domain.com:4000",
      "headers": {
        "Authorization": "Bearer your_secure_token_here"
      }
    }
  }
}
```

**Step 3:** Access authenticated web dashboard
- Visit `https://your-cloud-domain.com:3000` 
- Login with your authentication token
- Manage servers across all your development environments

---

## 🌐 Web Dashboard Features

Once MCPDog is running (any deployment method), use the web dashboard to:

- **Add new MCP servers** with auto-detection
- **Monitor server status** in real-time  
- **Enable/disable tools** as needed
- **View server logs** and performance metrics
- **Generate client configurations** for easy copy-paste setup
- **Export configurations** for team sharing

## 🎯 Choose Your Method

| Method | Best For | Setup Complexity | Security |
|--------|----------|------------------|-----------|
| **Local Development** | Personal use, quick start | ⭐ Simple | Local only |
| **Local Docker** | Isolated environments, testing | ⭐⭐ Medium | Containerized |
| **Cloud Deployment** | Team use, multi-environment | ⭐⭐⭐ Advanced | Authenticated |

---

**🎯 Configure Once, Manage Everything!**

## 📖 Usage Guide

### Managing Servers

#### List All Servers
```bash
npx mcpdog@latest config list
```

#### Add a New Server
```bash
# Basic server with auto-detection
npx mcpdog@latest config add my-server "npx @some/mcp-server@latest" --auto-detect

# HTTP server
npx mcpdog@latest config add api-server https://api.example.com --transport streamable-http

# With custom timeout
npx mcpdog@latest config add slow-server "npx @slow/mcp-server@latest" --timeout 60000
```

#### Update Server Configuration
```bash
npx mcpdog@latest config update my-server --timeout 45000 --description "Updated description"
```

#### Remove a Server
```bash
npx mcpdog@latest config remove old-server
```

#### Show Server Details
```bash
npx mcpdog@latest config show my-server
```

### Server Management Commands

#### Check Status
```bash
npx mcpdog@latest status
```

#### Detect Protocols
```bash
# Detect for all servers
npx mcpdog@latest detect --all

# Detect for specific server
npx mcpdog@latest detect my-server
```

#### Optimize Performance
```bash
# Preview optimizations
npx mcpdog@latest optimize --all --preview

# Apply optimizations
npx mcpdog@latest optimize --all --apply
```

#### Run Diagnostics
```bash
# Health check
npx mcpdog@latest diagnose --health-check

# Auto-fix issues
npx mcpdog@latest diagnose --fix
```

### Daemon Management

#### Start Daemon
```bash
# Start with default settings
npx mcpdog@latest daemon start

# Start with custom web port
npx mcpdog@latest daemon start --web-port 3000

# Start in background
npx mcpdog@latest daemon start --background
```

#### Stop Daemon
```bash
npx mcpdog@latest daemon stop
```

#### Check Daemon Status
```bash
npx mcpdog@latest daemon status
```

## 🌐 Web Dashboard

The web dashboard provides a visual interface for managing your MCP servers:

### Features
- **Server Status** - Real-time connection status and tool counts
- **Tool Management** - Enable/disable individual tools
- **Configuration Editor** - Edit server settings in the browser
- **Live Logs** - View real-time server logs
- **Performance Metrics** - Monitor response times and errors
- **Client Config Generator** - Generate configurations for your MCP client

### Access Dashboard
1. Start the daemon: `npx mcpdog@latest daemon start --web-port 3000`
2. Open `http://localhost:3000` in your browser
3. Manage your servers visually

> **Note**: The daemon will continue running in the background. To stop it, use `npx mcpdog@latest daemon stop`.

## 🔧 Configuration

### Configuration Files
MCPDog uses configuration files to store server settings:

- **Default**: `~/.mcpdog/mcpdog.config.json` (recommended)
- **Local**: `./mcpdog.config.json`
- **Custom**: Specify with `--config` flag

> **Tip**: The default configuration file is stored in the `~/.mcpdog/` directory:
> - **macOS/Linux**: `/Users/username/.mcpdog/`
> - **Windows**: `C:\Users\username\.mcpdog\`
> 
> This is the recommended location for storing your server configurations across all platforms.

### Configuration Format
```json
{
  "version": "2.0.0",
  "servers": {
    "playwright": {
      "name": "playwright",
      "enabled": true,
      "transport": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "retries": 3,
      "toolsConfig": {
        "mode": "all"
      }
    }
  }
}
```

## 🛠️ Supported Transport Protocols

MCPDog supports multiple transport protocols for both client connections and server connections:

### Client Connection Protocols

#### stdio (default)
- Standard input/output communication
- Perfect for traditional MCP clients (Claude Desktop, Cursor)
- Direct process communication with lowest latency
- Recommended for most use cases

```bash
# Start with stdio (default)
npx mcpdog@latest

# Or explicitly specify stdio
npx mcpdog@latest --transport stdio
```

#### Streamable HTTP
- HTTP-based JSON-RPC communication
- Compatible with web-based and HTTP-capable clients
- CORS-enabled for browser access
- Health check endpoint included

```bash
# Start HTTP server on default port 4000
npx mcpdog@latest --transport streamable-http

# Start HTTP server on custom port
npx mcpdog@latest --transport streamable-http --port 8080

# Or using proxy command
npx mcpdog@latest proxy --transport streamable-http --port 4000
```

**HTTP Endpoints:**
- `GET /` - Health check endpoint  
- `POST /` - MCP JSON-RPC endpoint

### New Unified Commands (v2.0.17+)

The new `start` command provides a unified way to launch all MCPDog services:

```bash
# Start everything: stdio + HTTP + dashboard
npx mcpdog@latest start

# Customize ports  
npx mcpdog@latest start --dashboard-port 3001 --mcp-http-port 4001

# Only specific services
npx mcpdog@latest start --stdio-only      # stdio + dashboard
npx mcpdog@latest start --http-only       # HTTP + dashboard
npx mcpdog@latest start --no-dashboard    # transports only
```

### Server Connection Protocols (for connecting to MCP servers)

#### stdio
- Direct process communication
- Best for local servers
- Lowest latency

#### HTTP SSE (Server-Sent Events)
- Real-time streaming
- Good for remote servers
- Browser-compatible

#### Streamable HTTP
- HTTP-based streaming
- Compatible with most HTTP clients
- Good for cloud services

## 📊 Troubleshooting

### Known Issues

#### Playwright MCP Compatibility
⚠️ **Known Issue**: Playwright MCP server (`@playwright/mcp`) does not work reliably with MCPDog's stdio subprocess environment. This is due to Playwright's internal behavior when detecting non-interactive environments, causing it to enter "silent mode" and preventing proper tool execution.

**Workaround**: Use Playwright MCP directly if browser automation is needed, or consider alternative browser automation servers like `@browsermcp/mcp` which are compatible with MCPDog.

**Root Cause**: Playwright detects the subprocess execution environment and disables its core functionality, resulting in tool call timeouts despite successful MCP protocol handshakes.

### Common Issues

#### Server Not Starting
```bash
# Check server status
npx mcpdog@latest status

# Run diagnostics
npx mcpdog@latest diagnose --health-check

# Check logs
npx mcpdog@latest daemon logs
```

#### Tools Not Available
```bash
# Detect protocols
npx mcpdog@latest detect --all

# Check tool availability
npx mcpdog@latest config show my-server
```

#### Connection Issues
```bash
# Test server connection
npx mcpdog@latest diagnose --connectivity

# Auto-fix issues
npx mcpdog@latest diagnose --fix
```

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/kinhunt/mcpdog/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kinhunt/mcpdog/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**MCPDog** - Your loyal companion for MCP server management! 🐕🦴

*"Good dog! Now fetch me that perfect MCP configuration!"*
