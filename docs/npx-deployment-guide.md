# MCPDog NPX 部署指南

## 概述

MCPDog 现在支持通过 npx 直接调用，无需本地安装。这使得在 MCP client 中配置 mcpdog 变得非常简单。

## 功能特性

- ✅ 自动检测 npx 调用
- ✅ 自动运行 proxy 命令
- ✅ 支持版本指定
- ✅ 无需本地安装
- ✅ 自动更新（使用 @latest）

## 发布到 NPM

### 1. 准备发布

确保你的 package.json 配置正确：

```json
{
  "name": "mcpdog",
  "version": "2.0.0",
  "bin": {
    "mcpdog": "./dist/cli/cli-main.js"
  }
}
```

### 2. 构建项目

```bash
npm run build
```

### 3. 发布到 NPM

```bash
npm login
npm publish
```

## MCP Client 配置

### 基本配置

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

### 指定版本

```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "npx",
      "args": ["mcpdog@2.0.0"]
    }
  }
}
```

### 本地开发配置

```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "node",
      "args": ["/path/to/mcpdog/dist/cli/cli-main.js"]
    }
  }
}
```

## 使用流程

### 1. 启动 Daemon

```bash
npx mcpdog@latest start
```

### 2. 配置 MCP Client

在你的 MCP client 配置文件中添加：

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

### 3. 自动连接

当 MCP client 启动时，会自动：
1. 通过 npx 调用 mcpdog
2. mcpdog 检测到 npx 调用
3. 自动运行 proxy 命令
4. 连接到 mcpdog daemon

## 工作原理

### NPX 检测逻辑

```typescript
const isNpxCall = process.argv.length <= 2 || 
                  (process.argv.length === 3 && 
                   (process.argv[2] === '--help' || 
                    process.argv[2] === '-h' || 
                    process.argv[2] === '--version' || 
                    process.argv[2] === '-v'));
```

### 自动行为

当检测到 npx 调用时：
1. 显示信息："MCPDog called via npx - automatically running proxy command"
2. 自动执行 `proxy` 命令
3. 连接到 daemon 并作为 MCP 代理运行

## 优势

### 对用户的好处

- **无需安装**：不需要全局安装 mcpdog
- **版本管理**：可以指定特定版本或使用最新版本
- **自动更新**：使用 @latest 时自动获取最新版本
- **简化配置**：配置简单，类似其他 npx 包

### 对开发者的好处

- **易于分发**：通过 npm 分发，用户容易获取
- **版本控制**：可以发布多个版本
- **标准化**：遵循 npm 包的标准做法

## 测试

### 本地测试

```bash
# 测试 npx 行为
node dist/cli/cli-main.js

# 测试帮助信息
node dist/cli/cli-main.js --help

# 测试版本信息
node dist/cli/cli-main.js --version
```

### 发布前测试

```bash
# 模拟发布
npm publish --dry-run

# 检查包内容
npm pack
```

## 故障排除

### 常见问题

1. **权限问题**
   ```bash
   chmod +x dist/cli/cli-main.js
   ```

2. **构建问题**
   ```bash
   npm run build
   ```

3. **发布问题**
   ```bash
   npm login
   npm publish
   ```

### 调试

启用详细日志：
```bash
npx mcpdog@latest --verbose
```

## 版本管理

### 语义化版本

- **主版本**：重大功能变更
- **次版本**：新功能添加
- **修订版本**：bug 修复

### 发布流程

1. 更新版本号
2. 构建项目
3. 测试功能
4. 发布到 npm

```bash
npm version patch  # 或 minor, major
npm run build
npm publish
```

## 总结

通过 npx 支持，MCPDog 现在可以像其他流行的工具一样使用：

- 配置简单
- 无需安装
- 自动更新
- 版本控制

这使得 MCPDog 更容易被用户采用和集成到他们的 MCP 工作流程中。 