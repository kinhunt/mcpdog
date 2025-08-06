# MCPDog 🐕

> **Universal MCP Server Manager - Configure Once, Manage Everything!**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

MCPDog is a powerful MCP (Model Context Protocol) server manager that allows you to use multiple MCP servers through a single interface. Perfect for MCP clients like Claude Desktop, Cursor, and other AI assistants that support MCP.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCPDog Architecture                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client 1  │    │   MCP Client 2  │    │   MCP Client N  │
│  (Claude Desktop)│    │     (Cursor)     │    │   (Other AI)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      MCPDog Proxy         │
                    │   (Single Entry Point)    │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Tool Router       │  │
                    │  │ (Request Routing)   │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │  Protocol Adapters  │  │
                    │  │ (stdio/HTTP/SSE)    │  │
                    │  └─────────┬───────────┘  │
                    └────────────┼──────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐         ┌──────▼──────┐         ┌─────▼─────┐
    │ MCP Server│         │ MCP Server  │         │ MCP Server│
    │(Playwright)│         │(Filesystem) │         │(Puppeteer)│
    │  (stdio)  │         │  (stdio)   │         │ (HTTP SSE)│
    └───────────┘         └─────────────┘         └───────────┘
          │                      │                      │
    ┌─────▼─────┐         ┌──────▼──────┐         ┌─────▼─────┐
    │   Tools   │         │   Tools     │         │   Tools   │
    │(browser_*)│         │(read_file)  │         │(screenshot)│
    └───────────┘         └─────────────┘         └───────────┘
```

### Key Benefits of This Architecture:

- **🔗 One-Time Setup**: Configure MCPDog once, use all servers
- **🔄 Unified Interface**: All MCP servers appear as one server to clients
- **⚡ Smart Routing**: MCPDog routes tool calls to the appropriate server
- **🌐 Protocol Flexibility**: Supports stdio, HTTP SSE, and Streamable HTTP
- **📊 Centralized Management**: Monitor and manage all servers from web dashboard
- **🛡️ Fault Tolerance**: If one server fails, others continue working
- **🎯 Simplified Workflow**: No need to configure each server separately in your client

## 🎯 What MCPDog Does

MCPDog acts as a **proxy layer** that combines multiple MCP servers into one unified interface. Instead of configuring each MCP server separately in your client, you configure MCPDog once and it manages all your servers for you.

### Key Benefits
- **🔄 Single Configuration** - Configure once, use many servers
- **🌐 Web Dashboard** - Manage servers visually through web interface
- **⚡ Auto-Detection** - Automatically detects optimal protocols for each server
- **🔧 Easy Management** - Add, remove, and configure servers via CLI or web
- **📊 Real-time Monitoring** - See server status and tool availability in real-time

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- An MCP client (Claude Desktop, Cursor, etc.)

### Step 1: Configure Your MCP Client

**One-time configuration for all your MCP servers!**

#### For Claude Desktop
Add this to your Claude Desktop configuration:
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

#### For Cursor
Add this to your Cursor MCP configuration:
```json
{
  "mcp": {
    "mcpServers": {
      "mcpdog": {
        "command": "npx",
        "args": ["mcpdog@latest"]
      }
    }
  }
}
```

> **That's it!** Once configured, MCPDog will automatically start when your client connects and manage all your MCP servers for you.

### Step 2: Manage Servers via Web Dashboard

Open your browser and go to `http://localhost:3000` to:
- **Add new MCP servers** with a few clicks
- **Monitor server status** in real-time
- **Enable/disable tools** as needed
- **View server logs** and performance metrics
- **Generate client configurations** for other tools

> **Note**: The daemon runs in the background and will continue running even after you close your MCP client.

### Step 3: Stop MCPDog (Optional)

When you're done, stop the daemon:
```bash
npx mcpdog@latest daemon stop
```

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

> **Tip**: The default configuration file is stored in `~/.mcpdog/` directory. This is the recommended location for storing your server configurations.

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

### stdio
- Direct process communication
- Best for local servers
- Lowest latency

### HTTP SSE (Server-Sent Events)
- Real-time streaming
- Good for remote servers
- Browser-compatible

### Streamable HTTP
- HTTP-based streaming
- Compatible with most HTTP clients
- Good for cloud services

## 📊 Troubleshooting

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