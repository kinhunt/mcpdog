# MCPDog 项目文件依赖关系分析

## 项目概述

MCPDog 是一个 MCP (Model Context Protocol) 服务器管理工具，包含后端服务器 (`src/`) 和前端 Web 界面 (`web/`)。

## 目录结构分析

### 1. 后端核心 (`src/`)

#### 1.1 核心模块 (`src/core/`)
- **mcpdog-server.ts** (22KB, 669行) - 主服务器类
  - 依赖: `config-manager.ts`, `tool-router.ts`, `adapter-factory.ts`, `types/index.ts`
  - 功能: MCPDog 服务器的核心实现，处理请求路由和适配器管理

- **auto-config-generator.ts** (10KB, 362行) - 自动配置生成器
  - 功能: 自动生成服务器配置

- **protocol-detector.ts** (13KB, 438行) - 协议检测器
  - 功能: 检测和识别 MCP 协议

#### 1.2 配置管理 (`src/config/`)
- **config-manager.ts** (20KB, 659行) - 配置管理器
  - 依赖: `types/index.ts`
  - 功能: 管理服务器配置，处理配置更新事件

#### 1.3 适配器层 (`src/adapters/`)
- **adapter-factory.ts** (6.0KB, 192行) - 适配器工厂
  - 依赖: `http-sse-adapter.ts`, `stdio-adapter.ts`, `streamable-http-adapter.ts`
  - 功能: 创建不同类型的服务器适配器

- **http-sse-adapter.ts** (17KB, 567行) - HTTP SSE 适配器
  - 功能: 处理 HTTP Server-Sent Events 连接

- **stdio-adapter.ts** (25KB, 732行) - STDIO 适配器
  - 功能: 处理标准输入输出连接

- **streamable-http-adapter.ts** (11KB, 362行) - 流式 HTTP 适配器
  - 功能: 处理流式 HTTP 连接

#### 1.4 路由层 (`src/router/`)
- **tool-router.ts** (20KB, 664行) - 工具路由器
  - 依赖: `config-manager.ts`, `types/index.ts`
  - 功能: 路由工具调用到相应的服务器适配器

#### 1.5 守护进程 (`src/daemon/`)
- **mcpdog-daemon.ts** (12KB, 415行) - 守护进程主类
  - 依赖: `daemon-client.ts`, `daemon-web-server.ts`
  - 功能: 管理后台守护进程

- **daemon-web-server.ts** (32KB, 956行) - 守护进程 Web 服务器
  - 功能: 提供 Web 界面服务

- **daemon-client.ts** (5.8KB, 237行) - 守护进程客户端
  - 功能: 与守护进程通信

- **stdio-proxy.ts** (4.3KB, 162行) - STDIO 代理
  - 功能: 代理 STDIO 连接

#### 1.6 CLI 工具 (`src/cli/`)
- **cli-main.ts** (3.2KB, 109行) - CLI 主入口
  - 依赖: `cli-router.ts`, `commands/`

- **cli-router.ts** (9.3KB, 284行) - CLI 路由
  - 依赖: `commands/`

- **cli-utils.ts** (7.6KB, 255行) - CLI 工具函数
  - 功能: 提供 CLI 通用工具函数

##### CLI 命令模块 (`src/cli/commands/`)
- **config-commands.ts** (36KB, 1127行) - 配置命令
- **audit-commands.ts** (17KB, 491行) - 审计命令
- **detect-commands.ts** (12KB, 341行) - 检测命令
- **diagnose-commands.ts** (13KB, 364行) - 诊断命令
- **daemon-commands.ts** (9.0KB, 330行) - 守护进程命令
- **start-command.ts** (6.9KB, 214行) - 启动命令
- **optimize-commands.ts** (6.9KB, 211行) - 优化命令
- **proxy-command.ts** (3.2KB, 103行) - 代理命令

#### 1.7 Web 服务器 (`src/web/`)
- **web-server.ts** (18KB, 560行) - Web 服务器
  - 功能: 提供 Web 界面服务

#### 1.8 日志管理 (`src/logging/`)
- **server-log-manager.ts** (6.2KB, 241行) - 服务器日志管理器
  - 功能: 管理服务器日志

#### 1.9 工具和辅助模块
- **tool-recommender.ts** (7.9KB, 252行) - 工具推荐器
  - 功能: 推荐合适的工具

- **tool-finder.ts** (3.3KB, 115行) - 工具查找器
  - 功能: 查找可用工具

- **intent-analyzer.ts** (5.0KB, 183行) - 意图分析器
  - 功能: 分析用户意图

- **proxy-server-manager.ts** (5.0KB, 175行) - 代理服务器管理器
  - 功能: 管理代理服务器

