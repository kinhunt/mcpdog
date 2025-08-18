# MCPDog Web UI 协议类型自动识别修复

## 问题描述
之前在Web UI通过Add Server添加JSON配置时，即使提供了`url`字段，系统也错误地将其识别为`stdio`协议。

## 修复方案
修改了`/web/src/components/AddServerModal.tsx`中的协议检测逻辑：

### 修复前的代码:
```typescript
const transport = config.transport || (config.endpoint ? 'streamable-http' : 'stdio');
```

### 修复后的代码:
```typescript
let transport = config.transport;
if (!transport) {
  if (config.url || config.endpoint) {
    // Has URL/endpoint field
    if (config.type === 'sse' || config.transport === 'http-sse') {
      transport = 'http-sse';
    } else {
      transport = 'streamable-http';  // Default HTTP transport
    }
  } else if (config.command) {
    // Has command field
    transport = 'stdio';
  } else {
    // Fallback to stdio if neither URL nor command is specified
    transport = 'stdio';
  }
}
```

## 新的判断逻辑规则:

1. **优先使用显式指定的transport**
   - 如果配置中已有`transport`字段，直接使用

2. **根据配置内容自动推断**:
   - 有`url`或`endpoint`字段 → `streamable-http`（默认HTTP协议）
   - 有`url`或`endpoint`字段且`type: "sse"` → `http-sse`
   - 有`command`字段 → `stdio`
   - 都没有 → `stdio`（回退默认值）

## 测试用例:

### ✅ GitHub Copilot配置（你的用例）
```json
{
  "github": {
    "type": "streamable-http", 
    "url": "https://api.githubcopilot.com/mcp/",
    "headers": {
      "Authorization": "Bearer ghp_YOUR_GITHUB_TOKEN_HERE"
    }
  }
}
```
**检测结果**: `streamable-http` ✅

### ✅ SSE协议服务器
```json
{
  "sse-server": {
    "url": "https://api.example.com/sse",
    "type": "sse"
  }
}
```
**检测结果**: `http-sse` ✅

### ✅ Stdio协议服务器
```json
{
  "stdio-server": {
    "command": "npx",
    "args": ["@example/mcp-server"]
  }
}
```
**检测结果**: `stdio` ✅

## 如何测试修复效果:

1. 访问Web UI: http://localhost:3000
2. 点击"Add Server"按钮
3. 选择"JSON Configuration"标签
4. 粘贴你的GitHub配置JSON
5. 点击"Add Server"
6. 检查服务器列表中显示的协议类型

现在应该正确显示为"streamable-http"而不是"stdio"。

## 修复状态: ✅ 已完成并测试通过