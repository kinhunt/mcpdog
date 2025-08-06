# MCPDog NPX 故障排除指南

## 常见问题

### 1. Web 界面文件未找到错误

**错误信息**：
```
Error: ENOENT: no such file or directory, stat '/Users/username/.npm/_npx/xxx/node_modules/mcpdog/web/dist/index.html'
```

**原因**：
当通过 npx 调用时，mcpdog 的工作目录发生了变化，静态文件路径不正确。

**解决方案**：
- ✅ 已修复：现在 mcpdog 会自动检测多个可能的静态文件路径
- ✅ 已添加：如果找不到 web 文件，会显示友好的错误页面
- ✅ 已优化：支持开发和生产环境的不同路径

### 2. JSON 解析错误

**错误信息**：
```
Unexpected token '[34mℹ[0m'... is not valid JSON
```

**原因**：
CLI 的颜色输出污染了 MCP 协议的 JSON 通信。

**解决方案**：
- ✅ 已修复：在 npx 模式下自动禁用所有 CLI 输出
- ✅ 已添加：MCP 模式检测，确保协议通信纯净
- ✅ 已优化：保持 MCP 协议的标准格式

### 3. 路径检测逻辑

**修复内容**：
```typescript
const possiblePaths = [
  path.join(__dirname, '../../web/dist'), // Development
  path.join(__dirname, '../web/dist'), // Production
  path.join(process.cwd(), 'web/dist'), // Current working directory
  path.join(process.cwd(), 'dist'), // Alternative
];
```

### 4. MCP 模式

**新增功能**：
- 自动检测 npx 调用
- 在 MCP 模式下禁用所有 CLI 输出
- 确保协议通信的纯净性

## 测试验证

### 1. 本地测试

```bash
# 测试 npx 模式（无输出）
node dist/cli/cli-main.js

# 测试正常模式（有输出）
node dist/cli/cli-main.js --help
```

### 2. 功能验证

- ✅ npx 调用时自动运行 proxy 命令
- ✅ 禁用所有 CLI 输出，避免协议污染
- ✅ 自动检测静态文件路径
- ✅ 提供友好的错误页面

## 配置示例

### MCP Client 配置

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

## 故障排除步骤

### 1. 检查 daemon 状态

```bash
npx mcpdog@latest status
```

### 2. 启动 daemon

```bash
npx mcpdog@latest start
```

### 3. 检查 web 界面

访问 `http://localhost:3000` 查看 web 界面

### 4. 查看日志

```bash
npx mcpdog@latest --verbose
```

## 版本要求

- Node.js >= 18
- npm >= 7 (支持 npx)

## 联系支持

如果问题仍然存在，请：

1. 检查 Node.js 和 npm 版本
2. 确认网络连接正常
3. 查看详细错误日志
4. 提交 issue 到 GitHub 仓库 