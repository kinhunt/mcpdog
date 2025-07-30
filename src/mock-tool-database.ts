// 模拟工具数据库
export interface MCPTool {
  id: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  complexity: 'easy' | 'medium' | 'hard';
  stats: {
    users: number;
    rating: number;
    monthlyUsage: number;
  };
  tools: Array<{
    name: string;
    description: string;
    exampleParams: any;
  }>;
  envVars?: string[];
  configExample?: string;
  documentation?: string;
}

export class MockToolDatabase {
  private tools: MCPTool[] = [];

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.tools = [
      // 邮件服务工具
      {
        id: "email-service-pro",
        name: "EmailService Pro",
        description: "专业邮件服务，支持模板、批量发送和分析功能",
        category: "email",
        keywords: ["email", "mail", "send", "template", "bulk", "smtp"],
        complexity: "medium",
        stats: {
          users: 12450,
          rating: 4.8,
          monthlyUsage: 156000
        },
        tools: [
          {
            name: "send_email",
            description: "发送单封邮件",
            exampleParams: {
              to: "user@example.com",
              subject: "Hello from MCPDog!",
              body: "This is a test email",
              html: false
            }
          },
          {
            name: "send_bulk_email",
            description: "批量发送邮件",
            exampleParams: {
              recipients: ["user1@example.com", "user2@example.com"],
              subject: "Newsletter",
              template_id: "newsletter_v1"
            }
          }
        ],
        envVars: ["EMAIL_API_KEY", "SMTP_HOST", "SMTP_PORT"],
        configExample: '{\n  "mcpServers": {\n    "email-service-pro": {\n      "command": "npx",\n      "args": ["email-service-pro"]\n    }\n  }\n}'
      },

      {
        id: "gmail-connector",
        name: "Gmail Connector",
        description: "直接连接Gmail API，支持读取和发送邮件",
        category: "email",
        keywords: ["gmail", "google", "email", "api"],
        complexity: "hard",
        stats: {
          users: 8900,
          rating: 4.5,
          monthlyUsage: 89000
        },
        tools: [
          {
            name: "gmail_send",
            description: "通过Gmail发送邮件",
            exampleParams: {
              to: "friend@gmail.com",
              subject: "Hi there!",
              message: "How are you doing?"
            }
          },
          {
            name: "gmail_read",
            description: "读取Gmail邮件",
            exampleParams: {
              query: "from:support@example.com",
              max_results: 10
            }
          }
        ],
        envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
        configExample: "需要Google Cloud Console配置OAuth2凭据"
      },

      {
        id: "simple-mailer",
        name: "Simple Mailer",
        description: "轻量级SMTP邮件发送工具，配置简单",
        category: "email",
        keywords: ["smtp", "simple", "mail", "lightweight"],
        complexity: "easy",
        stats: {
          users: 5600,
          rating: 4.2,
          monthlyUsage: 34000
        },
        tools: [
          {
            name: "smtp_send",
            description: "SMTP发送邮件",
            exampleParams: {
              to: "user@example.com",
              subject: "Simple Mail",
              text: "Hello world!"
            }
          }
        ],
        envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]
      },

      // 数据库工具
      {
        id: "universal-db",
        name: "Universal Database Tool",
        description: "支持多种数据库的通用连接和操作工具",
        category: "database",
        keywords: ["database", "sql", "mysql", "postgres", "sqlite"],
        complexity: "medium",
        stats: {
          users: 15600,
          rating: 4.7,
          monthlyUsage: 234000
        },
        tools: [
          {
            name: "db_query",
            description: "执行SQL查询",
            exampleParams: {
              query: "SELECT * FROM users WHERE active = true",
              database: "main"
            }
          },
          {
            name: "db_insert",
            description: "插入数据",
            exampleParams: {
              table: "users",
              data: {
                name: "John Doe",
                email: "john@example.com"
              }
            }
          }
        ],
        envVars: ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"]
      },

