# 🐕 MCPDog CLI 使用指南

MCPDog 2.0 现在提供了完整的命令行界面，让您可以轻松管理MCP服务器配置、执行协议检测、性能优化等操作。

## 🚀 快速开始

### 安装和启动

```bash
# 1. 构建项目
npm run build

# 2. 创建全局命令链接
npm link

# 3. 查看帮助
mcpdog --help

# 4. 查看版本信息
mcpdog --version

# 5. 启动stdio模式服务器
mcpdog serve
```

### 全局选项

```bash
-c, --config <path>    # 配置文件路径 (默认: ./mcpdog.config.json)
-h, --help             # 显示帮助信息
-v, --version          # 显示版本信息
--verbose              # 详细输出
--json                 # JSON格式输出
--no-color             # 禁用颜色输出
```

## 📋 命令详解

### 1. 配置管理 (`mcpdog config`)

#### 列出所有服务器
```bash
# 查看所有配置的服务器
mcpdog config list

# JSON格式输出
mcpdog config list --json
```

#### 添加服务器

**智能自动检测模式** (推荐):
```bash
# 自动检测并添加HTTP服务器
mcpdog config add my-api https://api.example.com --auto-detect

# 跳过确认提示
mcpdog config add my-api https://api.example.com --auto-detect --yes

# 设置检测超时
mcpdog config add my-api https://api.example.com --auto-detect --timeout 15000
```

**手动配置模式**:
```bash
# 添加stdio服务器
mcpdog config add my-server "node server.js" --transport stdio

# 添加HTTP服务器 (手动指定协议)
mcpdog config add api-server https://api.example.com --transport streamable-http --timeout 45000

# 添加带认证的服务器
mcpdog config add secure-api https://api.example.com --headers '{"Authorization":"Bearer token123"}'
```

#### 服务器管理
```bash
# 查看服务器详情
mcpdog config show my-server

# 更新服务器配置
mcpdog config update my-server --timeout 60000 --description "Updated server"

# 启用/禁用服务器
mcpdog config enable my-server
mcpdog config disable my-server

# 删除服务器
mcpdog config remove old-server
```

### 2. 协议检测 (`mcpdog detect`)

#### 检测单个目标
```bash
# 检测现有服务器
mcpdog detect my-server

# 检测新的HTTP端点
mcpdog detect https://api.example.com

# 检测stdio命令
mcpdog detect "node mcp-server.js"

# 详细检测信息
mcpdog detect https://api.example.com --detailed
```

#### 批量检测
```bash
# 检测所有配置的服务器
mcpdog detect --all

# 检测并自动更新优化的协议
mcpdog detect --all --yes

# 详细输出
mcpdog detect --all --verbose
```

#### 检测选项
```bash
--all                  # 检测所有服务器
--timeout <ms>         # 检测超时时间 (默认: 10000)
--detailed             # 显示详细检测信息
--no-add               # 不询问是否添加新服务器
--yes                  # 自动确认所有操作
```

### 3. 性能优化 (`mcpdog optimize`)

#### 单个服务器优化
```bash
# 优化特定服务器
mcpdog optimize my-server

# 预览优化建议 (不实际应用)
mcpdog optimize my-server --preview

# 自动应用优化
mcpdog optimize my-server --apply
```

#### 批量优化
```bash
# 优化所有服务器 (预览模式)
mcpdog optimize --all --preview

# 批量应用所有优化
mcpdog optimize --all --apply

# 交互式确认
mcpdog optimize --all
```

### 4. 诊断和修复 (`mcpdog diagnose`)

#### 服务器诊断
```bash
# 诊断单个服务器
mcpdog diagnose my-server

# 诊断并自动修复
mcpdog diagnose my-server --fix

# 批量诊断
mcpdog diagnose --all
```

#### 系统健康检查
```bash
# 执行系统健康检查
mcpdog diagnose --health-check

# JSON格式输出
mcpdog diagnose --health-check --json
```

### 5. 配置审计 (`mcpdog audit`)

#### 审计类型
```bash
# 全面审计
mcpdog audit

# 性能审计
mcpdog audit --performance

# 安全审计
mcpdog audit --security

# 合规性审计
mcpdog audit --compliance
```

#### 导出报告
```bash
# 导出JSON报告
mcpdog audit --export json

# 导出文本报告
mcpdog audit --performance --export txt
```

### 6. 服务启动 (`mcpdog serve`)

