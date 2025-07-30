#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IntentAnalyzer } from "./intent-analyzer.js";
import { ToolRecommendationEngine } from "./tool-recommender.js";
import { MockToolDatabase } from "./mock-tool-database.js";

class MCPDogServer {
  private server: Server;
  private intentAnalyzer: IntentAnalyzer;
  private recommendationEngine: ToolRecommendationEngine;
  private toolDatabase: MockToolDatabase;

  constructor() {
    this.toolDatabase = new MockToolDatabase();
    this.intentAnalyzer = new IntentAnalyzer();
    this.recommendationEngine = new ToolRecommendationEngine(this.toolDatabase);
    
    this.server = new Server(
      {
        name: "mcpdog",
        version: "2.0.0",
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
      return {
        tools: [
          {
            name: "use_mcpdog",
            description: "🐕 MCPDog 智能工具助手 - 当你需要任何功能时，在提示语后添加 'use mcpdog'，我会为你找到最合适的工具并告诉你如何使用",
            inputSchema: {
              type: "object",
              properties: {
                user_request: {
                  type: "string",
                  description: "用户的完整请求，例如：'send email to john@example.com, use mcpdog' 或 '我要发送邮件给客户，use mcpdog'"
                }
              },
              required: ["user_request"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === "use_mcpdog") {
          const { user_request } = args as { user_request: string };
          return await this.handleMCPDogRequest(user_request);
        }

        return {
          content: [
            {
              type: "text",
              text: `❓ 未知工具 "${name}"。请使用 "use_mcpdog" 来获取工具推荐。`
            }
          ]
        };
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

  private async handleMCPDogRequest(userRequest: string) {
    // 1. 解析用户意图
    const intent = await this.intentAnalyzer.parseIntent(userRequest);
    
    if (!intent.isValidRequest) {
      return {
        content: [
          {
            type: "text",
            text: `🤔 **MCPDog 需要更多信息**\n\n我没有理解你想要什么功能。请尝试更具体的描述，例如：\n• "send email to someone, use mcpdog"\n• "create a database, use mcpdog"\n• "process an image, use mcpdog"\n\n💡 **提示**: 描述你想要实现的具体功能！`
          }
        ]
      };
    }

    // 2. 获取工具推荐
    const recommendations = await this.recommendationEngine.getRecommendations(intent);

    if (recommendations.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `🔍 **很抱歉，没有找到匹配的工具**\n\n**你的需求**: ${intent.description}\n\n💡 MCPDog 目前支持的功能类型：\n• 邮件发送 (email, mail)\n• 数据库操作 (database, db)\n• 文件处理 (file, document)\n• 图像处理 (image, photo)\n• API 调用 (api, http)\n\n🚀 尝试使用这些关键词重新描述你的需求！`
          }
        ]
      };
    }

    // 3. 生成推荐响应
    return await this.generateRecommendationResponse(intent, recommendations);
  }

  private async generateRecommendationResponse(intent: any, recommendations: any[]) {
    let response = `🐕 **MCPDog 为你找到了完美的工具！**\n\n`;
    response += `**你的需求**: ${intent.description}\n`;
    response += `**匹配度**: ${intent.confidence > 0.8 ? '🎯 高度匹配' : '✅ 基本匹配'}\n\n`;
    
    response += `📋 **推荐方案** (共 ${recommendations.length} 个):\n\n`;

    recommendations.forEach((rec, index) => {
      const stars = '⭐'.repeat(Math.min(5, Math.round(rec.rating)));
      const isRecommended = index === 0;
      
      response += `**${index + 1}. ${rec.tool.name}** ${stars}${isRecommended ? ' 🎯 (推荐)' : ''}\n`;
      response += `📝 ${rec.tool.description}\n`;
      response += `👥 ${rec.tool.stats.users} 用户 | 📊 ${rec.tool.stats.rating}/5.0 评分\n`;
      response += `⚙️ 配置难度: ${rec.tool.complexity}\n\n`;
      
      // 显示具体的调用示例
      response += `🚀 **立即使用**:\n`;
      rec.tool.tools.forEach((tool: any) => {
        const example = this.generateToolCallExample(tool, intent);
        response += `\`\`\`\n${example}\n\`\`\`\n`;
      });
      
      response += `📋 **完整配置指南**: \`get_tool_info("${rec.tool.id}")\`\n`;
      response += `➕ **添加到常用工具**: \`add_to_favorites("${rec.tool.id}")\`\n\n`;
      
      if (index < recommendations.length - 1) {
        response += `---\n\n`;
      }
    });

    response += `💡 **小贴士**:\n`;
    response += `• 复制上面的代码直接使用\n`;
    response += `• 需要配置帮助？使用 \`get_tool_info("tool-id")\`\n`;
    response += `• 经常使用？添加到收藏夹自动出现在工具列表中\n\n`;
    response += `🐕 **MCPDog**: "汪！已经为你找到最棒的工具了！"`;

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  }

  private generateToolCallExample(tool: any, intent: any): string {
    // 根据意图生成具体的调用示例
    const params = { ...tool.exampleParams };
    
    // 智能填充参数
    if (intent.extractedData.email && params.to) {
      params.to = intent.extractedData.email;
    }
    if (intent.extractedData.subject && params.subject) {
      params.subject = intent.extractedData.subject;
    }
    if (intent.extractedData.message && (params.body || params.message)) {
      params.body = params.body ? intent.extractedData.message : undefined;
      params.message = params.message ? intent.extractedData.message : undefined;
    }

    return `${tool.name}(${JSON.stringify(params, null, 2)})`;
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
    console.error("🐕 MCPDog 2.0 Server running - Ready to fetch the perfect tools! 🦴");
  }
}

const server = new MCPDogServer();
server.run().catch(console.error);