      {
        id: "mongo-helper",
        name: "MongoDB Helper",
        description: "MongoDB专用操作工具，支持文档操作和聚合查询",
        category: "database",
        keywords: ["mongodb", "nosql", "document", "aggregate"],
        complexity: "medium",
        stats: {
          users: 7800,
          rating: 4.4,
          monthlyUsage: 67000
        },
        tools: [
          {
            name: "mongo_find",
            description: "查找文档",
            exampleParams: {
              collection: "users",
              filter: { "status": "active" },
              limit: 10
            }
          },
          {
            name: "mongo_insert",
            description: "插入文档",
            exampleParams: {
              collection: "users",
              document: {
                name: "Alice",
                email: "alice@example.com",
                createdAt: new Date()
              }
            }
          }
        ],
        envVars: ["MONGODB_URI"]
      },

      // 文件处理工具
      {
        id: "file-processor",
        name: "File Processor",
        description: "全能文件处理工具，支持读取、写入、转换多种格式",
        category: "file",
        keywords: ["file", "document", "pdf", "excel", "csv", "json"],
        complexity: "easy",
        stats: {
          users: 9200,
          rating: 4.6,
          monthlyUsage: 120000
        },
        tools: [
          {
            name: "read_file",
            description: "读取文件内容",
            exampleParams: {
              filename: "data.json",
              encoding: "utf8"
            }
          },
          {
            name: "write_file",
            description: "写入文件",
            exampleParams: {
              filename: "output.txt",
              content: "Hello, World!",
              encoding: "utf8"
            }
          },
          {
            name: "convert_format",
            description: "转换文件格式",
            exampleParams: {
              input_file: "data.csv",
              output_file: "data.json",
              format: "json"
            }
          }
        ],
        envVars: ["FILE_STORAGE_PATH"]
      },

      // 图像处理工具
      {
        id: "image-magic",
        name: "Image Magic",
        description: "强大的图像处理工具，支持缩放、裁剪、滤镜等功能",
        category: "image",
        keywords: ["image", "photo", "resize", "crop", "filter", "watermark"],
        complexity: "medium",
        stats: {
          users: 6700,
          rating: 4.5,
          monthlyUsage: 89000
        },
        tools: [
          {
            name: "resize_image",
            description: "调整图像大小",
            exampleParams: {
              input_path: "original.jpg",
              output_path: "resized.jpg",
              width: 800,
              height: 600
            }
          },
          {
            name: "crop_image",
            description: "裁剪图像",
            exampleParams: {
              input_path: "original.jpg",
              output_path: "cropped.jpg",
              x: 100,
              y: 100,
              width: 400,
              height: 300
            }
          }
        ],
        envVars: ["TEMP_DIR"]
      },

      // API调用工具
      {
        id: "http-client",
        name: "HTTP Client",
        description: "通用HTTP客户端，支持各种API调用和数据获取",
        category: "api",
        keywords: ["http", "api", "rest", "request", "get", "post"],
        complexity: "easy",
        stats: {
          users: 11200,
          rating: 4.3,
          monthlyUsage: 145000
        },
        tools: [
          {
            name: "http_get",
            description: "发送GET请求",
            exampleParams: {
              url: "https://api.example.com/users",
              headers: {
                "Authorization": "Bearer token123"
              }
            }
          },
          {
            name: "http_post",
            description: "发送POST请求",
            exampleParams: {
              url: "https://api.example.com/users",
              data: {
                name: "John",
                email: "john@example.com"
              },
              headers: {
                "Content-Type": "application/json"
              }
            }
          }
        ],
        envVars: ["API_BASE_URL", "API_KEY"]
      },

      // 网页抓取工具
      {
        id: "web-scraper",
        name: "Web Scraper",
        description: "智能网页抓取工具，支持内容提取和数据采集",
        category: "web",
        keywords: ["scrape", "crawl", "web", "html", "extract", "data"],
        complexity: "medium",
        stats: {
          users: 4500,
          rating: 4.1,
          monthlyUsage: 56000
        },
        tools: [
          {
            name: "scrape_page",
            description: "抓取网页内容",
            exampleParams: {
              url: "https://example.com",
              selector: ".content",
              extract: "text"
            }
          },
          {
            name: "extract_links",
            description: "提取页面链接",
            exampleParams: {
              url: "https://example.com",
              filter_pattern: "https://example.com/articles/*"
            }
          }
        ],
        envVars: ["USER_AGENT", "PROXY_URL"]
      },

