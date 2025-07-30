# MCPDog 2.0 演示指南

## 🚀 启动 MCPDog

```bash
cd /Users/qiujianheng/Documents/dev/mcpdog
npm run start
```

## 🧪 测试场景

### 1. 邮件发送场景
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call", 
  "params": {
    "name": "use_mcpdog",
    "arguments": {
      "user_request": "send email to john@example.com with subject 'Meeting Tomorrow', use mcpdog"
    }
  }
}
```

### 2. 数据库操作场景
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "use_mcpdog", 
    "arguments": {
      "user_request": "I need to query database for user data, use mcpdog"
    }
  }
}
```

### 3. 文件处理场景
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "use_mcpdog",
    "arguments": {
      "user_request": "process file data.csv and convert to json, use mcpdog"
    }
  }
}
```

### 4. 中文请求场景
```json
{
  "jsonrpc": "2.0", 
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "use_mcpdog",
    "arguments": {
      "user_request": "我要发送邮件给客户，use mcpdog"
    }
  }
}
```

### 5. 无效请求场景
```json
{
  "jsonrpc": "2.0",
  "id": 5, 
  "method": "tools/call",
  "params": {
    "name": "use_mcpdog",
    "arguments": {
      "user_request": "just random text, use mcpdog"
    }
  }
}
```

## 🎯 预期效果

每个请求都应该返回：
1. 智能解析用户意图
2. 推荐最匹配的工具
3. 提供具体的使用示例
4. 包含配置指导

## 🔧 MCP 客户端配置

将以下配置添加到你的 MCP 客户端：

```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "node",
      "args": ["/Users/qiujianheng/Documents/dev/mcpdog/dist/index.js"],
      "cwd": "/Users/qiujianheng/Documents/dev/mcpdog"
    }
  }
}
```

## 🐕 使用方法

1. 在任何 MCP 客户端中，你会看到 `use_mcpdog` 工具
2. 描述你想要实现的功能，在末尾加上 `, use mcpdog`
3. MCPDog 会智能分析并推荐最合适的工具
4. 复制推荐的代码直接使用！

**示例**:
- "send email to team@company.com, use mcpdog"
- "resize image photo.jpg, use mcpdog"  
- "query database for users, use mcpdog"
- "我要处理Excel文件，use mcpdog"