- **mcp-registry.ts** (5.4KB, 212行) - MCP 注册表
  - 功能: 管理 MCP 服务器注册

- **mock-tool-database.ts** (14KB, 514行) - 模拟工具数据库
  - 功能: 提供模拟工具数据

#### 1.10 类型定义 (`src/types/`)
- **index.ts** (3.2KB, 134行) - 类型定义
  - 功能: 定义项目中的所有 TypeScript 类型

#### 1.11 主入口 (`src/`)
- **index.ts** (7.4KB, 238行) - 主入口文件
  - 依赖: `core/mcpdog-server.ts`, `config/config-manager.ts`, `types/index.ts`
  - 功能: 应用程序的主入口点

### 2. 前端 Web 界面 (`web/`)

#### 2.1 主应用 (`web/src/`)
- **App.tsx** (2.3KB, 55行) - 主应用组件
  - 依赖: `components/ServerManager`, `hooks/useWebSocket`, `store/useAppStore`
  - 功能: 应用程序的主界面

- **main.tsx** (235B, 10行) - 应用入口
  - 功能: React 应用入口点

- **index.css** (1.8KB, 66行) - 全局样式
  - 功能: 全局 CSS 样式

#### 2.2 组件 (`web/src/components/`)
- **ServerManager.tsx** (6.7KB, 189行) - 服务器管理器
  - 功能: 管理服务器列表和状态

- **ServerPanel.tsx** (22KB, 535行) - 服务器面板
  - 功能: 显示服务器详细信息

- **AddServerModal.tsx** (26KB, 646行) - 添加服务器模态框
  - 功能: 添加新服务器的界面

- **ClientConfigModal.tsx** (13KB, 312行) - 客户端配置模态框
  - 功能: 配置客户端连接

- **ToolsPanel.tsx** (11KB, 340行) - 工具面板
  - 功能: 显示和管理工具

- **ToolsManagement.tsx** (7.4KB, 186行) - 工具管理
  - 功能: 管理工具配置

- **ClientConnections.tsx** (7.0KB, 205行) - 客户端连接
  - 功能: 显示客户端连接状态

- **ConfigManagement.tsx** (10KB, 292行) - 配置管理
  - 功能: 管理服务器配置

- **ServerLogs.tsx** (5.1KB, 143行) - 服务器日志
  - 功能: 显示服务器日志

- **ServerList.tsx** (4.4KB, 119行) - 服务器列表
  - 功能: 显示服务器列表

- **ServerListItem.tsx** (2.3KB, 65行) - 服务器列表项
  - 功能: 单个服务器列表项组件

- **StatusCard.tsx** (3.1KB, 91行) - 状态卡片
  - 功能: 显示状态信息

- **EventLog.tsx** (3.2KB, 97行) - 事件日志
  - 功能: 显示事件日志

#### 2.3 状态管理 (`web/src/store/`)
- **configStore.ts** (14KB, 391行) - 配置存储
  - 功能: 管理应用配置状态

- **useAppStore.ts** (1.6KB, 64行) - 应用状态钩子
  - 功能: 提供应用状态管理

- **configStore.ts.backup** (14KB, 395行) - 配置存储备份
  - 功能: 配置存储的备份文件

#### 2.4 钩子 (`web/src/hooks/`)
- **useWebSocket.ts** (8.4KB, 267行) - WebSocket 钩子
  - 功能: 管理 WebSocket 连接

#### 2.5 类型定义 (`web/src/types/`)
- **index.ts** (2.9KB, 133行) - 类型定义
  - 功能: 前端类型定义

- **config.ts** (1.7KB, 84行) - 配置类型
  - 功能: 配置相关类型定义

#### 2.6 构建配置
- **vite.config.ts** (331B, 19行) - Vite 配置
- **tsconfig.json** (604B, 25行) - TypeScript 配置
- **tsconfig.node.json** (212B, 10行) - Node.js TypeScript 配置
- **tailwind.config.js** (342B, 20行) - Tailwind CSS 配置
- **postcss.config.js** (79B, 6行) - PostCSS 配置
- **package.json** (682B, 29行) - 项目配置
- **index.html** (384B, 13行) - HTML 模板

## 依赖关系图

