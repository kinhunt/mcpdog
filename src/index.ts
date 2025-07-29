#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { UserToolbox, UserService } from "./user-toolbox.js";
import { ServiceDiscoveryEngine, ServiceRecommendation } from "./service-discovery.js";
import { MCPService } from "./services.js";

class MCPDiscoveryGateway {
  private server: Server;
  private userToolbox: UserToolbox;
  private discoveryEngine: ServiceDiscoveryEngine;

  constructor() {
    this.userToolbox = new UserToolbox();
    this.discoveryEngine = new ServiceDiscoveryEngine();
    
    this.server = new Server(
      {
        name: "mcpdog",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandler();
  }

  private async setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // 生成动态工具列表：基础功能 + 用户个性化工具
      const baseTools = [
        {
          name: "discover_services",
          description: "🔍 搜索和发现MCP服务。例如：'帮我找发邮件的服务'、'有什么数据库相关的工具'",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "描述你需要什么功能，例如：'邮件发送'、'图像处理'、'数据分析'"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "manage_toolbox",
          description: "🧰 管理你的个人工具箱：查看、添加、删除常用服务",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["view", "add", "remove", "stats", "export", "import"],
                description: "操作类型"
              },
              service_id: {
                type: "string",
                description: "服务ID（当action为add或remove时必需）"
              },
              config_data: {
                type: "string",
                description: "配置数据（当action为import时使用）"
              }
            },
            required: ["action"]
          }
        },
        {
          name: "get_service_info",
          description: "📋 获取特定服务的详细信息、配置指南和使用示例",
          inputSchema: {
            type: "object",
            properties: {
              service_id: {
                type: "string",
                description: "服务ID"
              }
            },
            required: ["service_id"]
          }
        }
      ];

      // 添加用户个性化工具
      const userTools = this.userToolbox.generateUserTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      return {
        tools: [...baseTools, ...userTools]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // 检查是否是用户工具箱中的工具
        if (name.includes('_') && !['discover_services', 'manage_toolbox', 'get_service_info'].includes(name)) {
          return await this.handleUserToolCall(name, args);
        }

        switch (name) {
          case "discover_services": {
            const { query } = args as { query: string };
            return await this.handleServiceDiscovery(query);
          }

          case "manage_toolbox": {
            const { action, service_id, config_data } = args as {
              action: string;
              service_id?: string;
              config_data?: string;
            };
            return await this.handleToolboxManagement(action, service_id, config_data);
          }

          case "get_service_info": {
            const { service_id } = args as { service_id: string };
            return await this.handleServiceInfo(service_id);
          }

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `❓ 工具 "${name}" 不存在。使用 "discover_services" 来查找服务，或 "manage_toolbox" 管理你的工具箱。`
                }
              ]
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ 错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  private async handleServiceDiscovery(query: string) {
    const recommendations = await this.discoveryEngine.searchServices(query);

    if (recommendations.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `🔍 **未找到匹配的服务**: "${query}"\\n\\n💡 试试更通用的关键词，比如 'email'、'database'、'file' 等。`
          }
        ]
      };
    }

    let response = `🔍 **找到 ${recommendations.length} 个相关服务**: "${query}"\\n\\n`;

    recommendations.forEach((rec, index) => {
      const stars = '⭐'.repeat(Math.round(rec.usageStats.avgRating));
      response += `**${index + 1}. ${rec.service.name}** ${stars}\\n`;
      response += `📝 ${rec.service.description}\\n`;
      response += `👥 ${rec.usageStats.totalUsers} 用户 | 📊 ${rec.usageStats.avgRating}/5.0 评分\\n`;
      response += `🔧 配置难度: ${rec.configurationGuide.difficulty}\\n`;
      response += `🛠️ 主要功能: ${rec.service.tools.map(t => t.name).join(', ')}\\n`;
      
      if (rec.service.tools[0]?.examples[0]) {
        response += `💡 示例: \`${rec.service.tools[0].examples[0]}\`\\n`;
      }
      
      response += `\\n`;
    });

    response += `📋 **下一步操作**:\\n`;
    response += `• 使用 \`get_service_info("service-id")\` 查看详细信息\\n`;
    response += `• 使用 \`manage_toolbox("add", "service-id")\` 添加到工具箱\\n`;
    response += `• 使用 \`manage_toolbox("view")\` 查看当前工具箱`;

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  }

  private async handleToolboxManagement(action: string, serviceId?: string, configData?: string) {
    switch (action) {
      case "view": {
        const services = this.userToolbox.getFavoriteServices();
        const stats = this.userToolbox.getStats();

        if (services.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `🧰 **你的工具箱是空的**\\n\\n使用 \`discover_services("你需要的功能")\` 来寻找服务，然后添加到工具箱中。`
              }
            ]
          };
        }

        let response = `🧰 **你的个人工具箱** (${stats.totalServices} 个服务, ${stats.totalTools} 个工具)\\n\\n`;

        services.forEach((service, index) => {
          response += `**${index + 1}. ${service.name}**\\n`;
          response += `📅 添加于: ${service.addedAt.toLocaleDateString()}\\n`;
          response += `📊 使用次数: ${service.usageCount}\\n`;
          response += `🛠️ 工具: ${service.tools.map(t => t.name).join(', ')}\\n`;
          if (service.userNotes) {
            response += `📝 备注: ${service.userNotes}\\n`;
          }
          response += `\\n`;
        });

        if (stats.mostUsedService) {
          response += `🏆 **最常用服务**: ${stats.mostUsedService}`;
        }

        return {
          content: [
            {
              type: "text",
              text: response
            }
          ]
        };
      }

      case "add": {
        if (!serviceId) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 请提供服务ID。例如: \`manage_toolbox("add", "email-service-pro")\``
              }
            ]
          };
        }

        const config = this.discoveryEngine.getServiceConfigTemplate(serviceId);
        if (!config) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 服务 "${serviceId}" 不存在。使用 \`discover_services\` 来查找可用服务。`
              }
            ]
          };
        }

        // 转换为UserService格式
        const userService: UserService = {
          id: config.serviceId,
          name: config.name,
          description: config.tools.map(t => t.description).join('; '),
          tools: config.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: {} // 这里应该从完整的服务定义中获取
          })),
          endpoint: config.endpoint,
          addedAt: new Date(),
          usageCount: 0
        };

        await this.userToolbox.addService(userService);

        let response = `✅ **成功添加服务**: ${config.name}\\n\\n`;
        response += `🛠️ **可用工具**:\\n`;
        config.tools.forEach(tool => {
          response += `• ${tool.name}: ${tool.description}\\n`;
        });
        
        response += `\\n📋 **配置要求**:\\n`;
        if (config.configuration.requiredEnv.length > 0) {
          response += `环境变量: ${config.configuration.requiredEnv.join(', ')}\\n`;
        }
        
        response += `\\n🔄 **重新连接MCP客户端以刷新工具列表**`;

        return {
          content: [
            {
              type: "text",
              text: response
            }
          ]
        };
      }

      case "remove": {
        if (!serviceId) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 请提供服务ID。例如: \`manage_toolbox("remove", "email-service-pro")\``
              }
            ]
          };
        }

        const removed = await this.userToolbox.removeService(serviceId);
        if (removed) {
          return {
            content: [
              {
                type: "text",
                text: `✅ 已从工具箱移除服务: ${serviceId}\\n\\n🔄 重新连接MCP客户端以刷新工具列表`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `❌ 服务 "${serviceId}" 不在你的工具箱中`
              }
            ]
          };
        }
      }

      case "stats": {
        const stats = this.userToolbox.getStats();
        let response = `📊 **工具箱统计**\\n\\n`;
        response += `📦 总服务数: ${stats.totalServices}\\n`;
        response += `🛠️ 总工具数: ${stats.totalTools}\\n`;
        
        if (stats.mostUsedService) {
          response += `🏆 最常用: ${stats.mostUsedService}\\n`;
        }
        
        if (stats.recentlyAdded.length > 0) {
          response += `\\n📅 **最近添加**:\\n`;
          stats.recentlyAdded.forEach(service => {
            response += `• ${service.name} (${service.addedAt.toLocaleDateString()})\\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: response
            }
          ]
        };
      }

      case "export": {
        const exportData = await this.userToolbox.exportToolbox();
        return {
          content: [
            {
              type: "text",
              text: `📤 **工具箱导出完成**\\n\\n\`\`\`json\\n${exportData}\\n\`\`\`\\n\\n💾 保存此配置以便在其他地方导入`
            }
          ]
        };
      }

      case "import": {
        if (!configData) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 请提供配置数据。例如: \`manage_toolbox("import", null, "配置JSON字符串")\``
              }
            ]
          };
        }

        try {
          await this.userToolbox.importToolbox(configData);
          return {
            content: [
              {
                type: "text",
                text: `✅ **工具箱导入成功**\\n\\n🔄 重新连接MCP客户端以刷新工具列表`
              }
            ]
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 导入失败: ${error instanceof Error ? error.message : String(error)}`
              }
            ]
          };
        }
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `❌ 未知操作: ${action}。支持的操作: view, add, remove, stats, export, import`
            }
          ]
        };
    }
  }

  private async handleServiceInfo(serviceId: string) {
    const config = this.discoveryEngine.getServiceConfigTemplate(serviceId);
    if (!config) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 服务 "${serviceId}" 不存在`
          }
        ]
      };
    }

    let response = `📋 **${config.name}** 详细信息\\n\\n`;
    response += `🆔 ID: ${config.serviceId}\\n`;
    response += `🔗 端点: ${config.endpoint}\\n\\n`;
    
    response += `🛠️ **可用工具** (${config.tools.length} 个):\\n`;
    config.tools.forEach((tool, index) => {
      response += `${index + 1}. **${tool.name}**\\n`;
      response += `   📝 ${tool.description}\\n`;
      response += `   💡 用法: \`${tool.usage}\`\\n\\n`;
    });

    response += `⚙️ **配置要求**:\\n`;
    response += `🎚️ 难度: ${config.configuration.difficulty}\\n`;
    
    if (config.configuration.requiredEnv.length > 0) {
      response += `🔧 环境变量: ${config.configuration.requiredEnv.join(', ')}\\n`;
    }
    
    response += `\\n📋 **配置步骤**:\\n`;
    config.configuration.setupSteps.forEach(step => {
      response += `${step}\\n`;
    });

    if (config.configuration.examples.length > 0) {
      response += `\\n💻 **配置示例**:\\n\`\`\`bash\\n`;
      config.configuration.examples.forEach(example => {
        response += `${example}\\n`;
      });
      response += `\`\`\``;
    }

    response += `\\n\\n🎯 **添加到工具箱**: \`manage_toolbox("add", "${serviceId}")\``;

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  }

  private async handleUserToolCall(toolName: string, args: any) {
    // 解析工具名，提取服务ID和工具名
    const parts = toolName.split('_');
    if (parts.length < 2) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 无效的工具名格式: ${toolName}`
          }
        ]
      };
    }

    const serviceId = parts[0];
    const actualToolName = parts.slice(1).join('_');

    // 查找服务
    const service = this.userToolbox.findService(serviceId);
    if (!service) {
      return {
        content: [
          {
            type: "text",
            text: `❌ 服务 "${serviceId}" 不在你的工具箱中。使用 \`manage_toolbox("view")\` 查看可用服务。`
          }
        ]
      };
    }

    // 更新使用统计
    await this.userToolbox.updateUsageStats(serviceId, actualToolName);

    // 这里应该实际调用目标服务，现在返回模拟响应
    const response = `🚀 **模拟调用**: ${service.name}.${actualToolName}\\n\\n` +
      `📋 **参数**: \`\`\`json\\n${JSON.stringify(args, null, 2)}\\n\`\`\`\\n\\n` +
      `✅ **[模拟] 执行成功**\\n` +
      `在实际部署中，这里会调用真实的MCP服务: ${service.endpoint}\\n\\n` +
      `📊 这是你第 ${service.usageCount + 1} 次使用此服务`;

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  }

  private setupErrorHandler() {
    this.server.onerror = (error) => {
      console.error("[MCPDog Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCPDog Server running on stdio - Ready to fetch MCP services! 🐕");
  }
}

const server = new MCPDiscoveryGateway();
server.run().catch(console.error);