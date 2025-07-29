# MCPDog 配置指南 🐕

## 快速配置

### MCP客户端配置
```json
{
  "mcpServers": {
    "mcpdog": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/Users/qiujianheng/Documents/dev/mcpdog"
    }
  }
}
```

### 启动MCPDog
```bash
cd /Users/qiujianheng/Documents/dev/mcpdog
npm run build  # 如果需要的话
node dist/index.js
```

## 🐕 MCPDog使用示例

### 🔍 让狗狗帮你找邮件服务
```
用户: discover_services({"query": "邮件发送"})

MCPDog: 🔍 找到 3 个相关服务: "邮件发送"

1. **EmailService Pro** ⭐⭐⭐⭐⭐
📝 Professional email service with templates, bulk sending, and analytics
👥 1250 用户 | 📊 4.7/5.0 评分
🔧 配置难度: medium
🛠️ 主要功能: send_email, send_bulk_email, create_template
💡 示例: send_email(to="user@example.com", subject="Hello", body="Test message")

🐕 MCPDog嗅到了这些优质服务！
```

### 🦴 加入你的服务包
```
用户: manage_toolbox({"action": "add", "service_id": "email-service-pro"})

MCPDog: ✅ 成功添加服务: EmailService Pro

🐕 MCPDog为你取回了这个服务！

🛠️ 可用工具:
• send_email: Send a single email
• send_bulk_email: Send emails to multiple recipients  
• create_template: Create email template

📋 配置要求:
环境变量: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

🔄 重新连接MCP客户端以刷新工具列表
```

### 🏠 查看你的服务包
```
用户: manage_toolbox({"action": "view"})

MCPDog: 🧰 你的个人服务包 (1 个服务, 3 个工具)

🐕 MCPDog为你管理着这些服务:

1. **EmailService Pro**
📅 取回于: 2024/12/28  
📊 使用次数: 0
🛠️ 工具: send_email, send_bulk_email, create_template

🏆 最常用服务: EmailService Pro

🦴 好狗狗！这些都是你最喜欢的服务！
```

### 🎾 使用狗狗取回的工具
```
用户: email-service-pro_send_email({
  "to": "team@company.com",
  "subject": "会议提醒",
  "body": "别忘了下午3点的会议！"
})

MCPDog: 🚀 模拟调用: EmailService Pro.send_email

📋 参数: {
  "to": "team@company.com", 
  "subject": "会议提醒",
  "body": "别忘了下午3点的会议！"
}

✅ [模拟] 执行成功
🐕 MCPDog成功为你传递了消息！
在实际部署中，这里会调用真实的MCP服务: stdio://email-service-pro

📊 这是你第 1 次使用此服务 - MCPDog记住了！
```

## 🐕 MCPDog的特殊能力

1. **🔍 敏锐嗅觉** - 能从众多服务中找到最适合的
2. **🦴 忠诚记忆** - 记住你最喜欢的服务
3. **🏃‍♂️ 快速取回** - 一键添加服务到你的包里
4. **🏠 看家本领** - 本地保存配置，安全可靠
5. **🎾 友好互动** - 让服务发现变得有趣

## 📁 狗窝位置

MCPDog的配置保存在:
- **Linux/macOS**: `~/.mcpdog/user-toolbox.json`
- **Windows**: `%USERPROFILE%\.mcpdog\user-toolbox.json`

## 🎯 MCPDog vs 其他方案

| 特性 | 传统方案 | MCPDog |
|------|---------|--------|
| 服务发现 | 手动搜索文档 | 🐕 智能嗅探和推荐 |  
| 配置管理 | 手动编辑配置文件 | 🦴 一键添加到服务包 |
| 使用体验 | 冷冰冰的工具列表 | 🎾 友好的狗狗陪伴 |
| 个性化 | 千篇一律 | 🏠 记住你的偏好 |
| 学习成本 | 需要了解所有服务 | 🐕‍🦺 告诉狗狗你要什么就行 |

## 🎉 开始使用

现在就让MCPDog成为你的MCP服务探索伙伴吧！

```bash
# 启动MCPDog
node dist/index.js

# 看到这个消息说明狗狗准备好了:
# MCPDog Server running on stdio - Ready to fetch MCP services! 🐕
```

**MCPDog** - 最忠诚的MCP服务寻找伙伴！🐕🦴

*"汪汪！主人需要什么服务？让我帮你找！"*