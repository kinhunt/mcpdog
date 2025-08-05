# MCPDog 🐕

> **Universal MCP Server Manager with Web Interface**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

MCPDog is a comprehensive MCP (Model Context Protocol) server management solution that provides both command-line interface and web-based dashboard for managing multiple MCP servers. It acts as a proxy layer that unifies multiple downstream MCP servers into a single, manageable interface.

## 🎯 Features

### 🔧 Core Capabilities
- **🔄 Multi-Server Proxy** - Manage multiple MCP servers through a single interface
- **🌐 Web Dashboard** - Real-time monitoring and management via web interface
- **⚡ Protocol Detection** - Automatic detection of optimal protocols for MCP servers
- **📋 Configuration Management** - Add, remove, update server configurations via CLI
- **🔍 Performance Optimization** - Automatic optimization of server configurations
- **🛠️ Diagnostics & Auditing** - Comprehensive diagnostics and configuration auditing
- **📊 Real-time Monitoring** - Live status monitoring with WebSocket support

### 🚀 Advanced Features
- **🔗 Multiple Transport Support** - stdio, HTTP SSE, Streamable HTTP
- **🎯 Smart Tool Routing** - Intelligent routing of tool calls to appropriate servers
- **📈 Performance Analytics** - Detailed performance metrics and optimization suggestions
- **🔒 Security Auditing** - Security compliance checking and recommendations
- **🔄 Hot Reload** - Configuration changes without server restart
- **📝 Comprehensive Logging** - Detailed logging with multiple log levels

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │    │   Web Dashboard │    │   CLI Interface │
│   (Claude, etc) │    │   (Port 3000)   │    │   (mcpdog cmd)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      MCPDog Server        │
                    │   (Proxy & Manager)       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Tool Router          │
                    │   (Request Routing)       │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐         ┌───────▼──────┐         ┌─────▼─────┐
    │ Server 1  │         │  Server 2   │         │ Server N  │
    │(stdio)    │         │(HTTP SSE)   │         │(HTTP)     │
    └───────────┘         └─────────────┘         └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/kinhunt/mcpdog.git
cd mcpdog

# Install dependencies
npm install

# Build the project
npm run build

# Create global command (optional)
npm link
```

### Basic Usage

#### 1. Start the Daemon (Web Interface)
```bash
# Start daemon with web interface
mcpdog daemon start

# Or with custom port
mcpdog daemon start --web-port 3000
```

#### 2. Add MCP Servers
```bash
# Add server with auto-detection
mcpdog config add my-server "npx @playwright/mcp@latest" --auto-detect

# Add HTTP server
mcpdog config add api-server https://api.example.com --transport streamable-http

# Add with custom configuration
mcpdog config add filesystem "npx @modelcontextprotocol/server-filesystem /tmp" --timeout 30000
```

#### 3. Access Web Dashboard
Open your browser and navigate to `http://localhost:3000` to access the web dashboard.

## 📖 Detailed Usage

### CLI Commands

#### Configuration Management
```bash
# List all servers
mcpdog config list

# Add server with auto-detection
mcpdog config add my-server "npx @playwright/mcp@latest" --auto-detect

# Update server configuration
mcpdog config update my-server --timeout 60000 --description "Updated server"

# Remove server
mcpdog config remove old-server

# Show server details
mcpdog config show my-server
```

#### Protocol Detection
```bash
# Detect protocols for all servers
mcpdog detect --all

# Detect specific server
mcpdog detect my-server

# Detect new endpoint
mcpdog detect https://api.example.com --detailed
```

#### Performance Optimization
```bash
# Preview optimizations
mcpdog optimize --all --preview

# Apply optimizations
mcpdog optimize --all --apply

# Optimize specific server
mcpdog optimize my-server --preview
```

#### Diagnostics & Auditing
```bash
# Run health check
mcpdog diagnose --health-check

# Auto-fix issues
mcpdog diagnose --fix

# Security audit
mcpdog audit --security

# Performance audit
mcpdog audit --performance
```

### Web Dashboard Features

