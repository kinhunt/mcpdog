// 智能意图解析系统
export interface UserIntent {
  isValidRequest: boolean;
  description: string;
  confidence: number;
  category: string;
  keywords: string[];
  extractedData: {
    email?: string;
    subject?: string;
    message?: string;
    filename?: string;
    url?: string;
    database?: string;
    [key: string]: any;
  };
}

export class IntentAnalyzer {
  private categoryPatterns = {
    email: [
      /send\s+email/i,
      /email\s+(to|someone)/i,
      /发送?\s*邮件/i,
      /邮件\s*发送/i,
      /发邮件/i,
      /send\s+mail/i,
      /mail\s+to/i
    ],
    database: [
      /database/i,
      /数据库/i,
      /create\s+db/i,
      /connect\s+to\s+database/i,
      /sql/i,
      /query/i,
      /table/i,
      /数据/i
    ],
    file: [
      /file/i,
      /document/i,
      /文件/i,
      /文档/i,
      /upload/i,
      /download/i,
      /read\s+file/i,
      /write\s+file/i,
      /process\s+file/i
    ],
    image: [
      /image/i,
      /photo/i,
      /picture/i,
      /图片/i,
      /图像/i,
      /照片/i,
      /resize/i,
      /crop/i,
      /filter/i
    ],
    api: [
      /api/i,
      /http/i,
      /request/i,
      /get\s+data/i,
      /post\s+data/i,
      /fetch/i,
      /call/i,
      /接口/i
    ],
    web: [
      /web/i,
      /website/i,
      /scrape/i,
      /crawl/i,
      /网站/i,
      /爬虫/i,
      /抓取/i
    ],
    notification: [
      /notification/i,
      /notify/i,
      /alert/i,
      /通知/i,
      /提醒/i,
      /消息/i
    ],
    schedule: [
      /schedule/i,
      /timer/i,
      /cron/i,
      /定时/i,
      /计划/i,
      /任务/i
    ]
  };

  private extractionPatterns = {
    email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    subject: /subject[:\s]+["']?([^"'\n]+)["']?/i,
    message: /message[:\s]+["']?([^"'\n]+)["']?/i,
    filename: /file[:\s]+["']?([^"'\n\s]+)["']?/i,
    url: /(https?:\/\/[^\s]+)/g,
    database: /database[:\s]+["']?([^"'\n\s]+)["']?/i
  };

  async parseIntent(userRequest: string): Promise<UserIntent> {
    // 移除 "use mcpdog" 部分
    const cleanRequest = userRequest.replace(/,?\s*use\s+mcpdog\s*$/i, '').trim();
    
    if (!cleanRequest || cleanRequest.length < 3) {
      return {
        isValidRequest: false,
        description: "请求为空或过短",
        confidence: 0,
        category: "unknown",
        keywords: [],
        extractedData: {}
      };
    }

    // 检测意图类别
    const detectedCategory = this.detectCategory(cleanRequest);
    
    if (detectedCategory === "unknown") {
      return {
        isValidRequest: false,
        description: cleanRequest,
        confidence: 0.1,
        category: "unknown",
        keywords: [],
        extractedData: {}
      };
    }

    // 提取关键词
    const keywords = this.extractKeywords(cleanRequest, detectedCategory);
    
    // 提取结构化数据
    const extractedData = this.extractStructuredData(cleanRequest);
    
    // 计算置信度
    const confidence = this.calculateConfidence(cleanRequest, detectedCategory, keywords);

    // 生成友好的描述
    const description = this.generateDescription(cleanRequest, detectedCategory, extractedData);

    return {
      isValidRequest: true,
      description,
      confidence,
      category: detectedCategory,
      keywords,
      extractedData
    };
  }

