// 服务发现引擎
export interface ServiceRecommendation {
  service: MCPService;
  relevanceScore: number;
  usageStats: {
    totalUsers: number;
    avgRating: number;
    monthlyUsage: number;
  };
  configurationGuide: {
    difficulty: 'easy' | 'medium' | 'hard';
    requiredEnv: string[];
    setupSteps: string[];
    examples: string[];
  };
  compatibility: {
    mcpVersion: string;
    platforms: string[];
    dependencies: string[];
  };
}

export class ServiceDiscoveryEngine {
  private serviceRegistry: Map<string, MCPService> = new Map();
  private usageStats: Map<string, any> = new Map();
  private userRatings: Map<string, number> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry() {
    // 初始化服务注册表 - 这里可以从配置文件、API或其他来源加载
    const emailService: MCPService = {
      id: "email-service-pro",
      name: "EmailService Pro",
      description: "Professional email service with templates, bulk sending, and analytics",
      capabilities: ["email_sending", "template_management", "bulk_operations", "analytics"],
      tools: [
        {
          name: "send_email",
          description: "Send a single email",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Email subject" },
              body: { type: "string", description: "Email body content" },
              html: { type: "boolean", description: "Whether body is HTML", default: false }
            },
            required: ["to", "subject", "body"]
          },
          examples: [
            'send_email(to="user@example.com", subject="Hello", body="Test message")',
            'send_email(to="team@company.com", subject="Meeting", body="<h1>Important</h1>", html=true)'
          ]
        },
        {
          name: "send_bulk_email",
          description: "Send emails to multiple recipients",
          parameters: {
            type: "object",
            properties: {
              recipients: { type: "array", items: { type: "string" } },
              subject: { type: "string" },
              template_id: { type: "string", description: "Email template ID" }
            },
            required: ["recipients", "subject"]
          },
          examples: [
            'send_bulk_email(recipients=["user1@example.com", "user2@example.com"], subject="Newsletter")'
          ]
        },
        {
          name: "create_template",
          description: "Create email template",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              content: { type: "string" },
              variables: { type: "array", items: { type: "string" } }
            },
            required: ["name", "content"]
          },
          examples: [
            'create_template(name="welcome", content="Hello {{name}}, welcome!")'
          ]
        }
      ],
      endpoint: "stdio://email-service-pro"
    };

    const gmailService: MCPService = {
      id: "gmail-api-service",
      name: "Gmail API Service", 
      description: "Gmail integration service with read/write capabilities",
      capabilities: ["gmail_integration", "email_reading", "email_sending", "label_management"],
      tools: [
        {
          name: "gmail_send",
          description: "Send email via Gmail API",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              message: { type: "string" }
            },
            required: ["to", "subject", "message"]
          },
          examples: [
            'gmail_send(to="friend@gmail.com", subject="Hi", message="How are you?")'
          ]
        },
        {
          name: "gmail_read",
          description: "Read Gmail messages",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Gmail search query" },
              max_results: { type: "number", default: 10 }
            }
          },
          examples: [
            'gmail_read(query="from:support@example.com", max_results=5)'
          ]
        }
      ],
      endpoint: "stdio://gmail-api-service"
    };

    const smtpService: MCPService = {
      id: "simple-smtp-service",
      name: "Simple SMTP Service",
      description: "Basic SMTP email sending service",
      capabilities: ["smtp_sending", "basic_email"],
      tools: [
        {
          name: "smtp_send",
          description: "Send email via SMTP",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string" },
              subject: { type: "string" },
              text: { type: "string" }
            },
            required: ["to", "subject", "text"]
          },
          examples: [
            'smtp_send(to="user@example.com", subject="Test", text="Hello world")'
          ]
        }
      ],
      endpoint: "stdio://simple-smtp-service"
    };

    // 注册服务
    this.serviceRegistry.set(emailService.id, emailService);
    this.serviceRegistry.set(gmailService.id, gmailService);
    this.serviceRegistry.set(smtpService.id, smtpService);

    // 模拟使用统计
    this.usageStats.set("email-service-pro", {
      totalUsers: 1250,
      avgRating: 4.7,
      monthlyUsage: 15600
    });
    this.usageStats.set("gmail-api-service", {
      totalUsers: 890,
      avgRating: 4.4,
      monthlyUsage: 8900  
    });
    this.usageStats.set("simple-smtp-service", {
      totalUsers: 445,
      avgRating: 4.1,
      monthlyUsage: 3200
    });
  }

  // 搜索服务
  async searchServices(query: string): Promise<ServiceRecommendation[]> {
    const queryLower = query.toLowerCase();
    const matchingServices: ServiceRecommendation[] = [];

    for (const [id, service] of this.serviceRegistry) {
      const relevanceScore = this.calculateRelevance(queryLower, service);
      
      if (relevanceScore > 0.1) { // 最低相关度阈值
        matchingServices.push({
          service,
          relevanceScore,
          usageStats: this.usageStats.get(id) || { totalUsers: 0, avgRating: 0, monthlyUsage: 0 },
          configurationGuide: this.generateConfigGuide(service),
          compatibility: {
            mcpVersion: "1.0.0",
            platforms: ["linux", "macos", "windows"],
            dependencies: ["node.js >= 18"]
          }
        });
      }
    }

    // 按相关度和流行度排序
    return matchingServices.sort((a, b) => {
      const scoreA = a.relevanceScore * 0.7 + (a.usageStats.avgRating / 5) * 0.3;
      const scoreB = b.relevanceScore * 0.7 + (b.usageStats.avgRating / 5) * 0.3;
      return scoreB - scoreA;
    });
  }

  private calculateRelevance(query: string, service: MCPService): number {
    let score = 0;

    // 检查服务名称匹配
    if (service.name.toLowerCase().includes(query)) {
      score += 0.8;
    }

    // 检查描述匹配  
    const descWords = service.description.toLowerCase().split(/\s+/);
    const queryWords = query.split(/\s+/);
    
    for (const queryWord of queryWords) {
      if (descWords.some(word => word.includes(queryWord))) {
        score += 0.3;
      }
    }

    // 检查能力匹配
    for (const capability of service.capabilities) {
      if (capability.toLowerCase().includes(query) || query.includes(capability.toLowerCase())) {
        score += 0.5;
      }
    }

    // 检查工具匹配
    for (const tool of service.tools) {
      if (tool.name.toLowerCase().includes(query) || 
          tool.description.toLowerCase().includes(query)) {
        score += 0.4;
      }
    }

    return Math.min(score, 1.0); // 最高分为1.0
  }

  private generateConfigGuide(service: MCPService): ServiceRecommendation['configurationGuide'] {
    // 根据服务类型生成配置指南
    if (service.id.includes('gmail')) {
      return {
        difficulty: 'medium',
        requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
        setupSteps: [
          '1. 在Google Cloud Console创建项目',
          '2. 启用Gmail API',
          '3. 创建OAuth 2.0凭据',
          '4. 获取刷新令牌',
          '5. 配置环境变量'
        ],
        examples: [
          'export GOOGLE_CLIENT_ID="your-client-id"',
          'export GOOGLE_CLIENT_SECRET="your-secret"'
        ]
      };
    } else if (service.id.includes('smtp')) {
      return {
        difficulty: 'easy',
        requiredEnv: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
        setupSteps: [
          '1. 获取SMTP服务器信息',
          '2. 配置认证凭据',
          '3. 测试连接'
        ],
        examples: [
          'export SMTP_HOST="smtp.gmail.com"',
          'export SMTP_PORT="587"'
        ]
      };
    } else {
      return {
        difficulty: 'medium',
        requiredEnv: ['API_KEY', 'SERVICE_URL'],
        setupSteps: [
          '1. 注册服务账号',
          '2. 获取API密钥',
          '3. 配置服务端点',
          '4. 测试连接'
        ],
        examples: [
          'export API_KEY="your-api-key"',
          'export SERVICE_URL="https://api.service.com"'
        ]
      };
    }
  }

  // 获取推荐的服务配置
  getServiceConfigTemplate(serviceId: string): any {
    const service = this.serviceRegistry.get(serviceId);
    if (!service) return null;

    return {
      serviceId: service.id,
      name: service.name,
      endpoint: service.endpoint,
      configuration: this.generateConfigGuide(service),
      tools: service.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        usage: tool.examples[0] || `${tool.name}(...)`
      }))
    };
  }

  // 添加新服务到注册表
  async registerService(service: MCPService): Promise<void> {
    this.serviceRegistry.set(service.id, service);
    console.log(`Registered new service: ${service.name}`);
  }

  // 获取所有服务
  getAllServices(): MCPService[] {
    return Array.from(this.serviceRegistry.values());
  }
}