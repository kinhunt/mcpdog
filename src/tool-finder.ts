import { MCPRegistry, MCPTool } from './mcp-registry.js';
import { UserIntent } from './intent-analyzer.js';

export interface ToolMatch {
  server: string;
  tool: MCPTool;
  matchScore: number;
  suggestedCall?: {
    toolName: string;
    parameters: any;
    reasoning: string;
  };
}

export class ToolFinder {
  private registry: MCPRegistry;

  constructor() {
    this.registry = new MCPRegistry();
  }

  async findMatchingTools(intent: UserIntent): Promise<ToolMatch[]> {
    // Use keyword matching to find tools
    const matches = this.registry.findToolsByKeywords(intent.keywords);
    
    // Generate call suggestions for each matched tool
    const toolMatches: ToolMatch[] = matches.map(match => {
      const suggestedCall = this.generateToolCall(match.tool, intent);
      
      return {
        server: match.server,
        tool: match.tool,
        matchScore: match.matchScore,
        suggestedCall
      };
    });

    // Return top 3 best matches
    return toolMatches.slice(0, 3);
  }

  private generateToolCall(tool: MCPTool, intent: UserIntent): {
    toolName: string;
    parameters: any;
    reasoning: string;
  } {
    const parameters: any = {};
    let reasoning = `Based on your request "${intent.description}", `;

    // Intelligently fill parameters based on tool type and user intent
    switch (tool.name) {
      case 'browser_navigate':
        if (intent.extractedData.url) {
          parameters.url = intent.extractedData.url;
          reasoning += `I have prepared a call to navigate to ${intent.extractedData.url}.`;
        } else {
          parameters.url = 'https://www.google.com';
          reasoning += `I suggest navigating to Google homepage first.`;
        }
        break;

      case 'browser_type':
        if (intent.extractedData.text) {
          parameters.text = intent.extractedData.text;
          parameters.submit = true;
          reasoning += `I will input the text "${intent.extractedData.text}" and submit.`;
        } else {
          parameters.text = 'Sample text';
          parameters.submit = false;
          reasoning += `This is a sample call for text input.`;
        }
        // Need to get page snapshot first to find input element
        parameters.element = 'Need to get page snapshot to determine input element';
        parameters.ref = 'Need to get element reference from snapshot';
        break;

      case 'browser_click':
        parameters.element = 'Need to get page snapshot to determine click element';
        parameters.ref = 'Need to get element reference from snapshot';
        reasoning += `Need to get page snapshot to determine which element to click.`;
        break;

      case 'browser_screenshot':
      case 'browser_snapshot':
      case 'browser_go_back':
      case 'browser_go_forward':
        // These tools don't need parameters
        reasoning += `This tool can be called directly.`;
        break;

      case 'browser_wait':
        parameters.time = 2;
        reasoning += `I suggest waiting 2 seconds.`;
        break;

      default:
        reasoning += `This is a generic tool call.`;
    }

    return {
      toolName: tool.name,
      parameters,
      reasoning
    };
  }

  getServerConfig(serverName: string) {
    const serverInfo = this.registry.getServerByName(serverName);
    return serverInfo?.config;
  }

  getAllServers() {
    return this.registry.getAllServers();
  }
}