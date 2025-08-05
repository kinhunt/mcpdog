// Mock tool database
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
      // Email service tools
      {
        id: "email-service-pro",
        name: "EmailService Pro",
        description: "Professional email service with template, bulk sending and analytics features",
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
            description: "Send single email",
            exampleParams: {
              to: "user@example.com",
              subject: "Hello from MCPDog!",
              body: "This is a test email",
              html: false
            }
          },
          {
            name: "send_bulk_email",
            description: "Send bulk emails",
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
        description: "Direct connection to Gmail API, supports reading and sending emails",
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
            description: "Send email via Gmail",
            exampleParams: {
              to: "friend@gmail.com",
              subject: "Hi there!",
              message: "How are you doing?"
            }
          },
          {
            name: "gmail_read",
            description: "Read Gmail emails",
            exampleParams: {
              query: "from:support@example.com",
              max_results: 10
            }
          }
        ],
        envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
        configExample: "Requires Google Cloud Console OAuth2 credentials configuration"
      },

      {
        id: "simple-mailer",
        name: "Simple Mailer",
        description: "Lightweight SMTP email sending tool with simple configuration",
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
            description: "Send email via SMTP",
            exampleParams: {
              to: "user@example.com",
              subject: "Simple Mail",
              text: "Hello world!"
            }
          }
        ],
        envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]
      },

      // Database tools
      {
        id: "universal-db",
        name: "Universal Database Tool",
        description: "Universal connection and operation tool supporting multiple databases",
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
            description: "Execute SQL query",
            exampleParams: {
              query: "SELECT * FROM users WHERE active = true",
              database: "main"
            }
          },
          {
            name: "db_insert",
            description: "Insert data",
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
        description: "MongoDB-specific operation tool supporting document operations and aggregation queries",
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
            description: "Find documents",
            exampleParams: {
              collection: "users",
              filter: { "status": "active" },
              limit: 10
            }
          },
          {
            name: "mongo_insert",
            description: "Insert document",
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

      // File processing tools
      {
        id: "file-processor",
        name: "File Processor",
        description: "Comprehensive file processing tool supporting reading, writing, and converting multiple formats",
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
            description: "Read file content",
            exampleParams: {
              filename: "data.json",
              encoding: "utf8"
            }
          },
          {
            name: "write_file",
            description: "Write file",
            exampleParams: {
              filename: "output.txt",
              content: "Hello, World!",
              encoding: "utf8"
            }
          },
          {
            name: "convert_format",
            description: "Convert file format",
            exampleParams: {
              input_file: "data.csv",
              output_file: "data.json",
              format: "json"
            }
          }
        ],
        envVars: ["FILE_STORAGE_PATH"]
      },

      // Image processing tools
      {
        id: "image-magic",
        name: "Image Magic",
        description: "Powerful image processing tool supporting scaling, cropping, filters and more",
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
            description: "Resize image",
            exampleParams: {
              input_path: "original.jpg",
              output_path: "resized.jpg",
              width: 800,
              height: 600
            }
          },
          {
            name: "crop_image",
            description: "Crop image",
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

      // API calling tools
      {
        id: "http-client",
        name: "HTTP Client",
        description: "Universal HTTP client supporting various API calls and data retrieval",
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
            description: "Send GET request",
            exampleParams: {
              url: "https://api.example.com/users",
              headers: {
                "Authorization": "Bearer token123"
              }
            }
          },
          {
            name: "http_post",
            description: "Send POST request",
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

      // Web scraping tools
      {
        id: "web-scraper",
        name: "Web Scraper",
        description: "Intelligent web scraping tool supporting content extraction and data collection",
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
            description: "Scrape webpage content",
            exampleParams: {
              url: "https://example.com",
              selector: ".content",
              extract: "text"
            }
          },
          {
            name: "extract_links",
            description: "Extract page links",
            exampleParams: {
              url: "https://example.com",
              filter_pattern: "https://example.com/articles/*"
            }
          }
        ],
        envVars: ["USER_AGENT", "PROXY_URL"]
      },

      // Notification tools
      {
        id: "notification-hub",
        name: "Notification Hub",
        description: "Multi-channel notification service supporting email, SMS, push and more",
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
            description: "Send notification",
            exampleParams: {
              channel: "email",
              recipient: "user@example.com",
              title: "Alert",
              message: "Something important happened"
            }
          },
          {
            name: "send_sms",
            description: "Send SMS",
            exampleParams: {
              phone: "+1234567890",
              message: "Your verification code is 123456"
            }
          }
        ],
        envVars: ["SMS_API_KEY", "PUSH_SERVICE_KEY"]
      },

      // Scheduled task tools
      {
        id: "task-scheduler",
        name: "Task Scheduler",
        description: "Flexible task scheduling tool supporting cron expressions and delayed execution",
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
            description: "Schedule task",
            exampleParams: {
              name: "daily_backup",
              cron: "0 2 * * *",
              action: "backup_database",
              enabled: true
            }
          },
          {
            name: "delay_task",
            description: "Delay task execution",
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

  // Mock adding new tool (in actual implementation may load from API or config file)
  async addTool(tool: MCPTool): Promise<void> {
    this.tools.push(tool);
  }

  // Get tool statistics
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