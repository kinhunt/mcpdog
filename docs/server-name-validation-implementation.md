# 服务器名称验证实现总结

## 概述

根据最佳实践，我们实现了统一的服务器名称验证系统，确保系统的一致性和稳定性。

## 实现的功能

### 1. 统一的验证规则

- **字符限制**：只允许字母、数字、连字符和下划线
- **长度限制**：最小1个字符，最大50个字符
- **保留名称检查**：防止使用系统保留名称
- **冲突检测**：检查与现有服务器名称的冲突

### 2. 核心组件

#### A. 服务器名称验证器 (`src/utils/server-name-validator.ts`)

```typescript
export class ServerNameValidator {
  // 验证服务器名称
  static validateServerName(name: string): ServerNameValidationResult
  
  // 生成唯一名称
  static generateUniqueName(baseName: string, existingNames: string[]): string
  
  // 标准化名称
  static normalizeServerName(name: string): string
  
  // 检查名称冲突
  static checkNameConflict(name: string, existingNames: string[]): boolean
}
```

#### B. 配置管理器增强 (`src/config/config-manager.ts`)

- 添加服务器时进行名称验证
- 更新服务器时检查名称冲突
- 支持服务器重命名功能
- 生成唯一服务器名称

#### C. Web UI 增强

- **AddServerModal**：实时名称验证和智能建议
- **ServerPanel**：编辑时的名称验证和冲突检测
- 用户友好的错误提示和建议

#### D. 后端 API 增强 (`src/daemon/daemon-web-server.ts`)

- 添加服务器时的完整验证
- 更新服务器时的冲突检测
- 详细的错误响应和建议

## 验证规则

### 允许的字符
- 字母：`a-z`, `A-Z`
- 数字：`0-9`
- 连字符：`-`
- 下划线：`_`

### 长度限制
- 最小：1个字符
- 最大：50个字符

### 保留名称
```typescript
const reservedNames = [
  'config', 'settings', 'system', 'admin', 'root', 'default',
  'test', 'temp', 'tmp', 'backup', 'old', 'new',
  'server', 'client', 'api', 'web', 'app', 'service'
];
```

## 用户体验改进

### 1. 实时验证
- 输入时立即显示验证结果
- 颜色编码的输入框（红色表示无效，绿色表示有效）

### 2. 智能建议
- 自动生成有效的名称建议
- 一键应用建议

### 3. 错误处理
- 清晰的错误消息
- 具体的修复建议
- 冲突检测和提示

## 示例

### 有效的服务器名称
```
playwright
filesystem-server
server_1
myServer123
browser-automation
```

### 无效的服务器名称（带建议）
```
"my server" → "my-server"
"server@domain.com" → "server-domain-com"
"我的服务器" → 需要用户手动修改
"server/with/path" → "server-with-path"
```

## 配置中的 Key 和 Name 关系

### 统一处理
- **Key** 是配置文件中的服务器标识符
- **Name** 字段与 Key 保持一致
- 系统强制使用 Key 作为最终名称

### 配置示例
```json
{
  "servers": {
    "playwright": {           // ← Key
      "name": "playwright",   // ← Name (与 Key 一致)
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## 冲突处理策略

### 1. 添加服务器时
- 检查名称是否已存在
- 如果存在，拒绝添加并提供错误信息

### 2. 编辑服务器时
- 检查新名称是否与其他服务器冲突
- 如果冲突，拒绝更新并提供错误信息

### 3. 自动重命名
- 提供生成唯一名称的功能
- 自动添加数字后缀（如 `playwright-1`）

## 系统兼容性

### 1. 文件系统兼容性
- 避免特殊字符导致的文件系统问题
- 确保日志文件和临时文件的命名安全

### 2. 命令行兼容性
- 避免需要转义的字符
- 确保命令行参数的正确传递

### 3. URL 路径兼容性
- 避免 URL 编码问题
- 确保 Web API 路由的正确工作

### 4. 工具名称冲突处理
- 使用服务器名称作为工具名称前缀
- 避免不同服务器的同名工具冲突

## 问题解决

### 1. 配置文件保存问题

**问题**：Web UI 修改服务器名称后，配置文件没有更新。

**原因**：Daemon 使用的是全局配置文件 `~/.mcpdog/mcpdog.config.json`，而不是项目目录下的配置文件。

**解决方案**：
- API 调用正确保存到全局配置文件
- 确保 daemon 使用正确的配置文件路径

### 2. 服务器连接和工具列表问题

**问题**：添加或修改服务器后，UI 看不到服务器的工具列表。

**原因**：`reloadConfig` 方法只是重新加载了配置，但没有重新初始化 MCP 服务器来连接新添加的服务器。

**解决方案**：
1. 在 `MCPDogServer` 中添加公共方法 `handleConfigReload()`
2. 在 `MCPDogDaemon` 的 `reloadConfig` 方法中调用 `handleConfigReload()`
3. 确保配置重载后重新初始化 MCP 服务器

### 3. 修复的代码

#### A. MCPDogServer 增强
```typescript
// src/core/mcpdog-server.ts
async handleConfigReload(): Promise<void> {
  await this.handleConfigUpdate();
}
```

#### B. MCPDogDaemon 修复
```typescript
// src/daemon/mcpdog-daemon.ts
private async reloadConfig() {
  console.log('[DAEMON] Manual config reload requested');
  await this.configManager.loadConfig();
  
  // Re-initialize MCP server to connect to new servers
  try {
    await this.mcpServer.handleConfigReload();
    console.log('[DAEMON] MCP Server reinitialized after config reload');
  } catch (error) {
    console.error('[DAEMON] Failed to reinitialize MCP Server after config reload:', error);
  }
}
```

## 测试结果

### API 测试结果
```
🧪 Testing Web UI Server Name Modification

1. Getting current servers...
   Found 2 servers: [ 'playwright', 'test-server' ]

2. Testing server name update: playwright -> playwright-renamed
   ✅ Server name updated successfully

3. Checking updated servers...
   Found 2 servers: [ 'test-server', 'playwright-renamed' ]

4. Testing adding a new server...
   ✅ New server added successfully

5. Final server list...
   Found 3 servers: [ 'test-server', 'playwright-renamed', 'new-test-server' ]
   - test-server: connected=true, tools=24
   - playwright-renamed: connected=true, tools=24
   - new-test-server: connected=true, tools=24
```

### 功能验证
- ✅ 服务器名称修改成功保存到配置文件
- ✅ 新服务器正确连接并显示工具列表
- ✅ 配置重载后服务器状态正确更新
- ✅ 所有验证规则正常工作

## 总结

通过实现统一的服务器名称验证系统，我们：

1. **提高了系统稳定性**：避免了特殊字符导致的问题
2. **改善了用户体验**：提供了实时验证和智能建议
3. **确保了数据一致性**：统一了 Key 和 Name 的处理
4. **增强了错误处理**：提供了清晰的错误信息和修复建议
5. **支持了系统扩展**：为未来的功能扩展提供了良好的基础
6. **解决了实际问题**：修复了配置文件保存和服务器连接问题

这个实现遵循了最佳实践，确保了系统的可靠性和用户友好性。所有测试都通过，系统现在可以正确处理服务器名称的添加、修改和验证。 