#### Server Management
- **Real-time Status** - Live connection status and tool counts
- **Configuration Editor** - In-browser server configuration editing
- **Server Toggle** - Enable/disable servers with one click
- **Tool Management** - Enable/disable individual tools

#### Monitoring & Logs
- **Live Logs** - Real-time server logs with filtering
- **Performance Metrics** - Response times and error rates
- **Connection Status** - Visual connection status indicators
- **Tool Statistics** - Tool usage and availability stats

#### Configuration
- **Client Config Generation** - Generate configurations for Claude Desktop, Cursor, etc.
- **Import/Export** - Backup and restore configurations
- **Validation** - Configuration validation and error checking

### MCP Client Configuration

#### Claude Desktop
```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "mcpdog",
      "args": ["serve"],
      "cwd": "/path/to/mcpdog"
    }
  }
}
```

#### Cursor
```json
{
  "mcp": {
    "mcpServers": {
      "mcpdog": {
        "command": "mcpdog",
        "args": ["serve"],
        "cwd": "/path/to/mcpdog"
      }
    }
  }
}
```

## 🏗️ Architecture Details

### Core Components

#### 1. MCPDog Server (`src/core/mcpdog-server.ts`)
- Main server implementation
- Handles MCP protocol communication
- Manages client connections and requests

#### 2. Tool Router (`src/router/tool-router.ts`)
- Routes tool calls to appropriate servers
- Handles tool name conflicts
- Manages tool availability

#### 3. Adapter Factory (`src/adapters/adapter-factory.ts`)
- Creates adapters for different transport protocols
- Supports stdio, HTTP SSE, and Streamable HTTP
- Handles connection management

#### 4. Config Manager (`src/config/config-manager.ts`)
- Manages server configurations
- Handles configuration persistence
- Provides configuration validation

### Transport Protocols

#### stdio
- Direct process communication
- Suitable for local servers
- Low latency

#### HTTP SSE (Server-Sent Events)
- Real-time streaming
- Good for remote servers
- Browser-compatible

#### Streamable HTTP
- HTTP-based streaming
- Compatible with most HTTP clients
- Good for cloud services

## 📁 Project Structure

```
mcpdog/
├── src/
│   ├── core/           # Core server implementation
│   ├── adapters/       # Transport protocol adapters
│   ├── router/         # Tool routing logic
│   ├── config/         # Configuration management
│   ├── cli/            # Command-line interface
│   ├── web/            # Web server implementation
│   ├── daemon/         # Daemon process management
│   ├── logging/        # Logging system
│   └── types/          # TypeScript type definitions
├── web/                # React web dashboard
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── store/      # State management
│   │   └── types/      # TypeScript types
│   └── dist/           # Built web assets
├── docs/               # Documentation
└── tests/              # Test files
```

## 🔧 Development

### Building
```bash
# Build TypeScript
npm run build

# Build web dashboard
cd web && npm run build

# Development mode
npm run dev
```

### Testing
```bash
# Run tests
npm test

# Run integration tests
npm run test:integration
```

### Development Server
```bash
# Start development server
npm run dev

# Start with web interface
npm run web
```

## 📊 Configuration

### Configuration File Location
- **Default**: `./mcpdog.config.json`
- **User**: `~/.mcpdog/mcpdog.config.json`
- **Custom**: Specify with `--config` flag

### Configuration Format
```json
{
  "version": "2.0.0",
  "servers": {
    "my-server": {
      "name": "my-server",
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
  },
  "logging": {
    "level": "info"
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Conventional commits for commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the protocol specification
- [Claude Desktop](https://claude.ai/) for MCP client implementation
- [Cursor](https://cursor.sh/) for MCP integration
- All contributors and users of MCPDog

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kinhunt/mcpdog/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kinhunt/mcpdog/discussions)
- **Documentation**: [Project Wiki](https://github.com/kinhunt/mcpdog/wiki)

---

**MCPDog** - Your loyal companion for MCP server management! 🐕🦴

*"Good dog! Now fetch me that perfect MCP configuration!"*