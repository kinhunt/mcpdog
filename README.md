# MCPDog 🐕

> **Your loyal companion for discovering and fetching MCP services**

MCPDog is your faithful friend in navigating the MCP (Model Context Protocol) ecosystem. Like a well-trained dog that helps you find exactly what you're looking for, MCPDog sniffs out the perfect MCP services for your needs and brings them right to you!

## ✨ Features

- 🔍 **Smart Service Discovery** - Tell MCPDog what you need, and it'll fetch the best services
- 🧰 **Personal Service Collection** - Build your own pack of favorite MCP services  
- 📋 **Detailed Service Profiles** - Get comprehensive info about each service
- 🎯 **One-Click Integration** - Add services to your collection instantly
- 📊 **Usage Tracking** - See which services you use most often
- 💾 **Import/Export** - Share your service collections with others

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/kinhunt/mcpdog
cd mcpdog
npm install
npm run build
```

### MCP Client Configuration

Add MCPDog to your MCP client configuration:

```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/mcpdog"
    }
  }
}
```

## 🐾 Usage Examples

### Discover Services
```
discover_services("email sending")
```

MCPDog will sniff out the best services for you:
```
🔍 Found 3 email-related services:

1. **EmailService Pro** ⭐⭐⭐⭐⭐
   - 1,250 users | 4.7/5.0 rating
   - Features: send_email, send_bulk_email, create_template
   - Example: send_email(to="user@example.com", subject="Hello")

2. **Gmail API Service** ⭐⭐⭐⭐
   - 890 users | 4.4/5.0 rating  
   - Features: gmail_send, gmail_read
   - Example: gmail_send(to="friend@gmail.com", subject="Hi")
```

### Build Your Pack
```
manage_toolbox("add", "email-service-pro")
```

MCPDog will fetch it for you:
```
✅ Successfully added EmailService Pro to your pack!
🐕 MCPDog fetched this service for you!
🔄 Reconnect your MCP client to see new tools
```

### Use Your Services
After adding to your pack, you can directly use:
```
email-service-pro_send_email({
  "to": "team@company.com",
  "subject": "Meeting Reminder", 
  "body": "Don't forget our meeting at 3 PM!"
})
```

## 🛠️ Available Commands

| Tool | Description | Example |
|------|-------------|---------|
| `discover_services` | Let MCPDog find MCP services for you | `discover_services("database")` |
| `manage_toolbox` | Manage your service pack | `manage_toolbox("view")` |
| `get_service_info` | Get detailed service information | `get_service_info("email-service-pro")` |

### Service Pack Management

- `manage_toolbox("view")` - View your current service pack
- `manage_toolbox("add", "service-id")` - Add service to your pack
- `manage_toolbox("remove", "service-id")` - Remove service from pack  
- `manage_toolbox("stats")` - View usage statistics
- `manage_toolbox("export")` - Export pack configuration
- `manage_toolbox("import", null, "config-json")` - Import pack configuration

## 🏗️ Architecture

MCPDog follows a discovery and curation model:

1. **Discovery Engine** - Sniffs out and ranks available MCP services
2. **Service Pack** - Your curated collection of favorite services
3. **Dynamic Tools** - Generates personalized tool list for MCP clients
4. **Service Proxy** - Routes calls to actual MCP services

## 📁 Data Storage

Your service pack is stored locally at:
- **Linux/macOS**: `~/.mcpdog/user-toolbox.json`
- **Windows**: `%USERPROFILE%\.mcpdog\user-toolbox.json`

## 🐕 Why MCPDog?

- **🔍 Great at Finding Things** - Like a search and rescue dog for MCP services
- **🦴 Loyal & Reliable** - Always there when you need to find services
- **🏠 Knows Your Home** - Remembers your favorite services
- **🎾 Playful & Friendly** - Makes service discovery fun and intuitive
- **🐕‍🦺 Service-Oriented** - Trained specifically to help you with MCP services

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**MCPDog** - The best boy for finding MCP services! 🐕🦴

*"Good dog! Now fetch me that perfect MCP service!"*