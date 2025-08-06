# MCPDog 🐕

> **Universal MCP Server Manager - Your Gateway to Multiple MCP Servers**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

MCPDog is a powerful MCP (Model Context Protocol) server manager that allows you to use multiple MCP servers through a single interface. Perfect for MCP clients like Claude Desktop, Cursor, and other AI assistants that support MCP.

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

### Step 1: Start MCPDog (Optional)
```bash
# Start MCPDog daemon with web interface (optional)
npx mcpdog@latest daemon start --web-port 3000
```

> **Note**: You can skip this step if you only want to use MCPDog through your MCP client. The daemon will start automatically when your client connects.

### Step 2: Add Your MCP Servers
```bash
# Add a Playwright MCP server
npx mcpdog@latest config add playwright "npx @playwright/mcp@latest" --auto-detect

# Add a filesystem server
npx mcpdog@latest config add filesystem "npx @modelcontextprotocol/server-filesystem /tmp" --auto-detect

# Add an HTTP-based server
npx mcpdog@latest config add api-server https://api.example.com --transport streamable-http
```

### Step 3: Configure Your MCP Client

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

> **Note**: When your MCP client connects to MCPDog, the daemon will automatically start and run in the background. If you need to stop it, manually run `npx mcpdog@latest daemon stop`.

### Step 4: Access Web Dashboard (Optional)
Open `http://localhost:3000` in your browser to:
- Monitor server status
- View available tools
- Manage server configurations
- View real-time logs

> **Note**: The daemon runs in the background and will continue running even after you close your MCP client. To stop it, run `npx mcpdog@latest daemon stop`.

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