  private detectCategory(request: string): string {
    const scores: { [key: string]: number } = {};

    for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(request)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores[category] = score;
      }
    }

    if (Object.keys(scores).length === 0) {
      return "unknown";
    }

    // 返回得分最高的类别
    return Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
  }

  private extractKeywords(request: string, category: string): string[] {
    const keywords = new Set<string>();
    
    // 添加类别相关的通用关键词
    const categoryKeywords = {
      email: ['send', 'email', 'mail', 'message'],
      database: ['database', 'db', 'data', 'sql'],
      file: ['file', 'document', 'upload', 'download'],
      image: ['image', 'photo', 'picture', 'process'],
      api: ['api', 'http', 'request', 'call'],
      web: ['web', 'scrape', 'crawl', 'fetch'],
      notification: ['notify', 'alert', 'message'],
      schedule: ['schedule', 'timer', 'cron']
    };

    if (categoryKeywords[category as keyof typeof categoryKeywords]) {
      categoryKeywords[category as keyof typeof categoryKeywords].forEach(kw => keywords.add(kw));
    }

    // 提取请求中的关键词（简单的单词分割）
    const words = request.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
      if (word.length > 2 && !['the', 'and', 'or', 'but', 'to', 'use', 'mcpdog'].includes(word)) {
        keywords.add(word);
      }
    });

    return Array.from(keywords);
  }

  private extractStructuredData(request: string): { [key: string]: any } {
    const data: { [key: string]: any } = {};

    for (const [key, pattern] of Object.entries(this.extractionPatterns)) {
      const matches = request.match(pattern);
      if (matches) {
        if (key === 'email' || key === 'url') {
          // 可能有多个匹配
          data[key] = matches[0]; // 取第一个
          if (matches.length > 1) {
            data[key + 's'] = matches;
          }
        } else {
          // 取第一个匹配的捕获组
          data[key] = matches[1] || matches[0];
        }
      }
    }

    // 智能提取常见模式
    
    // 提取 "to someone" 模式中的邮箱或名字
    const toMatch = request.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z]+)/i);
    if (toMatch) {
      if (toMatch[1].includes('@')) {
        data.email = toMatch[1];
      } else {
        data.recipient = toMatch[1];
      }
    }

    // 提取引号中的内容作为消息或标题
    const quotedContent = request.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedContent) {
      data.quotedContent = quotedContent.map(q => q.slice(1, -1));
      if (quotedContent.length === 1) {
        data.message = quotedContent[0].slice(1, -1);
      }
    }

    return data;
  }

  private calculateConfidence(request: string, category: string, keywords: string[]): number {
    let confidence = 0.3; // 基础分

    // 类别匹配加分
    const patterns = this.categoryPatterns[category as keyof typeof this.categoryPatterns];
    if (patterns) {
      const matches = patterns.filter(pattern => pattern.test(request)).length;
      confidence += matches * 0.2;
    }

    // 关键词数量加分
    confidence += Math.min(keywords.length * 0.05, 0.3);

    // 结构化数据加分
    const structuredData = this.extractStructuredData(request);
    confidence += Object.keys(structuredData).length * 0.1;

    // 请求长度加分（适中的长度更好）
    if (request.length > 10 && request.length < 200) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private generateDescription(request: string, category: string, extractedData: any): string {
    const categoryDescriptions = {
      email: "发送邮件",
      database: "数据库操作", 
      file: "文件处理",
      image: "图像处理",
      api: "API调用",
      web: "网页操作",
      notification: "通知提醒",
      schedule: "定时任务"
    };

    let description = categoryDescriptions[category as keyof typeof categoryDescriptions] || category;

    // 添加具体细节
    if (extractedData.email) {
      description += ` (收件人: ${extractedData.email})`;
    }
    if (extractedData.subject) {
      description += ` (主题: ${extractedData.subject})`;
    }
    if (extractedData.filename) {
      description += ` (文件: ${extractedData.filename})`;
    }
    if (extractedData.url) {
      description += ` (链接: ${extractedData.url})`;  
    }
    if (extractedData.database) {
      description += ` (数据库: ${extractedData.database})`;
    }

    return description;
  }
}