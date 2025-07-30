// 工具推荐引擎
import { UserIntent } from "./intent-analyzer.js";
import { MockToolDatabase, MCPTool } from "./mock-tool-database.js";

export interface ToolRecommendation {
  tool: MCPTool;
  score: number;
  rating: number;
  reasoning: string;
  usageInstructions: string[];
  configurationSteps: string[];
}

export class ToolRecommendationEngine {
  constructor(private toolDatabase: MockToolDatabase) {}

  async getRecommendations(intent: UserIntent): Promise<ToolRecommendation[]> {
    // 1. 从数据库获取相关工具
    const candidateTools = await this.toolDatabase.findToolsByCategory(intent.category);
    
    if (candidateTools.length === 0) {
      return [];
    }

    // 2. 为每个工具计算推荐分数
    const recommendations: ToolRecommendation[] = [];
    
    for (const tool of candidateTools) {
      const score = this.calculateRecommendationScore(tool, intent);
      
      if (score > 0.3) { // 最低推荐阈值
        const recommendation: ToolRecommendation = {
          tool,
          score,
          rating: this.calculateDisplayRating(tool, score),
          reasoning: this.generateReasoning(tool, intent, score),
          usageInstructions: this.generateUsageInstructions(tool, intent),
          configurationSteps: this.generateConfigurationSteps(tool)
        };
        
        recommendations.push(recommendation);
      }
    }

    // 3. 按分数排序并返回前3个
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private calculateRecommendationScore(tool: MCPTool, intent: UserIntent): number {
    let score = 0;

    // 基础类别匹配
    if (tool.category === intent.category) {
      score += 0.4;
    }

    // 关键词匹配
    const toolKeywords = [
      ...tool.name.toLowerCase().split(/\s+/),
      ...tool.description.toLowerCase().split(/\s+/),
      ...tool.keywords
    ];

    let keywordMatches = 0;
    for (const keyword of intent.keywords) {
      if (toolKeywords.some(tk => tk.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(tk))) {
        keywordMatches++;
      }
    }
    
    score += (keywordMatches / intent.keywords.length) * 0.3;

    // 工具功能匹配
    const toolFunctions = tool.tools.map(t => t.name.toLowerCase());
    for (const keyword of intent.keywords) {
      if (toolFunctions.some(tf => tf.includes(keyword))) {
        score += 0.2;
      }
    }

    // 用户数据可用性加分
    if (this.hasRequiredData(tool, intent)) {
      score += 0.1;
    }

    // 工具流行度和评分加分
    const popularityBonus = (tool.stats.users / 10000) * 0.05; // 标准化
    const ratingBonus = (tool.stats.rating / 5) * 0.1;
    score += Math.min(popularityBonus, 0.05) + ratingBonus;

    // 配置难度惩罚
    const difficultyPenalty = {
      'easy': 0,
      'medium': -0.05,
      'hard': -0.1
    };
    score += difficultyPenalty[tool.complexity] || 0;

    return Math.max(0, Math.min(1, score));
  }

  private hasRequiredData(tool: MCPTool, intent: UserIntent): boolean {
    // 检查用户是否提供了工具所需的关键数据
    const extracted = intent.extractedData;
    
    if (tool.category === 'email') {
      return !!(extracted.email || extracted.recipient);
    }
    
    if (tool.category === 'file') {
      return !!(extracted.filename || extracted.url);
    }
    
    if (tool.category === 'database') {
      return !!(extracted.database);
    }

    return true; // 其他类别暂时返回true
  }

  private calculateDisplayRating(tool: MCPTool, score: number): number {
    // 结合工具本身评分和推荐分数
    const baseRating = tool.stats.rating;
    const scoreBonus = score * 0.5; // 推荐分数也影响显示评分
    return Math.min(5, baseRating + scoreBonus);
  }

  private generateReasoning(tool: MCPTool, intent: UserIntent, score: number): string {
    const reasons = [];

    if (tool.category === intent.category) {
      reasons.push(`专门针对${intent.category}功能设计`);
    }

    if (score > 0.8) {
      reasons.push("高度匹配你的需求");
    } else if (score > 0.6) {
      reasons.push("较好匹配你的需求");
    }

    if (tool.stats.users > 5000) {
      reasons.push("用户数量多，稳定可靠");
    }

    if (tool.stats.rating > 4.5) {
      reasons.push("用户评分很高");
    }

    if (tool.complexity === 'easy') {
      reasons.push("配置简单，易于使用");
    }

    if (this.hasRequiredData(tool, intent)) {
      reasons.push("你已提供了所需的关键信息");
    }

    return reasons.length > 0 ? reasons.join("，") : "功能匹配";
  }

  private generateUsageInstructions(tool: MCPTool, intent: UserIntent): string[] {
    const instructions = [];

    // 基础使用说明
    instructions.push(`1. 确保 ${tool.name} 已正确配置`);
    
    // 具体工具调用示例
    if (tool.tools.length > 0) {
      const primaryTool = tool.tools[0];
      const example = this.generateContextualExample(primaryTool, intent);
      instructions.push(`2. 调用主要功能: ${example}`);
    }

    // 类别特定的指导
    if (tool.category === 'email') {
      instructions.push("3. 检查邮件发送状态和日志");
      if (intent.extractedData.email) {
        instructions.push(`4. 确认收件人邮箱: ${intent.extractedData.email}`);
      }
    } else if (tool.category === 'database') {
      instructions.push("3. 测试数据库连接");
      instructions.push("4. 检查查询结果");
    } else if (tool.category === 'file') {
      instructions.push("3. 验证文件路径和权限");
      instructions.push("4. 检查文件处理结果");
    }

    return instructions;
  }

  private generateContextualExample(toolDef: any, intent: UserIntent): string {
    const params = { ...toolDef.exampleParams };
    
    // 根据用户意图智能填充参数
    if (intent.extractedData.email && params.to) {
      params.to = intent.extractedData.email;
    }
    if (intent.extractedData.subject && params.subject) {
      params.subject = intent.extractedData.subject;
    }
    if (intent.extractedData.message && (params.body || params.message)) {
      if (params.body) params.body = intent.extractedData.message;
      if (params.message) params.message = intent.extractedData.message;
    }
    if (intent.extractedData.filename && params.filename) {
      params.filename = intent.extractedData.filename;
    }
    if (intent.extractedData.url && params.url) {
      params.url = intent.extractedData.url;
    }

    return `${toolDef.name}(${JSON.stringify(params, null, 2)})`;
  }

  private generateConfigurationSteps(tool: MCPTool): string[] {
    const steps = [];

    // 通用配置步骤
    steps.push(`1. 安装 ${tool.name}: npm install ${tool.id}`);
    
    if (tool.envVars && tool.envVars.length > 0) {
      steps.push(`2. 配置环境变量: ${tool.envVars.join(', ')}`);
    }

    // 特定类别的配置
    switch (tool.category) {
      case 'email':
        steps.push("3. 配置SMTP服务器或API密钥");
        steps.push("4. 测试邮件发送功能");
        break;
        
      case 'database':
        steps.push("3. 配置数据库连接参数");
        steps.push("4. 测试数据库连接");
        break;
        
      case 'api':
        steps.push("3. 获取并配置API密钥");
        steps.push("4. 测试API调用");
        break;
        
      default:
        steps.push("3. 根据文档完成特定配置");
        steps.push("4. 测试基本功能");
    }

    steps.push(`5. 将 ${tool.name} 添加到MCP客户端配置`);

    return steps;
  }
}