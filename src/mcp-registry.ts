export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  description?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  config: MCPServerConfig;
  tools: MCPTool[];
  keywords: string[];
}

export class MCPRegistry {
  private servers: Map<string, MCPServerInfo> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry() {
    // BrowserMCP 配置
    this.servers.set('browsermcp', {
      config: {
        name: 'browsermcp',
        command: 'npx',
        args: ['@browsermcp/mcp@latest'],
        description: '浏览器自动化工具，支持网页导航、截图、点击等操作'
      },
      tools: [
        {
          name: 'browser_navigate',
          description: '导航到指定URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '要导航到的URL地址'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'browser_snapshot',
          description: '获取当前页面的可访问性快照',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'browser_click',
          description: '点击页面元素',
          inputSchema: {
            type: 'object',
            properties: {
              element: {
                type: 'string',
                description: '要点击的元素描述'
              },
              ref: {
                type: 'string',
                description: '元素引用ID'
              }
            },
            required: ['element', 'ref']
          }
        },
        {
          name: 'browser_type',
          description: '在输入框中输入文本',
          inputSchema: {
            type: 'object',
            properties: {
              element: {
                type: 'string',
                description: '输入元素描述'
              },
              ref: {
                type: 'string',
                description: '元素引用ID'
              },
              text: {
                type: 'string',
                description: '要输入的文本'
              },
              submit: {
                type: 'boolean',
                description: '输入后是否提交'
              }
            },
            required: ['element', 'ref', 'text', 'submit']
          }
        },
        {
          name: 'browser_screenshot',
          description: '截取当前页面截图',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'browser_go_back',
          description: '返回上一页',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'browser_go_forward',
          description: '前进到下一页',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'browser_wait',
          description: '等待指定时间',
          inputSchema: {
            type: 'object',
            properties: {
              time: {
                type: 'number',
                description: '等待时间（秒）'
              }
            },
            required: ['time']
          }
        }
      ],
      keywords: ['browser', 'navigate', 'click', 'type', 'screenshot', 'web', 'page', 'url', '浏览器', '导航', '点击', '输入', '截图', '网页']
    });

    // 可以添加更多MCP服务器配置
    // this.servers.set('gmail-mcp', { ... });
    // this.servers.set('file-mcp', { ... });
  }

  getAllServers(): MCPServerInfo[] {
    return Array.from(this.servers.values());
  }

  getServerByName(name: string): MCPServerInfo | undefined {
    return this.servers.get(name);
  }

  findToolsByKeywords(keywords: string[]): Array<{
    server: string;
    tool: MCPTool;
    matchScore: number;
  }> {
    const results: Array<{
      server: string;
      tool: MCPTool;
      matchScore: number;
    }> = [];

    for (const [serverName, serverInfo] of this.servers) {
      for (const tool of serverInfo.tools) {
        const matchScore = this.calculateKeywordMatchScore(
          keywords,
          [tool.name, tool.description, ...serverInfo.keywords]
        );

        if (matchScore > 0) {
          results.push({
            server: serverName,
            tool,
            matchScore
          });
        }
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateKeywordMatchScore(userKeywords: string[], toolKeywords: string[]): number {
    let score = 0;
    const normalizedUserKeywords = userKeywords.map(k => k.toLowerCase());
    const normalizedToolKeywords = toolKeywords.map(k => k.toLowerCase());

    for (const userKeyword of normalizedUserKeywords) {
      for (const toolKeyword of normalizedToolKeywords) {
        if (toolKeyword.includes(userKeyword) || userKeyword.includes(toolKeyword)) {
          score += 1;
        }
      }
    }

    return score / userKeywords.length;
  }

  addServer(name: string, serverInfo: MCPServerInfo): void {
    this.servers.set(name, serverInfo);
  }
}