```
src/
├── index.ts (主入口)
│   ├── core/mcpdog-server.ts
│   ├── config/config-manager.ts
│   └── types/index.ts
│
├── core/
│   ├── mcpdog-server.ts (核心服务器)
│   │   ├── config/config-manager.ts
│   │   ├── router/tool-router.ts
│   │   ├── adapters/adapter-factory.ts
│   │   └── types/index.ts
│   ├── auto-config-generator.ts
│   └── protocol-detector.ts
│
├── config/
│   └── config-manager.ts
│       └── types/index.ts
│
├── adapters/
│   ├── adapter-factory.ts
│   │   ├── http-sse-adapter.ts
│   │   ├── stdio-adapter.ts
│   │   └── streamable-http-adapter.ts
│   ├── http-sse-adapter.ts
│   ├── stdio-adapter.ts
│   └── streamable-http-adapter.ts
│
├── router/
│   └── tool-router.ts
│       ├── config/config-manager.ts
│       └── types/index.ts
│
├── daemon/
│   ├── mcpdog-daemon.ts
│   │   ├── daemon-client.ts
│   │   └── daemon-web-server.ts
│   ├── daemon-web-server.ts
│   ├── daemon-client.ts
│   └── stdio-proxy.ts
│
├── cli/
│   ├── cli-main.ts
│   │   ├── cli-router.ts
│   │   └── commands/
│   ├── cli-router.ts
│   │   └── commands/
│   ├── cli-utils.ts
│   └── commands/
│       ├── config-commands.ts
│       ├── audit-commands.ts
│       ├── detect-commands.ts
│       ├── diagnose-commands.ts
│       ├── daemon-commands.ts
│       ├── start-command.ts
│       ├── optimize-commands.ts
│       └── proxy-command.ts
│
├── web/
│   └── web-server.ts
│
├── logging/
│   └── server-log-manager.ts
│
├── types/
│   └── index.ts
│
└── 工具模块/
    ├── tool-recommender.ts
    ├── tool-finder.ts
    ├── intent-analyzer.ts
    ├── proxy-server-manager.ts
    ├── mcp-registry.ts
    └── mock-tool-database.ts
```

```
web/
├── src/
│   ├── App.tsx (主应用)
│   │   ├── components/ServerManager
│   │   ├── hooks/useWebSocket
│   │   └── store/useAppStore
│   ├── main.tsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── ServerManager.tsx
│   │   ├── ServerPanel.tsx
│   │   ├── AddServerModal.tsx
│   │   ├── ClientConfigModal.tsx
│   │   ├── ToolsPanel.tsx
│   │   ├── ToolsManagement.tsx
│   │   ├── ClientConnections.tsx
│   │   ├── ConfigManagement.tsx
│   │   ├── ServerLogs.tsx
│   │   ├── ServerList.tsx
│   │   ├── ServerListItem.tsx
│   │   ├── StatusCard.tsx
│   │   └── EventLog.tsx
│   │
│   ├── store/
│   │   ├── configStore.ts
│   │   ├── useAppStore.ts
│   │   └── configStore.ts.backup
│   │
│   ├── hooks/
│   │   └── useWebSocket.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   └── config.ts
│   │
│   └── data/ (空目录)
│
├── dist/ (构建输出)
├── node_modules/
├── 配置文件/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── index.html
│
└── 日志文件/ (可删除)
    ├── web_server.log
    ├── web-server.log
    ├── daemon-debug.log
    ├── daemon-debug-fixed.log
    ├── daemon-debug-fixed2.log
    ├── daemon_ui.log
    └── web.log
```

## 关键依赖关系

### 后端核心依赖
1. **MCPDogServer** 是核心类，依赖：
   - ConfigManager (配置管理)
   - ToolRouter (工具路由)
   - AdapterFactory (适配器工厂)

2. **配置管理** 是中心化模块，被多个模块依赖：
   - MCPDogServer
   - ToolRouter
   - 各种适配器

3. **类型定义** (`types/index.ts`) 被所有模块依赖

### 前端依赖
1. **App.tsx** 是主入口，依赖：
   - ServerManager (服务器管理)
   - useWebSocket (WebSocket 连接)
   - useAppStore (状态管理)

2. **ServerManager** 是核心组件，管理所有服务器相关功能

3. **configStore** 是状态管理核心，被多个组件使用

## 无用文件识别

### 可删除的日志文件 (`web/`)
- `web_server.log` (34KB) - 开发服务器日志
- `web-server.log` (375B) - 重复的日志文件
- `daemon-debug.log` (1.2KB) - 调试日志
- `daemon-debug-fixed.log` (1.9KB) - 修复调试日志
- `daemon-debug-fixed2.log` (2.3KB) - 第二次修复调试日志
- `daemon_ui.log` (627B) - UI 调试日志
- `web.log` (141B) - Web 日志

### 可删除的备份文件
- `web/src/store/configStore.ts.backup` (14KB) - 配置存储备份

### 空目录
- `web/src/data/` - 空目录，可删除

## 建议

1. **删除所有日志文件** - 这些是开发过程中产生的临时文件
2. **删除备份文件** - 如果不再需要
3. **删除空目录** - `web/src/data/`
4. **添加 .gitignore** - 忽略日志文件和临时文件
5. **优化依赖** - 考虑将一些大型文件拆分为更小的模块 