#### stdio模式 (默认)
```bash
# 启动stdio模式服务器
mcpdog serve

# 使用自定义配置
mcpdog serve --config ./my-config.json
```

#### Web模式 (开发中)
```bash
# 启动Web界面 (功能开发中)
mcpdog serve --web-port 3000
```

## 🎯 实际使用场景

### 场景1: 新服务部署
```bash
# 1. 添加新服务器 (自动检测最佳协议)
mcpdog config add production-api https://prod-api.company.com --auto-detect

# 2. 验证配置
mcpdog detect production-api --detailed

# 3. 优化性能
mcpdog optimize production-api --apply

# 4. 启动服务
mcpdog serve
```

### 场景2: 批量服务器管理
```bash
# 1. 查看所有服务器状态
mcpdog config list

# 2. 批量协议检测和优化
mcpdog detect --all --yes
mcpdog optimize --all --apply

# 3. 系统健康检查
mcpdog diagnose --health-check

# 4. 生成审计报告
mcpdog audit --export json
```

### 场景3: 故障排查
```bash
# 1. 诊断问题服务器
mcpdog diagnose problem-server --fix

# 2. 重新检测协议
mcpdog detect problem-server --detailed

# 3. 查看系统整体状态
mcpdog audit --performance
```

### 场景4: 配置迁移
```bash
# 1. 导出当前配置审计
mcpdog audit --export json

# 2. 批量优化所有服务器
mcpdog optimize --all --preview
mcpdog optimize --all --apply

# 3. 验证迁移结果
mcpdog detect --all
```

## 📊 输出格式

### 彩色输出 (默认)
- ✅ 绿色: 成功/正常状态
- ⚠️ 黄色: 警告/需要注意
- ❌ 红色: 错误/问题
- ℹ️ 蓝色: 信息/提示
- 🔍 青色: 分析/检测过程

### JSON输出模式
```bash
# 任何命令都可以输出JSON格式
mcpdog config list --json
mcpdog detect --all --json
mcpdog audit --json
```

### 详细输出模式
```bash
# 显示详细的操作过程
mcpdog detect --all --verbose
mcpdog optimize --all --verbose
```

## ⚡ 性能优化建议

### 协议选择优化
- **streamable-http**: 最新协议，最佳性能
- **http-sse**: 传统协议，逐步废弃
- **stdio**: 本地进程通信，适合开发

### 超时时间优化
```bash
# stdio协议建议更长超时
mcpdog config update stdio-server --timeout 60000

# HTTP协议推荐30秒
mcpdog config update http-server --timeout 30000
```

### 批量操作优化
```bash
# 使用--yes跳过交互确认
mcpdog detect --all --yes
mcpdog optimize --all --apply

# 使用--json进行程序化处理
mcpdog audit --json > report.json
```

## 🛠️ 故障排查

### 常见问题

**1. 配置文件找不到**
```bash
# 指定配置文件路径
mcpdog config list --config ./custom-config.json
```

**2. 协议检测失败**
```bash
# 增加检测超时时间
mcpdog detect https://slow-api.com --timeout 30000

# 查看详细错误信息
mcpdog detect problem-server --verbose
```

**3. 服务器连接问题**
```bash
# 执行全面诊断
mcpdog diagnose problem-server --fix

# 检查系统健康状态
mcpdog diagnose --health-check
```

### 调试模式
```bash
# 启用详细输出查看操作过程
mcpdog --verbose config add test-server https://api.test.com --auto-detect

# 输出JSON格式便于程序化处理
mcpdog --json detect --all > detection-results.json
```

## 🔄 工作流集成

### CI/CD集成
```bash
#!/bin/bash
# 自动化部署脚本示例

# 1. 检查配置健康状态
mcpdog diagnose --health-check --json > health.json

# 2. 批量优化配置
mcpdog optimize --all --apply

# 3. 生成部署报告
mcpdog audit --export json > deployment-audit.json

# 4. 启动服务
mcpdog serve &
```

### 监控脚本
```bash
#!/bin/bash
# 定期健康检查脚本

while true; do
  mcpdog diagnose --health-check --json > "health-$(date +%Y%m%d-%H%M%S).json"
  sleep 3600  # 每小时检查一次
done
```

这个CLI界面让MCPDog的协议自动检测功能真正发挥了作用，用户现在可以通过简单的命令完成复杂的服务器管理任务！