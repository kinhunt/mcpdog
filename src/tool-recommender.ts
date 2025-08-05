// Tool recommendation engine
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
    // 1. Get relevant tools from database
    const candidateTools = await this.toolDatabase.findToolsByCategory(intent.category);
    
    if (candidateTools.length === 0) {
      return [];
    }

    // 2. Calculate recommendation score for each tool
    const recommendations: ToolRecommendation[] = [];
    
    for (const tool of candidateTools) {
      const score = this.calculateRecommendationScore(tool, intent);
      
      if (score > 0.3) { // Minimum recommendation threshold
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

    // 3. Sort by score and return top 3
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private calculateRecommendationScore(tool: MCPTool, intent: UserIntent): number {
    let score = 0;

    // Basic category matching
    if (tool.category === intent.category) {
      score += 0.4;
    }

    // Keyword matching
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

    // Tool function matching
    const toolFunctions = tool.tools.map(t => t.name.toLowerCase());
    for (const keyword of intent.keywords) {
      if (toolFunctions.some(tf => tf.includes(keyword))) {
        score += 0.2;
      }
    }

    // User data availability bonus
    if (this.hasRequiredData(tool, intent)) {
      score += 0.1;
    }

    // Tool popularity and rating bonus
    const popularityBonus = (tool.stats.users / 10000) * 0.05; // Normalized
    const ratingBonus = (tool.stats.rating / 5) * 0.1;
    score += Math.min(popularityBonus, 0.05) + ratingBonus;

    // Configuration difficulty penalty
    const difficultyPenalty = {
      'easy': 0,
      'medium': -0.05,
      'hard': -0.1
    };
    score += difficultyPenalty[tool.complexity] || 0;

    return Math.max(0, Math.min(1, score));
  }

  private hasRequiredData(tool: MCPTool, intent: UserIntent): boolean {
    // Check if user provided key data required by the tool
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

    return true; // Other categories temporarily return true
  }

  private calculateDisplayRating(tool: MCPTool, score: number): number {
    // Combine tool's own rating and recommendation score
    const baseRating = tool.stats.rating;
          const scoreBonus = score * 0.5; // Recommendation score also affects display rating
    return Math.min(5, baseRating + scoreBonus);
  }

  private generateReasoning(tool: MCPTool, intent: UserIntent, score: number): string {
    const reasons = [];

    if (tool.category === intent.category) {
      reasons.push(`Specifically designed for ${intent.category} functionality`);
    }

    if (score > 0.8) {
      reasons.push("Highly matches your requirements");
    } else if (score > 0.6) {
      reasons.push("Good match for your requirements");
    }

    if (tool.stats.users > 5000) {
      reasons.push("Large user base, stable and reliable");
    }

    if (tool.stats.rating > 4.5) {
      reasons.push("High user rating");
    }

    if (tool.complexity === 'easy') {
      reasons.push("Simple configuration, easy to use");
    }

    if (this.hasRequiredData(tool, intent)) {
      reasons.push("You have provided the required key information");
    }

    return reasons.length > 0 ? reasons.join(", ") : "Feature match";
  }

  private generateUsageInstructions(tool: MCPTool, intent: UserIntent): string[] {
    const instructions = [];

    // Basic usage instructions
    instructions.push(`1. Ensure ${tool.name} is properly configured`);
    
    // Specific tool call example
    if (tool.tools.length > 0) {
      const primaryTool = tool.tools[0];
      const example = this.generateContextualExample(primaryTool, intent);
      instructions.push(`2. Call main function: ${example}`);
    }

    // Category-specific guidance
    if (tool.category === 'email') {
      instructions.push("3. Check email sending status and logs");
      if (intent.extractedData.email) {
        instructions.push(`4. Confirm recipient email: ${intent.extractedData.email}`);
      }
    } else if (tool.category === 'database') {
      instructions.push("3. Test database connection");
              instructions.push("4. Check query results");
    } else if (tool.category === 'file') {
              instructions.push("3. Verify file path and permissions");
              instructions.push("4. Check file processing results");
    }

    return instructions;
  }

  private generateContextualExample(toolDef: any, intent: UserIntent): string {
    const params = { ...toolDef.exampleParams };
    
    // Intelligently fill parameters based on user intent
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

    // General configuration steps
          steps.push(`1. Install ${tool.name}: npm install ${tool.id}`);
    
    if (tool.envVars && tool.envVars.length > 0) {
      steps.push(`2. Configure environment variables: ${tool.envVars.join(', ')}`);
    }

    // Category-specific configuration
    switch (tool.category) {
      case 'email':
        steps.push("3. Configure SMTP server or API keys");
                  steps.push("4. Test email sending functionality");
        break;
        
      case 'database':
                  steps.push("3. Configure database connection parameters");
                  steps.push("4. Test database connection");
        break;
        
      case 'api':
                  steps.push("3. Obtain and configure API keys");
                  steps.push("4. Test API calls");
        break;
        
      default:
        steps.push("3. Complete specific configuration according to documentation");
        steps.push("4. Test basic functionality");
    }

    steps.push(`5. Add ${tool.name} to MCP client configuration`);

    return steps;
  }
}