      // 通知工具
      {
        id: "notification-hub",
        name: "Notification Hub",
        description: "多渠道通知服务，支持邮件、短信、推送等方式",
        category: "notification",
        keywords: ["notification", "alert", "sms", "push", "webhook"],
        complexity: "medium",
        stats: {
          users: 8300,
          rating: 4.4,
          monthlyUsage: 78000
        },
        tools: [
          {
            name: "send_notification",
            description: "发送通知",
            exampleParams: {
              channel: "email",
              recipient: "user@example.com",
              title: "Alert",
              message: "Something important happened"
            }
          },
          {
            name: "send_sms",
            description: "发送短信",
            exampleParams: {
              phone: "+1234567890",
              message: "Your verification code is 123456"
            }
          }
        ],
        envVars: ["SMS_API_KEY", "PUSH_SERVICE_KEY"]
      },

      // 定时任务工具
      {
        id: "task-scheduler",
        name: "Task Scheduler",
        description: "灵活的任务调度工具，支持cron表达式和延时执行",
        category: "schedule",
        keywords: ["schedule", "cron", "timer", "task", "automation"],
        complexity: "hard",
        stats: {
          users: 3200,
          rating: 4.6,
          monthlyUsage: 45000
        },
        tools: [
          {
            name: "schedule_task",
            description: "调度任务",
            exampleParams: {
              name: "daily_backup",
              cron: "0 2 * * *",
              action: "backup_database",
              enabled: true
            }
          },
          {
            name: "delay_task",
            description: "延时执行任务",
            exampleParams: {
              action: "send_reminder",
              delay_minutes: 30,
              params: {
                recipient: "user@example.com",
                message: "Don't forget your meeting!"
              }
            }
          }
        ],
        envVars: ["REDIS_URL", "TASK_QUEUE_URL"]
      }
    ];
  }

  async findToolsByCategory(category: string): Promise<MCPTool[]> {
    return this.tools.filter(tool => tool.category === category);
  }

  async findToolsByKeywords(keywords: string[]): Promise<MCPTool[]> {
    return this.tools.filter(tool => {
      const toolKeywords = [
        ...tool.keywords,
        ...tool.name.toLowerCase().split(/\s+/),
        ...tool.description.toLowerCase().split(/\s+/)
      ];
      
      return keywords.some(keyword => 
        toolKeywords.some(tk => 
          tk.includes(keyword.toLowerCase()) || 
          keyword.toLowerCase().includes(tk)
        )
      );
    });
  }

  async getToolById(id: string): Promise<MCPTool | null> {
    return this.tools.find(tool => tool.id === id) || null;
  }

  async getAllTools(): Promise<MCPTool[]> {
    return [...this.tools];
  }

  async searchTools(query: string): Promise<MCPTool[]> {
    const queryLower = query.toLowerCase();
    return this.tools.filter(tool => {
      return tool.name.toLowerCase().includes(queryLower) ||
             tool.description.toLowerCase().includes(queryLower) ||
             tool.keywords.some(kw => kw.includes(queryLower)) ||
             tool.category.includes(queryLower);
    });
  }

  // 模拟添加新工具（实际实现中可能从API或配置文件加载）
  async addTool(tool: MCPTool): Promise<void> {
    this.tools.push(tool);
  }

  // 获取工具统计信息
  async getStats(): Promise<{
    totalTools: number;
    categoryCounts: { [category: string]: number };
    averageRating: number;
    totalUsers: number;
  }> {
    const categoryCounts: { [category: string]: number } = {};
    let totalUsers = 0;
    let totalRating = 0;

    for (const tool of this.tools) {
      categoryCounts[tool.category] = (categoryCounts[tool.category] || 0) + 1;
      totalUsers += tool.stats.users;
      totalRating += tool.stats.rating;
    }

    return {
      totalTools: this.tools.length,
      categoryCounts,
      averageRating: totalRating / this.tools.length,
      totalUsers
    };
  }
}